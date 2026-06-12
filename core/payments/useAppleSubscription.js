import { activateAppleSubscription, APPLE_SUBSCRIPTION_PRODUCTS } from '@core/payments/stripeService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

// react-native-iap requires a compiled native binary (Nitro/TurboModule).
// Lazy-require so missing native spec doesn't crash the JS bundle in dev builds
// or on Android where the module is not linked.
let iap = null;
try {
  iap = require('react-native-iap');
} catch (_) {
  // Native module not available — all IAP calls will be no-ops
}

const APPLE_PRODUCT_TO_PLAN = {
  [APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY]: 'monthly',
  [APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL]: 'annual',
};

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function stripVersionSuffix(productId) {
  return String(productId || '').trim().replace(/\.v\d+$/i, '');
}

function resolvePlanIdFromProduct(product) {
  const productId = normalizeId(product?.id || product?.productId || product?.sku);
  const monthlyId = normalizeId(APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY);
  const annualId = normalizeId(APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL);

  if (!productId) return null;
  if (productId === annualId || productId.includes('.annual')) return 'annual';
  if (productId === monthlyId || productId.includes('.monthly')) return 'monthly';

  return APPLE_PRODUCT_TO_PLAN[product?.id ?? product?.productId] || null;
}

function normalizeProductsResult(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && Array.isArray(result.products)) {
    return result.products;
  }

  if (result && Array.isArray(result.subscriptions)) {
    return result.subscriptions;
  }

  return [];
}

function normalizePurchaseResult(result) {
  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  return result;
}

function getPurchaseProductId(purchase) {
  return purchase?.productId || purchase?.productID || purchase?.sku || null;
}

function getPurchaseTransactionId(purchase) {
  return (
    purchase?.transactionId ||
    purchase?.transactionID ||
    purchase?.id ||
    purchase?.transactionIdentifierIOS ||
    null
  );
}

function getOriginalTransactionId(purchase) {
  return (
    purchase?.originalTransactionIdentifierIOS ||
    purchase?.originalTransactionId ||
    purchase?.originalTransactionID ||
    null
  );
}

