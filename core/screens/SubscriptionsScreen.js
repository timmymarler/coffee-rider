import { AuthContext } from '@core/context/AuthContext';
import { SubscriptionContext } from '@core/context/SubscriptionContext';
import { useTheme } from '@core/context/ThemeContext';
import { IOS_SUBSCRIPTIONS_DISABLED_MESSAGE, IOS_SUBSCRIPTIONS_TEMP_DISABLED } from '@core/config/launchFlags';
import { SUBSCRIPTION_PLANS } from '@core/payments/stripeService';
import { useStripeSubscription } from '@core/payments/useStripeSubscription';
import { useAppleSubscriptionV2 } from '@core/payments/useAppleSubscriptionV2';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const ENTITLEMENT_SYNC_MAX_ATTEMPTS = 10;
const ENTITLEMENT_SYNC_INTERVAL_MS = 2500;
const ENTITLEMENT_SYNC_SUCCESS_BANNER_MS = 3000;
const UPGRADE_TIP_BANNER_MS = 3500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useContext(AuthContext);
  const { subscription, isSubscribed, isInTrial, getTrialDaysRemaining, loading } = useContext(SubscriptionContext);
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [syncingEntitlement, setSyncingEntitlement] = useState(false);
  const [showEntitlementSynced, setShowEntitlementSynced] = useState(false);
  const [showUpgradeTip, setShowUpgradeTip] = useState(false);
  const entitlementSyncedTimerRef = useRef(null);
  const upgradeTipTimerRef = useRef(null);
  const { subscribeToPlan, status: stripeStatus } = useStripeSubscription();
  const {
    subscribeToPlan: purchaseApplePlan,
    restorePurchases: restoreApplePurchases,
    productsByPlan: appleProductsByPlan,
    iapAvailable,
    loadingProducts: loadingAppleProducts,
    lastLoadError: appleLoadError,
    reloadProducts: reloadAppleProducts,
  } = useAppleSubscriptionV2({ user });
  const isIOS = Platform.OS === 'ios';
  const isIOSSubscriptionsDisabled = isIOS && IOS_SUBSCRIPTIONS_TEMP_DISABLED;

  useEffect(() => {
    if (!isIOS || isIOSSubscriptionsDisabled) {
      return;
    }

    reloadAppleProducts().catch(() => {});
  }, [isIOS, isIOSSubscriptionsDisabled, reloadAppleProducts]);

  useEffect(() => {
    return () => {
      if (entitlementSyncedTimerRef.current) {
        clearTimeout(entitlementSyncedTimerRef.current);
        entitlementSyncedTimerRef.current = null;
      }

      if (upgradeTipTimerRef.current) {
        clearTimeout(upgradeTipTimerRef.current);
        upgradeTipTimerRef.current = null;
      }
    };
  }, []);

  const showUpgradeTipBanner = useCallback(() => {
    if (upgradeTipTimerRef.current) {
      clearTimeout(upgradeTipTimerRef.current);
      upgradeTipTimerRef.current = null;
    }

    setShowUpgradeTip(true);
    upgradeTipTimerRef.current = setTimeout(() => {
      setShowUpgradeTip(false);
      upgradeTipTimerRef.current = null;
    }, UPGRADE_TIP_BANNER_MS);
  }, []);

  const showEntitlementSyncedBanner = useCallback(() => {
    if (entitlementSyncedTimerRef.current) {
      clearTimeout(entitlementSyncedTimerRef.current);
      entitlementSyncedTimerRef.current = null;
    }

    if (upgradeTipTimerRef.current) {
      clearTimeout(upgradeTipTimerRef.current);
      upgradeTipTimerRef.current = null;
    }

    setShowUpgradeTip(false);

    setShowEntitlementSynced(true);
    entitlementSyncedTimerRef.current = setTimeout(() => {
      setShowEntitlementSynced(false);
      entitlementSyncedTimerRef.current = null;
      showUpgradeTipBanner();
    }, ENTITLEMENT_SYNC_SUCCESS_BANNER_MS);
  }, [showUpgradeTipBanner]);

  const waitForEntitlementSync = useCallback(async () => {
    for (let attempt = 1; attempt <= ENTITLEMENT_SYNC_MAX_ATTEMPTS; attempt += 1) {
      await refreshProfile();

      if (isSubscribed() || isInTrial()) {
        return true;
      }

      if (attempt < ENTITLEMENT_SYNC_MAX_ATTEMPTS) {
        await sleep(ENTITLEMENT_SYNC_INTERVAL_MS);
      }
    }

    return false;
  }, [isInTrial, isSubscribed, refreshProfile]);

  const handleApplePurchase = async (planId) => {
    try {
      setSelectedPlan(planId);
      setProcessing(true);
      const result = await purchaseApplePlan(planId);
      if (result?.cancelled) {
        Alert.alert('Purchase cancelled', 'No payment was taken.');
        return;
      }

      if (result?.pending) {
        setSyncingEntitlement(true);
        const synced = await waitForEntitlementSync();
        if (synced) {
          showEntitlementSyncedBanner();
        }
        if (!synced) {
          Alert.alert(
            'Purchase Processing',
            'Apple has accepted your purchase and we are still syncing your subscription. Please wait a moment, then tap Restore Purchases if Pro access is not visible yet.'
          );
        }
        return;
      }

      setSyncingEntitlement(true);
      const synced = await waitForEntitlementSync();
      if (synced) {
        showEntitlementSyncedBanner();
      }
    } catch (err) {
      Alert.alert('Apple Subscription', err?.message || 'Unable to purchase right now. Please try again.');
    } finally {
      setSyncingEntitlement(false);
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  const handleAppleRestore = async () => {
    try {
      setProcessing(true);
      const result = await restoreApplePurchases();
      if (result?.restored) {
        Alert.alert('Purchases Restored', 'Your Apple subscription has been restored.');
      } else {
        Alert.alert('No Purchases Found', 'No active Apple subscription was found for this Apple ID.');
      }

      setSyncingEntitlement(true);
      const synced = await waitForEntitlementSync();
      if (synced) {
        showEntitlementSyncedBanner();
      }
    } catch (err) {
      Alert.alert('Restore Purchases', err?.message || 'Unable to restore right now. Please try again.');
    } finally {
      setSyncingEntitlement(false);
      setProcessing(false);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!user?.email) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      setProcessing(true);
      setSelectedPlan(plan.id);
      const result = await subscribeToPlan(plan.id);
      if (result?.cancelled) {
        Alert.alert('Payment cancelled', 'No payment was taken.');
        return;
      }
      Alert.alert(
        'Payment Successful',
        'Your Pro subscription is now active. You have access to all Pro features.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      setSyncingEntitlement(true);
      const synced = await waitForEntitlementSync();
      if (synced) {
        showEntitlementSyncedBanner();
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Payment failed');
    } finally {
      setSyncingEntitlement(false);
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.primaryDark }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const trialDaysLeft = getTrialDaysRemaining();
  const hasActiveSubscription = isSubscribed();
  const isCurrentlyInTrial = isInTrial();
  const isCancellationScheduled = Boolean(subscription?.cancelAtPeriodEnd);
  const appleActionsDisabled = processing || syncingEntitlement || loadingAppleProducts || !iapAvailable;
  const annualApplePrice =
    appleProductsByPlan?.annual?.displayPrice ||
    appleProductsByPlan?.annual?.localizedPrice ||
    appleProductsByPlan?.annual?.priceString ||
    null;
  const monthlyApplePrice =
    appleProductsByPlan?.monthly?.displayPrice ||
    appleProductsByPlan?.monthly?.localizedPrice ||
    appleProductsByPlan?.monthly?.priceString ||
    null;
  const annualPlanForDisplay = annualApplePrice
    ? { ...SUBSCRIPTION_PLANS.ANNUAL, price: annualApplePrice }
    : SUBSCRIPTION_PLANS.ANNUAL;
  const monthlyPlanForDisplay = monthlyApplePrice
    ? { ...SUBSCRIPTION_PLANS.MONTHLY, price: monthlyApplePrice }
    : SUBSCRIPTION_PLANS.MONTHLY;

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date?.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.primaryDark }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="crown"
          size={48}
          color={theme.colors.accentMid}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>Pro Features</Text>
        <Text style={[styles.subtitle, { color: theme.colors.accentMid }]}> 
          {isIOSSubscriptionsDisabled
            ? 'Soft launch access is active while subscriptions are unavailable on iOS'
            : isIOS
            ? 'Unlock Pro with Apple subscriptions'
            : 'Unlock all features with a Pro subscription'}
        </Text>
      </View>

      {/* Current Status */}
      {isCurrentlyInTrial && (
        <View style={[styles.statusCard, { backgroundColor: theme.colors.accentMid }]}>
          <MaterialCommunityIcons
            name="gift"
            size={24}
            color={theme.colors.text}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
              Free Trial Active!
            </Text>
            <Text style={[styles.statusText, { color: theme.colors.textLight }]}>
              {trialDaysLeft} days remaining
            </Text>
          </View>
          <MaterialCommunityIcons
            name="check-circle"
            size={24}
            color={theme.colors.text}
          />
        </View>
      )}

      {hasActiveSubscription && !isCurrentlyInTrial && (
        <View style={[styles.statusCard, { backgroundColor: theme.colors.primary }]}>
          <MaterialCommunityIcons
            name="check-circle"
            size={24}
            color={theme.colors.text}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
              {isCancellationScheduled ? 'Cancellation Scheduled' : 'Pro Subscriber'}
            </Text>
            <Text style={[styles.statusText, { color: theme.colors.textLight }]}>
              {isCancellationScheduled
                ? `Ends ${formatDate(subscription?.renewalDate)}`
                : `Renews ${formatDate(subscription?.renewalDate)}`}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="check-circle"
            size={24}
            color={theme.colors.text}
          />
        </View>
      )}

      {syncingEntitlement && (
        <View style={[styles.statusCard, { backgroundColor: theme.colors.primaryLight }]}> 
          <ActivityIndicator size="small" color={theme.colors.accentMid} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>Processing upgrade</Text>
            <Text style={[styles.statusText, { color: theme.colors.textLight }]}>Finalizing your Pro access...</Text>
          </View>
        </View>
      )}

      {showEntitlementSynced && (
        <View style={[styles.statusCard, { backgroundColor: theme.colors.primary }]}> 
          <MaterialCommunityIcons name="check-circle" size={24} color={theme.colors.text} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>Pro access active</Text>
            <Text style={[styles.statusText, { color: theme.colors.textLight }]}>Your upgrade is now available in the app.</Text>
          </View>
        </View>
      )}

      {showUpgradeTip && (
        <View style={[styles.statusCard, { backgroundColor: theme.colors.accentMid }]}> 
          <MaterialCommunityIcons name="map-marker-multiple" size={24} color={theme.colors.text} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>Next tip</Text>
            <Text style={[styles.statusText, { color: theme.colors.textLight }]}>Tap Place Markers to view details. Long press anywhere for actions. Try filters and route options to personalise your session.</Text>
          </View>
        </View>
      )}

      {/* Features List */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          What's included
        </Text>
        <Features theme={theme} />
      </View>

      {/* Pricing & Management */}
      <View style={styles.section}>
        {hasActiveSubscription && !isCurrentlyInTrial ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}> 
              Manage your subscription
            </Text>
            <View style={[styles.pricingCard, { backgroundColor: theme.colors.primaryLight }]}> 
              <Pressable
                style={[
                  {
                    backgroundColor: theme.colors.accentMid,
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  },
                ]}
                onPress={() => router.push('/subscriptions/manage')}
              >
                <MaterialCommunityIcons name="cog" size={18} color={theme.colors.intext} />
                <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: '600' }}>
                  {isIOS ? 'Manage Subscription' : 'Manage / Cancel Subscription'}
                </Text>
              </Pressable>
              <Text style={[styles.trialNote, { color: theme.colors.accentMid, marginTop: 12 }]}> 
                Plan switching is not available in-app yet.
              </Text>
            </View>
          </>
        ) : (
          <>
            {isIOSSubscriptionsDisabled ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}> 
                  Soft launch access
                </Text>

                <View style={[styles.pricingCard, { backgroundColor: theme.colors.primaryLight }]}> 
                  <Text style={[styles.trialNote, { color: theme.colors.text, marginBottom: 8 }]}> 
                    {IOS_SUBSCRIPTIONS_DISABLED_MESSAGE}
                  </Text>
                  <Text style={[styles.trialNote, { color: theme.colors.accentMid }]}> 
                    We will re-enable iOS subscriptions in an upcoming update.
                  </Text>
                </View>
              </>
            ) : isIOS ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}> 
                  Choose your plan
                </Text>

                {/* Annual Plan */}
                <PricingCard
                  plan={annualPlanForDisplay}
                  isSelected={selectedPlan === SUBSCRIPTION_PLANS.ANNUAL.id}
                  onPress={() => handleApplePurchase('annual')}
                  processing={processing && selectedPlan === SUBSCRIPTION_PLANS.ANNUAL.id}
                  disabled={appleActionsDisabled}
                  theme={theme}
                />

                {/* Monthly Plan */}
                <PricingCard
                  plan={monthlyPlanForDisplay}
                  isSelected={selectedPlan === SUBSCRIPTION_PLANS.MONTHLY.id}
                  onPress={() => handleApplePurchase('monthly')}
                  processing={processing && selectedPlan === SUBSCRIPTION_PLANS.MONTHLY.id}
                  disabled={appleActionsDisabled}
                  theme={theme}
                />

                {/* Restore Purchases Button */}
                <Pressable
                  onPress={handleAppleRestore}
                  disabled={appleActionsDisabled}
                >
                  <View style={[styles.restoreButton, { backgroundColor: theme.colors.primaryLight }]}>
                    <Text style={[styles.restoreButtonText, { color: theme.colors.accentMid }]}>
                      {processing
                        ? 'Restoring...'
                        : syncingEntitlement
                        ? 'Finalizing...'
                        : loadingAppleProducts
                        ? 'Loading App Store...'
                        : !iapAvailable
                        ? 'Apple IAP Unavailable'
                        : 'Restore Purchases'}
                    </Text>
                  </View>
                </Pressable>

                {!iapAvailable && !processing && (
                  <Text style={[styles.trialNote, { color: theme.colors.textMuted, marginTop: 12 }]}> 
                    Apple subscriptions are not available in this runtime. Use a local iOS development build or TestFlight. Expo Go does not include Apple IAP.
                  </Text>
                )}

                {appleLoadError && !processing && (
                  <Text style={[styles.trialNote, { color: theme.colors.danger, marginTop: 12 }]}> 
                    {appleLoadError.message}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}> 
                  Choose your plan
                </Text>

                {/* Annual Plan */}
                <PricingCard
                  plan={SUBSCRIPTION_PLANS.ANNUAL}
                  isSelected={selectedPlan === SUBSCRIPTION_PLANS.ANNUAL.id}
                  onPress={() => handleSubscribe(SUBSCRIPTION_PLANS.ANNUAL)}
                  processing={processing && selectedPlan === SUBSCRIPTION_PLANS.ANNUAL.id}
                  disabled={processing || stripeStatus === 'initializing' || stripeStatus === 'ready'}
                  theme={theme}
                />

                {/* Monthly Plan */}
                <PricingCard
                  plan={SUBSCRIPTION_PLANS.MONTHLY}
                  isSelected={selectedPlan === SUBSCRIPTION_PLANS.MONTHLY.id}
                  onPress={() => handleSubscribe(SUBSCRIPTION_PLANS.MONTHLY)}
                  processing={processing && selectedPlan === SUBSCRIPTION_PLANS.MONTHLY.id}
                  disabled={processing || stripeStatus === 'initializing' || stripeStatus === 'ready'}
                  theme={theme}
                />

              </>
            )}
          </>
        )}
      </View>

      {/* FAQ */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          FAQ
        </Text>
        <FAQItem
          question="Can I cancel anytime?"
          answer="Yes! You can cancel your subscription at any time from your account settings. You'll retain access until your billing period ends."
          theme={theme}
        />
        <FAQItem
          question="Is there a free trial?"
          answer={isIOS
            ? 'iOS subscriptions are currently unavailable while we rebuild this flow.'
            : 'Free trial is not currently offered on Android. Subscribe to start Pro access immediately.'}
          theme={theme}
        />
        <FAQItem
          question="What if I switch plans?"
          answer="Plan switching is not available in-app yet. If needed, cancel your current plan and choose another after the current billing period ends."
          theme={theme}
        />
      </View>

      <View style={styles.spacing} />
    </ScrollView>
  );
}

