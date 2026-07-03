import { activateAppleSubscription, APPLE_SUBSCRIPTION_PRODUCTS } from '@core/payments/stripeService';
import { debugLog } from '@core/utils/debugLog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

let iap = null;
try {
  iap = require('react-native-iap');
} catch (_) {
  iap = null;
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
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.products)) return result.products;
  if (Array.isArray(result?.subscriptions)) return result.subscriptions;
  return [];
}

function resolveDisplayPrice(product) {
  if (!product) return null;

  const directPrice =
    product.displayPrice ||
    product.localizedPrice ||
    product.priceString ||
    product.formattedPrice ||
    null;

  if (typeof directPrice === 'string' && directPrice.trim()) {
    return directPrice.trim();
  }

  const numericPrice = Number(product.price);
  const currencyCode = String(product.currency || product.currencyCode || '').trim();
  if (Number.isFinite(numericPrice) && currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
      }).format(numericPrice);
    } catch (_) {
      // Ignore formatter failures; return null so callers can fallback safely.
    }
  }

  return null;
}

function normalizeStoreProduct(product) {
  if (!product) return product;
  const displayPrice = resolveDisplayPrice(product);
  if (!displayPrice) return product;
  return {
    ...product,
    displayPrice,
  };
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

function getErrorMessage(err) {
  if (!err) return '';
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return String(err);
}

function normalizeErrorText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isTransientIapError(err) {
  const code = String(err?.code || '').toLowerCase();
  if (code === 'e_user_cancelled' || code === 'user_cancelled' || code === 'purchase_cancelled') {
    return false;
  }

  const message = normalizeErrorText(getErrorMessage(err));
  return (
    message.includes('request cancelled') ||
    message.includes('unable to complete this request') ||
    message.includes('service-error') ||
    message.includes('temporarily unavailable') ||
    message.includes('try again later') ||
    message.includes('timeout') ||
    message.includes('itunes') ||
    message.includes('storekit')
  );
}

function isUserCancelledError(err) {
  const code = String(err?.code || '').toLowerCase();
  if (code === 'e_user_cancelled' || code === 'user_cancelled' || code === 'purchase_cancelled') {
    return true;
  }

  const message = normalizeErrorText(getErrorMessage(err));
  return (
    message.includes('cancelled') ||
    message.includes('canceled') ||
    message.includes('user cancelled') ||
    message.includes('user canceled')
  );
}

function isAlreadySubscribedError(err) {
  const message = normalizeErrorText(getErrorMessage(err));
  return (
    message.includes('already subscribed') ||
    message.includes('already have a subscription') ||
    message.includes('already have an active subscription') ||
    message.includes('already purchased this')
  );
}

function isSandboxAccountError(err) {
  const code = String(err?.code || '').toLowerCase();
  if (code.includes('not_allowed') || code.includes('not-entitled')) {
    return true;
  }

  const message = normalizeErrorText(getErrorMessage(err));
  return (
    message.includes('sandbox') ||
    message.includes('cannot connect to itunes store') ||
    message.includes('sign in with your apple id') ||
    message.includes('not signed in') ||
    message.includes('authentication failed') ||
    message.includes('asd') ||
    message.includes('storekit') && message.includes('sign')
  );
}

function toFriendlyIapError(err, operation = 'purchase') {
  if (isSandboxAccountError(err)) {
    return new Error('Apple account validation failed. On development builds/simulator, sign in with a Sandbox Apple ID in device Settings. On TestFlight, use your normal Apple ID and retry.');
  }

  if (isUserCancelledError(err)) {
    return new Error('Apple purchase cancelled.');
  }

  if (isAlreadySubscribedError(err)) {
    return new Error('This Apple ID already has a subscription. Use Restore Purchases to sync access.');
  }

  if (isTransientIapError(err)) {
    if (operation === 'restore') {
      return new Error('Apple restore is temporarily unavailable. Please wait 10-15 seconds, then try Restore Purchases again.');
    }
    return new Error(`Apple ${operation} is temporarily unavailable. Please try again.`);
  }

  return new Error(`Unable to ${operation} right now. Please try again.`);
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

async function fetchAvailablePurchasesResilient() {
  // Primary path for iOS subscriptions.
  try {
    return await withTimeout(
      iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true }),
      45000,
      'Timed out restoring purchases from Apple.'
    );
  } catch (firstErr) {
    // Fallback path for SDK/StoreKit variants that do not like the iOS-only option.
    return withTimeout(
      iap.getAvailablePurchases(),
      45000,
      `Timed out restoring purchases from Apple. (${firstErr?.message || 'initial restore failed'})`
    );
  }
}