function normalizePurchaseDateMs(purchase) {
  const raw =
    purchase?.transactionDate ||
    purchase?.purchaseDate ||
    purchase?.purchaseDateMs ||
    null;

  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function useAppleSubscription({ user }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [processingSku, setProcessingSku] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  const [purchaseError, setPurchaseError] = useState(null);
  const [lastLoadError, setLastLoadError] = useState(null);
  const handledTransactionsRef = useRef(new Set());

  const availableSkus = useMemo(() => {
    const monthly = APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY;
    const annual = APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL;
    const skuSet = new Set([monthly, annual].filter(Boolean));

    // Fallback aliases: if ASC products were created without version suffixes,
    // StoreKit can still return those while configured env uses .v2 IDs.
    const monthlyAlias = stripVersionSuffix(monthly);
    const annualAlias = stripVersionSuffix(annual);
    if (monthlyAlias) skuSet.add(monthlyAlias);
    if (annualAlias) skuSet.add(annualAlias);

    return Array.from(skuSet);
  }, []);

  const productsByPlan = useMemo(() => {
    return products.reduce((acc, product) => {
      const planId = resolvePlanIdFromProduct(product);
      if (planId) {
        acc[planId] = product;
      }
      return acc;
    }, {});
  }, [products]);

  const loadProducts = useCallback(async () => {
    if (Platform.OS !== 'ios' || !iap) {
      return [];
    }

    // Retry up to 3 times — StoreKit can return empty on the first call
    // if the Nitro module or App Store connection isn't fully settled yet.
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) {
        await new Promise((res) => setTimeout(res, attempt * 1500));
      }
      try {
        const fetchedProducts = await Promise.race([
          iap.fetchProducts({ skus: availableSkus, type: 'subs' }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timed out loading App Store products.')), 15000)
          ),
        ]);

        const nextProducts = normalizeProductsResult(fetchedProducts);
        if (nextProducts.length > 0) {
          setProducts(nextProducts);
          setLastLoadError(null);
          return nextProducts;
        }
        // Empty result — record as a soft error and retry
        lastErr = new Error(
          `App Store returned no products for: ${availableSkus.join(', ')} (attempt ${attempt}/3)`
        );
        console.warn('[AppleIAP] fetchProducts returned empty, will retry. SKUs:', availableSkus);
      } catch (err) {
        lastErr = err;
        console.warn(`[AppleIAP] fetchProducts error (attempt ${attempt}/3):`, err?.message ?? err);
      }
    }

    // All retries exhausted
    setLastLoadError(lastErr);
    return [];
  }, [availableSkus]);

  const reloadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      setError(null);
      setPurchaseError(null);
      const nextProducts = await loadProducts();
      return nextProducts;
    } catch (err) {
      setLastLoadError(err);
      throw err;
    } finally {
      setLoadingProducts(false);
    }
  }, [loadProducts]);

  const syncPurchaseToProfile = useCallback(
    async (purchase, { finish = true } = {}) => {
      if (!user?.uid) {
        throw new Error('Please log in first');
      }

      const productId = getPurchaseProductId(purchase);
      const transactionId = getPurchaseTransactionId(purchase);
      const originalTransactionId = getOriginalTransactionId(purchase);

      if (!productId || !transactionId) {
        throw new Error(
          `[AppleIAP] Missing product/transaction identifiers. productId=${String(productId)} transactionId=${String(transactionId)}`
        );
      }

      const transactionKey = `${productId}:${transactionId}`;
      if (handledTransactionsRef.current.has(transactionKey)) {
        throw new Error('Purchase sync already in progress. Please try again in a moment.');
      }

      handledTransactionsRef.current.add(transactionKey);
      try {
        const receiptData =
          purchase.transactionReceipt ||
          purchase.transactionReceiptIOS ||
          purchase.receiptData ||
          (iap?.getReceiptIOS ? await iap.getReceiptIOS() : null);

        if (!receiptData) {
          throw new Error('Unable to validate purchase receipt. Please try restoring purchases.');
        }

        const activation = await activateAppleSubscription({
          userId: user.uid,
          email: user.email || null,
          productId,
          transactionId,
          originalTransactionId,
          purchaseDateMs: normalizePurchaseDateMs(purchase),
          receiptData,
        });

        if (finish && iap) {
          await iap.finishTransaction({ purchase, isConsumable: false });
        }

        return activation;
      } finally {
        handledTransactionsRef.current.delete(transactionKey);
      }
    },
    [user?.uid, user?.email]
  );

  useEffect(() => {
    if (Platform.OS !== 'ios' || !iap) {
      return undefined;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        setLoadingProducts(true);

        // initConnection can throw "already connected" on hot-reload / remount.
        // Treat that as non-fatal so we still proceed to fetch products.
        try {
          await iap.initConnection();
        } catch (connErr) {
          console.warn('[AppleIAP] initConnection warning (may already be connected):', connErr?.message ?? connErr);
        }

        if (!isMounted) return;
        await loadProducts();
      } catch (err) {
        console.error('[AppleIAP] Failed to initialize products:', err);
        if (isMounted) {
          setError(err);
          setLastLoadError(err);
        }
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    };

    initialize();

    const purchaseUpdateSubscription = iap.purchaseUpdatedListener(async (purchase) => {
      try {
        await syncPurchaseToProfile(purchase, { finish: true });
      } catch (err) {
        console.error('[AppleIAP] Purchase update sync error:', err);
      }
    });

    const purchaseErrorSubscription = iap.purchaseErrorListener((purchaseError) => {
      console.error('[AppleIAP] Purchase error:', purchaseError);
      setPurchaseError(purchaseError);
      setProcessingSku(null);
    });

    return () => {
      isMounted = false;
      purchaseUpdateSubscription.remove();
      purchaseErrorSubscription.remove();
      iap.endConnection().catch(() => {});
    };
  }, [loadProducts, syncPurchaseToProfile]);

  const subscribeToPlan = useCallback(
    async (planId) => {
      if (!user?.uid) {
        throw new Error('Please log in first');
      }

      const fallbackSku =
        planId === 'annual' ? APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL : APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY;

      try {
        setError(null);
        setPurchaseError(null);
        setProcessingSku(fallbackSku);

        if (!iap) throw new Error('Apple IAP is not available in this build.');

        let productForPlan = productsByPlan[planId];
        if (!productForPlan) {
          const reloadedProducts = await reloadProducts();
          productForPlan = (reloadedProducts || []).find(
            (product) => resolvePlanIdFromProduct(product) === planId
          );
        }

        const sku = productForPlan?.id || productForPlan?.productId || productForPlan?.sku || fallbackSku;
        setProcessingSku(sku);

        const result = await iap.requestPurchase({
          type: 'subs',
          request: {
            ios: { sku },
            apple: { sku },
          },
        });

        const purchase = normalizePurchaseResult(result);
        if (purchase) {
          const activation = await syncPurchaseToProfile(purchase, { finish: true });
          if (!activation?.status) {
            throw new Error('Subscription purchase completed, but profile sync failed. Please restore purchases.');
          }
          return { success: true, purchase, activation };
        }

        return { success: false };
      } catch (err) {
        setPurchaseError(err);
        throw err;
      } finally {
        setProcessingSku(null);
      }
    },
    [productsByPlan, reloadProducts, syncPurchaseToProfile, user?.uid]
  );

  const restorePurchases = useCallback(async () => {
    if (!user?.uid) {
      throw new Error('Please log in first');
    }

    try {
      setError(null);
      setPurchaseError(null);
      setRestoring(true);

      if (!iap) throw new Error('Apple IAP is not available in this build.');

      const purchases = await iap.getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
      });

      const appleSubscriptions = (purchases || [])
        .filter((purchase) => availableSkus.includes(purchase.productId))
        .sort((a, b) => Number(b.transactionDate || 0) - Number(a.transactionDate || 0));

      const latest = appleSubscriptions[0];
      if (!latest) {
        return { restored: false };
      }

      const activation = await syncPurchaseToProfile(latest, { finish: false });
      if (!activation?.status) {
        throw new Error('Restore completed in App Store but profile sync did not complete. Please try again.');
      }
      return { restored: true, purchase: latest, activation };
    } finally {
      setRestoring(false);
    }
  }, [availableSkus, syncPurchaseToProfile, user?.uid]);

  return {
    products,
    productsByPlan,
    loadingProducts,
    processingSku,
    restoring,
    error,
    purchaseError,
    lastLoadError,
    reloadProducts,
    subscribeToPlan,
    restorePurchases,
  };
}
