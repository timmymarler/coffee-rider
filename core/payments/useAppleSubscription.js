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

function normalizePurchaseResult(result) {
  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  return result;
}

export function useAppleSubscription({ user }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [processingSku, setProcessingSku] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  const handledTransactionsRef = useRef(new Set());

  const availableSkus = useMemo(
    () => [APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY, APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL],
    []
  );

  const productsByPlan = useMemo(() => {
    return products.reduce((acc, product) => {
      const planId = APPLE_PRODUCT_TO_PLAN[product.id ?? product.productId];
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

    const fetchedProducts = await Promise.race([
      iap.fetchProducts({ skus: availableSkus, type: 'subs' }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timed out loading App Store products.')), 15000);
      }),
    ]);

    const nextProducts = fetchedProducts || [];
    setProducts(nextProducts);
    return nextProducts;
  }, [availableSkus]);

  const syncPurchaseToProfile = useCallback(
    async (purchase, { finish = true } = {}) => {
      if (!purchase?.productId || !purchase?.transactionId || !user?.uid) {
        return;
      }

      const transactionKey = `${purchase.productId}:${purchase.transactionId}`;
      if (handledTransactionsRef.current.has(transactionKey)) {
        return;
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

        await activateAppleSubscription({
          userId: user.uid,
          email: user.email || null,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          originalTransactionId: purchase.originalTransactionIdentifierIOS,
          purchaseDateMs: purchase.transactionDate,
          receiptData,
        });

        if (finish && iap) {
          await iap.finishTransaction({ purchase, isConsumable: false });
        }
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
        await iap.initConnection();
        if (!isMounted) return;
        await loadProducts();
      } catch (err) {
        console.error('[AppleIAP] Failed to initialize products:', err);
        if (isMounted) {
          setError(err);
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
      setError(purchaseError);
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

      const sku = planId === 'annual' ? APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL : APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY;

      try {
        setError(null);
        setProcessingSku(sku);

        if (!iap) throw new Error('Apple IAP is not available in this build.');

        if (!productsByPlan[planId]) {
          setLoadingProducts(true);
          try {
            await loadProducts();
          } finally {
            setLoadingProducts(false);
          }
        }

        const result = await iap.requestPurchase({
          type: 'subs',
          request: {
            ios: { sku },
            apple: { sku },
          },
        });

        const purchase = normalizePurchaseResult(result);
        if (purchase) {
          await syncPurchaseToProfile(purchase, { finish: true });
          return { success: true, purchase };
        }

        return { success: false };
      } finally {
        setProcessingSku(null);
      }
    },
    [loadProducts, productsByPlan, syncPurchaseToProfile, user?.uid]
  );

  const restorePurchases = useCallback(async () => {
    if (!user?.uid) {
      throw new Error('Please log in first');
    }

    try {
      setError(null);
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

      await syncPurchaseToProfile(latest, { finish: false });
      return { restored: true, purchase: latest };
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
    subscribeToPlan,
    restorePurchases,
  };
}