function makeAttemptId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function queueDebugLog(tag, message, data = null) {
  debugLog(tag, message, data).catch(() => {});
}

async function fetchStoreProductsResilient(skus) {
  const skuList = Array.isArray(skus) ? skus.filter(Boolean) : [];
  if (!skuList.length) return [];

  const attempts = [];

  if (typeof iap?.fetchProducts === 'function') {
    attempts.push(() => iap.fetchProducts({ skus: skuList, type: 'subs' }));
    attempts.push(() => iap.fetchProducts({ skus: skuList }));
  }
  if (typeof iap?.getSubscriptions === 'function') {
    attempts.push(() => iap.getSubscriptions({ skus: skuList }));
    attempts.push(() => iap.getSubscriptions(skuList));
  }

  let lastErr = null;
  for (const run of attempts) {
    try {
      const result = await withTimeout(run(), 15000, 'Timed out loading App Store products.');
      const products = normalizeProductsResult(result);
      if (products.length > 0) {
        return products;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  return [];
}

async function requestSubscriptionResilient(sku) {
  const skuValue = String(sku || '').trim();
  if (!skuValue) {
    throw new Error('Missing App Store SKU for selected plan.');
  }

  const attempts = [];

  if (typeof iap?.requestSubscription === 'function') {
    attempts.push(() => iap.requestSubscription({ sku: skuValue }));
    attempts.push(() => iap.requestSubscription(skuValue));
  }

  if (typeof iap?.requestPurchase === 'function') {
    attempts.push(() =>
      iap.requestPurchase({
        type: 'subs',
        request: {
          ios: { sku: skuValue },
          apple: { sku: skuValue },
        },
      })
    );
  }

  let lastErr = null;
  for (const run of attempts) {
    try {
      return await withTimeout(run(), 25000, 'Apple purchase timed out. Please try again.');
    } catch (err) {
      lastErr = err;
      if (isUserCancelledError(err)) {
        throw err;
      }
    }
  }

  throw lastErr || new Error('Unable to start Apple subscription purchase.');
}

export function useAppleSubscriptionV2({ user }) {
  const [phase, setPhase] = useState('idle');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [processingSku, setProcessingSku] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  const [purchaseError, setPurchaseError] = useState(null);
  const [lastLoadError, setLastLoadError] = useState(null);

  const handledTransactionsRef = useRef(new Set());
  const purchaseOperationRef = useRef(null);
  const lastRestoreAttemptRef = useRef(0);
  const purchaseFlowActiveRef = useRef(false);

  const beginPurchaseOperation = useCallback(() => {
    if (purchaseOperationRef.current && !purchaseOperationRef.current.settled) {
      return purchaseOperationRef.current;
    }

    let resolveOp;
    let rejectOp;
    const promise = new Promise((resolve, reject) => {
      resolveOp = resolve;
      rejectOp = reject;
    });

    const operation = {
      promise,
      settled: false,
      resolve: (value) => {
        if (operation.settled) return;
        operation.settled = true;
        resolveOp(value);
      },
      reject: (err) => {
        if (operation.settled) return;
        operation.settled = true;
        rejectOp(err);
      },
    };

    purchaseOperationRef.current = operation;
    return operation;
  }, []);

  const resolvePurchaseOperation = useCallback((value) => {
    const operation = purchaseOperationRef.current;
    if (!operation) return;
    operation.resolve(value);
  }, []);

  const rejectPurchaseOperation = useCallback((err) => {
    const operation = purchaseOperationRef.current;
    if (!operation) return;
    operation.reject(err);
  }, []);

  const clearSettledPurchaseOperation = useCallback(() => {
    const operation = purchaseOperationRef.current;
    if (!operation || !operation.settled) return;
    purchaseOperationRef.current = null;
  }, []);

  const beginPurchaseFlow = useCallback(() => {
    purchaseFlowActiveRef.current = true;
  }, []);

  const endPurchaseFlow = useCallback(() => {
    purchaseFlowActiveRef.current = false;
  }, []);

  const availableSkus = useMemo(() => {
    const monthly = APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY;
    const annual = APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL;
    const skuSet = new Set([monthly, annual].filter(Boolean));

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

  const ensureIapConnection = useCallback(async () => {
    if (Platform.OS !== 'ios' || !iap) return;

    try {
      await withTimeout(iap.initConnection(), 10000, 'Timed out connecting to App Store.');
    } catch (firstErr) {
      // Best-effort reset and retry once.
      try {
        await iap.endConnection();
      } catch (_) {
        // ignore cleanup error
      }
      await withTimeout(iap.initConnection(), 10000, 'Timed out reconnecting to App Store.');
      console.warn('[AppleIAP V2] Recovered initConnection after error:', firstErr?.message || firstErr);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (Platform.OS !== 'ios' || !iap) {
      queueDebugLog('APPLE_IAP', 'Skipping App Store plan load', {
        platform: Platform.OS,
        iapAvailable: Boolean(iap),
      });
      return [];
    }

    setPhase('loading_products');
    let lastErr = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (attempt > 1) {
        await new Promise((res) => setTimeout(res, attempt * 1200));
      }

      queueDebugLog('APPLE_IAP', 'Loading App Store plans', {
        attempt,
        maxAttempts: 3,
        skuCount: availableSkus.length,
      });

      try {
        await ensureIapConnection();
        const nextProducts = (await fetchStoreProductsResilient(availableSkus)).map(normalizeStoreProduct);
        if (nextProducts.length > 0) {
          queueDebugLog('APPLE_IAP', 'Loaded App Store plans', {
            count: nextProducts.length,
            products: nextProducts.map((product) => ({
              id: product?.id || product?.productId || product?.sku || null,
              displayPrice: product?.displayPrice || null,
              currency: product?.currency || product?.currencyCode || null,
            })),
          });
          setProducts(nextProducts);
          setLastLoadError(null);
          setPhase('ready');
          return nextProducts;
        }

        lastErr = new Error(`No App Store plans returned (attempt ${attempt}/3)`);
        queueDebugLog('APPLE_IAP', 'No App Store plans returned', {
          attempt,
        });
      } catch (err) {
        lastErr = err;
        console.warn(`[AppleIAP V2] loadProducts attempt ${attempt} failed:`, err?.message || err);
        queueDebugLog('APPLE_IAP', 'App Store plan load attempt failed', {
          attempt,
          error: err?.message || String(err),
          code: err?.code || null,
        });
      }
    }

    const mappedLoadError = toFriendlyIapError(lastErr, 'load App Store plans');
    setLastLoadError(mappedLoadError);
    queueDebugLog('APPLE_IAP', 'Failed to load App Store plans', {
      error: mappedLoadError?.message || String(mappedLoadError),
      originalError: lastErr?.message || String(lastErr),
      code: lastErr?.code || null,
    });
    setPhase('error');
    return [];
  }, [availableSkus, ensureIapConnection]);

  const reloadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      setError(null);
      setPurchaseError(null);
      queueDebugLog('APPLE_IAP', 'User tapped Reload App Store Plans');
      const reloaded = await loadProducts();
      queueDebugLog('APPLE_IAP', 'Reload App Store Plans completed', {
        productCount: Array.isArray(reloaded) ? reloaded.length : 0,
      });
      return reloaded;
    } catch (err) {
      setLastLoadError(err);
      queueDebugLog('APPLE_IAP', 'Reload App Store Plans threw error', {
        error: err?.message || String(err),
        code: err?.code || null,
      });
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
        throw new Error('Missing purchase identifiers from Apple.');
      }

      const transactionKey = `${productId}:${transactionId}`;
      if (handledTransactionsRef.current.has(transactionKey)) {
        throw new Error('Purchase sync already in progress. Please wait.');
      }

      handledTransactionsRef.current.add(transactionKey);
      try {
        const receiptData =
          purchase.transactionReceipt ||
          purchase.transactionReceiptIOS ||
          purchase.receiptData ||
          (iap?.getReceiptIOS ? await iap.getReceiptIOS() : null);

        if (!receiptData) {
          throw new Error('Unable to validate purchase receipt. Please use Restore Purchases.');
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

    const purchaseUpdateSubscription = iap.purchaseUpdatedListener(async (purchase) => {
      try {
        const activation = await syncPurchaseToProfile(purchase, { finish: true });
        resolvePurchaseOperation({
          success: true,
          purchase,
          activation,
          fromListener: true,
        });
        queueDebugLog('APPLE_IAP', 'purchaseUpdatedListener activation success', {
          productId: getPurchaseProductId(purchase),
        });
      } catch (err) {
        const mappedError = toFriendlyIapError(err, 'purchase');
        setPurchaseError(mappedError);
        queueDebugLog('APPLE_IAP', 'purchaseUpdatedListener activation failed', {
          error: mappedError?.message || String(mappedError),
        });
        rejectPurchaseOperation(mappedError);
      }
    });

    const purchaseErrorSubscription = iap.purchaseErrorListener((purchaseErr) => {
      const hasActiveOperation = Boolean(
        purchaseOperationRef.current && !purchaseOperationRef.current.settled
      );
      const hasActivePurchaseFlow = purchaseFlowActiveRef.current || Boolean(processingSku);

      if (!hasActiveOperation && !hasActivePurchaseFlow) {
        queueDebugLog('APPLE_IAP', 'Ignored purchaseErrorListener event (no active purchase flow)', {
          code: purchaseErr?.code || null,
          message: getErrorMessage(purchaseErr),
        });
        return;
      }

      const mappedError = toFriendlyIapError(purchaseErr, 'purchase');
      setPurchaseError(mappedError);
      setProcessingSku(null);
      setPhase('error');
      queueDebugLog('APPLE_IAP', 'purchaseErrorListener mapped purchase error', {
        code: purchaseErr?.code || null,
        message: mappedError?.message || String(mappedError),
      });
      rejectPurchaseOperation(mappedError);
    });

    return () => {
      purchaseUpdateSubscription.remove();
      purchaseErrorSubscription.remove();
      rejectPurchaseOperation(new Error('Purchase flow was interrupted. Please try again.'));
      endPurchaseFlow();
      iap.endConnection().catch(() => {});
    };
  }, [endPurchaseFlow, processingSku, rejectPurchaseOperation, resolvePurchaseOperation, syncPurchaseToProfile]);

  const restorePurchases = useCallback(async () => {
    if (!user?.uid) {
      throw new Error('Please log in first');
    }

    try {
      setError(null);
      setPurchaseError(null);
      setRestoring(true);
      setPhase('restoring');

      const now = Date.now();
      if (now - lastRestoreAttemptRef.current < 4000) {
        throw new Error('Restore already in progress. Please wait a few seconds and try again.');
      }
      lastRestoreAttemptRef.current = now;

      if (!iap) throw new Error('Apple IAP is not available in this build.');
      await ensureIapConnection();

      let purchases = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          purchases = await fetchAvailablePurchasesResilient();
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt === 1) {
            try {
              await iap.endConnection();
            } catch (_) {
              // Best-effort reset before retry.
            }
            await new Promise((res) => setTimeout(res, 1500));
            await ensureIapConnection();
          }
        }
      }

      if (lastErr) {
        throw lastErr;
      }

      const appleSubscriptions = (purchases || [])
        .filter((purchase) => availableSkus.includes(purchase.productId))
        .sort((a, b) => Number(b.transactionDate || 0) - Number(a.transactionDate || 0));

      const latest = appleSubscriptions[0];
      if (!latest) {
        setPhase('ready');
        return { restored: false };
      }

      const activation = await syncPurchaseToProfile(latest, { finish: false });
      if (activation?.status !== 'active') {
        throw new Error('Restore completed but profile sync did not complete.');
      }

      setPhase('active');
      return { restored: true, purchase: latest, activation };
    } catch (err) {
      const mappedError = toFriendlyIapError(err, 'restore');
      setPurchaseError(mappedError);
      setPhase('error');
      throw mappedError;
    } finally {
      setRestoring(false);
    }
  }, [availableSkus, ensureIapConnection, syncPurchaseToProfile, user?.uid]);

  const subscribeToPlan = useCallback(
    async (planId) => {
      if (!user?.uid) {
        throw new Error('Please log in first');
      }

      const attemptId = makeAttemptId('purchase');
      const fallbackSku =
        planId === 'annual' ? APPLE_SUBSCRIPTION_PRODUCTS.ANNUAL : APPLE_SUBSCRIPTION_PRODUCTS.MONTHLY;

      try {
        setError(null);
        setPurchaseError(null);
        beginPurchaseFlow();
        setProcessingSku(fallbackSku);
        setPhase('purchasing');

        if (!iap) throw new Error('Apple IAP is not available in this build.');
        await ensureIapConnection();

        let productForPlan = productsByPlan[planId];
        if (!productForPlan) {
          const reloadedProducts = await reloadProducts();
          productForPlan = (reloadedProducts || []).find(
            (product) => resolvePlanIdFromProduct(product) === planId
          );
        }

        const sku = productForPlan?.id || productForPlan?.productId || productForPlan?.sku || fallbackSku;
        setProcessingSku(sku);

        const operation = beginPurchaseOperation();
        const result = await requestSubscriptionResilient(sku);

        const purchase = normalizePurchaseResult(result);
        if (purchase) {
          setPhase('validating');
          const activation = await syncPurchaseToProfile(purchase, { finish: true });
          if (activation?.status !== 'active') {
            throw new Error('Purchase completed, but activation is pending. Please use Restore Purchases.');
          }

          const successResult = { success: true, purchase, activation, fromListener: false, attemptId };
          resolvePurchaseOperation(successResult);
          clearSettledPurchaseOperation();
          setPhase('active');
          return successResult;
        }

        const listenerResult = await withTimeout(
          operation.promise,
          30000,
          'Purchase processing timed out. Please use Restore Purchases.'
        );
        clearSettledPurchaseOperation();
        setPhase('active');
        return { ...listenerResult, attemptId };
      } catch (err) {
        if (isUserCancelledError(err)) {
          setPhase('ready');
          return { cancelled: true, attemptId };
        }

        if (isAlreadySubscribedError(err)) {
          const restoreResult = await restorePurchases();
          if (restoreResult?.restored) {
            return { success: true, restored: true, attemptId };
          }
        }

        const mappedError = toFriendlyIapError(err, 'purchase');
        setPurchaseError(mappedError);
        rejectPurchaseOperation(mappedError);
        clearSettledPurchaseOperation();
        setPhase('error');
        throw mappedError;
      } finally {
        setProcessingSku(null);
        endPurchaseFlow();
      }
    },
    [
      beginPurchaseFlow,
      beginPurchaseOperation,
      clearSettledPurchaseOperation,
      endPurchaseFlow,
      ensureIapConnection,
      productsByPlan,
      rejectPurchaseOperation,
      reloadProducts,
      resolvePurchaseOperation,
      restorePurchases,
      syncPurchaseToProfile,
      user?.uid,
    ]
  );

  return {
    phase,
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