function Features({ theme }) {
  const features = [
    'Save and manage routes',
    'Multi-stop navigation',
    'Create and share events',
    'Manage groups',
    'Advanced search',
    'Higher search limits',
  ];

  return (
    <View>
      {features.map((feature, idx) => (
        <View key={idx} style={styles.featureRow}>
          <MaterialCommunityIcons
            name="check"
            size={20}
            color={theme.colors.accentMid}
          />
          <Text style={[styles.featureText, { color: theme.colors.text, marginLeft: 12 }]}>
            {feature}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PricingCard({ plan, isSelected, onPress, processing, isPopular, theme, disabled }) {
  return (
    <Pressable
      style={[
        styles.pricingCard,
        {
          backgroundColor: theme.colors.primaryLight,
          borderColor: isSelected ? theme.colors.primary : theme.colors.primaryDark,
          borderWidth: isSelected ? 2 : 1,
        },
        processing && styles.buttonDisabled,
      ]}
        onPress={onPress}
        disabled={processing || disabled}
    >
      {isPopular && (
        <View style={[styles.popularBadge, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.badgeText, { color: theme.colors.text }]}>Most Popular</Text>
        </View>
      )}
      
      <Text style={[styles.planName, { color: theme.colors.text }]}>{plan.name}</Text>
      
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: theme.colors.primary }]}>{plan.price}</Text>
        <Text style={[styles.period, { color: theme.colors.textLight }]}>
          {plan.period}
        </Text>
      </View>

      <Pressable
        style={[
          {
            backgroundColor: theme.colors.accentMid,
            paddingVertical: 8,
            paddingHorizontal: 18,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          },
          processing && { opacity: 0.5 },
        ]}
        onPress={onPress}
        disabled={processing || disabled}
      >
        {processing ? (
          <ActivityIndicator color={theme.colors.primary} size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="shopping" size={16} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: '600' }}>
              Subscribe Now
            </Text>
          </>
        )}
      </Pressable>

    </Pressable>
  );
}

function FAQItem({ question, answer, theme }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      style={[styles.faqItem, { borderBottomColor: theme.colors.primaryDark }]}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, { color: theme.colors.text, flex: 1 }]}>
          {question}
        </Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textMuted}
        />
      </View>
      
      {expanded && (
        <Text style={[styles.faqAnswer, { color: theme.colors.textMuted, marginTop: 8 }]}>
          {answer}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
  },
  pricingCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  popularBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  period: {
    fontSize: 14,
    marginLeft: 8,
  },
  savings: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 16,
  },
  selectButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  trialButton: {
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  trialNote: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  linkButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  },
  faqItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '500',
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  spacing: {
    height: 40,
  },
  restoreButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
