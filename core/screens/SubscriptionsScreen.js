import { AuthContext } from '@core/context/AuthContext';
import { SubscriptionContext } from '@core/context/SubscriptionContext';
import { useTheme } from '@core/context/ThemeContext';
import { SUBSCRIPTION_PLANS, startFreeTrial } from '@core/payments/stripeService';
import { useAppleSubscription } from '@core/payments/useAppleSubscription';
import { useStripeSubscription } from '@core/payments/useStripeSubscription';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const PRIVACY_POLICY_URL = 'https://coffee-rider.co.uk/privacy-policy';
const TERMS_OF_SERVICE_URL = 'https://coffee-rider.co.uk/terms-of-service';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useContext(AuthContext);
  const { subscription, isSubscribed, isInTrial, getTrialDaysRemaining, loading } = useContext(SubscriptionContext);
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const { subscribeToPlan, status: stripeStatus } = useStripeSubscription();
  const {
    productsByPlan: appleProductsByPlan,
    loadingProducts: appleLoading,
    processingSku: appleProcessingSku,
    restoring: appleRestoring,
    error: appleError,
    purchaseError: applePurchaseError,
    lastLoadError: appleLoadError,
    reloadProducts,
    subscribeToPlan: subscribeToApplePlan,
    restorePurchases,
  } = useAppleSubscription({ user });
  const isIOS = Platform.OS === 'ios';

  const openExternalLink = async (url, label) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unable to open link', `${label} link is currently unavailable.`);
        return;
      }
      await Linking.openURL(url);
    } catch (_error) {
      Alert.alert('Unable to open link', `${label} link is currently unavailable.`);
    }
  };

  const handleStartTrial = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      setProcessing(true);
      await startFreeTrial({ userId: user.uid, email: user.email });
      
      // Refresh user profile to reflect new 'pro' role
      await refreshProfile();
      
      Alert.alert('Success!', 'You now have 7 days of Pro access', [
        { text: 'OK', onPress: () => router.push('/map') }
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to start trial');
    } finally {
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
      await refreshProfile();
    } catch (err) {
      Alert.alert('Error', err.message || 'Payment failed');
    } finally {
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  const handleAppleSubscribe = async (planId) => {
    if (!user?.email) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    if (!appleProductsByPlan.monthly && !appleProductsByPlan.annual) {
      // Best-effort refresh only. Do not hard-block purchase attempt because
      // requestPurchase can still succeed using configured fallback SKUs.
      try {
        await reloadProducts();
      } catch (_err) {
        // Continue and allow hook-level fallback SKU purchase path.
      }
    }

    try {
      setSelectedPlan(planId);
      const result = await subscribeToApplePlan(planId);
      if (result?.success) {
        await refreshProfile();
        Alert.alert('Subscription Active', 'Your Apple subscription is now active.');
      }
    } catch (err) {
      const message = String(err?.message || '');
      const normalized = message.toLowerCase();
      if (normalized.includes('already have an active apple subscription')) {
        Alert.alert(
          'Subscription Already Active',
          'This Apple ID already has an active subscription. Restore purchases to sync access on this account.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Restore Now',
              onPress: () => {
                handleAppleRestore();
              },
            },
          ]
        );
        return;
      }

      Alert.alert('Error', message || 'Unable to complete Apple subscription.');
    } finally {
      setSelectedPlan(null);
    }
  };

  const handleAppleRestore = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      const result = await restorePurchases();
      await refreshProfile();
      if (result?.restored) {
        Alert.alert('Restored', 'Your Apple subscription has been restored.');
      } else {
        Alert.alert('No Active Subscription', 'No active Apple subscription was found to restore.');
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Unable to restore Apple purchases.');
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
  const hasAppleMonthly = Boolean(appleProductsByPlan.monthly);
  const hasAppleAnnual = Boolean(appleProductsByPlan.annual);
  const hasAnyApplePlan = hasAppleMonthly || hasAppleAnnual;

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
          {isIOS
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
            {isIOS ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}> 
                  Choose your Apple plan
                </Text>

                {appleLoading && (
                  <Text style={[styles.trialNote, { color: theme.colors.accentMid, marginBottom: 12 }]}> 
                    Loading App Store plans...
                  </Text>
                )}

                {appleError && !hasAnyApplePlan && (
                  <Text style={[styles.trialNote, { color: theme.colors.danger, marginBottom: 12 }]}> 
                    App Store products failed to load. Please retry in a moment.
                  </Text>
                )}

                {appleLoadError && !hasAnyApplePlan && (
                  <Text style={[styles.trialNote, { color: theme.colors.danger, marginBottom: 12 }]}> 
                    {appleLoadError?.message || 'App Store returned an unknown product-loading error.'}
                  </Text>
                )}

                {applePurchaseError && hasAnyApplePlan && (
                  <Text style={[styles.trialNote, { color: theme.colors.danger, marginBottom: 12 }]}> 
                    {applePurchaseError?.message || 'Apple purchase failed. Please try again.'}
                  </Text>
                )}

                {!hasAnyApplePlan && (
                  <View style={[styles.pricingCard, { backgroundColor: theme.colors.primaryLight }]}> 
                    {appleLoadError ? (
                      <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
                        {appleLoadError?.message || String(appleLoadError)}
                      </Text>
                    ) : null}
                    <Pressable
                      style={{
                        backgroundColor: theme.colors.accentMid,
                        paddingVertical: 8,
                        paddingHorizontal: 18,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                      onPress={async () => {
                        try {
                          await reloadProducts();
                        } catch (err) {
                          Alert.alert('App Store load failed', err?.message || 'Please try again.');
                        }
                      }}
                      disabled={appleLoading}
                    >
                      {appleLoading ? (
                        <ActivityIndicator color={theme.colors.text} />
                      ) : (
                        <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: '600' }}>
                          Reload App Store Plans
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}

                {hasAppleAnnual && (
                  <PricingCard
                    plan={{
                      ...SUBSCRIPTION_PLANS.ANNUAL,
                      price: appleProductsByPlan.annual?.displayPrice || SUBSCRIPTION_PLANS.ANNUAL.price,
                    }}
                    isSelected={selectedPlan === SUBSCRIPTION_PLANS.ANNUAL.id}
                    onPress={() => handleAppleSubscribe('annual')}
                    processing={appleProcessingSku === (appleProductsByPlan.annual?.id ?? appleProductsByPlan.annual?.productId)}
                    disabled={appleRestoring || Boolean(appleProcessingSku)}
                    theme={theme}
                  />
                )}

                {hasAppleMonthly && (
                  <PricingCard
                    plan={{
                      ...SUBSCRIPTION_PLANS.MONTHLY,
                      price: appleProductsByPlan.monthly?.displayPrice || SUBSCRIPTION_PLANS.MONTHLY.price,
                    }}
                    isSelected={selectedPlan === SUBSCRIPTION_PLANS.MONTHLY.id}
                    onPress={() => handleAppleSubscribe('monthly')}
                    processing={appleProcessingSku === (appleProductsByPlan.monthly?.id ?? appleProductsByPlan.monthly?.productId)}
                    disabled={appleRestoring || Boolean(appleProcessingSku)}
                    theme={theme}
                  />
                )}

                <View style={[styles.pricingCard, { backgroundColor: theme.colors.primaryLight }]}> 
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
                      appleRestoring && { opacity: 0.5 },
                    ]}
                    onPress={handleAppleRestore}
                    disabled={appleLoading || appleRestoring || Boolean(appleProcessingSku)}
                  >
                    {appleRestoring ? (
                      <ActivityIndicator color={theme.colors.text} />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="restore"
                          size={20}
                          color={theme.colors.intext}
                        />
                        <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: '600' }}>
                          Restore Apple Purchases
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                <View style={[styles.pricingCard, { backgroundColor: theme.colors.primaryLight }]}> 
                  <Text style={[styles.trialNote, { color: theme.colors.text, marginBottom: 8 }]}> 
                    By subscribing, payment is charged to your Apple ID account at confirmation.
                  </Text>
                  <Pressable
                    style={[styles.linkButton, { borderColor: theme.colors.accentMid }]}
                    onPress={() => openExternalLink(PRIVACY_POLICY_URL, 'Privacy Policy')}
                  >
                    <Text style={[styles.linkText, { color: theme.colors.accentMid }]}>Privacy Policy</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.linkButton, { borderColor: theme.colors.accentMid }]}
                    onPress={() => openExternalLink(TERMS_OF_SERVICE_URL, 'Terms of Service')}
                  >
                    <Text style={[styles.linkText, { color: theme.colors.accentMid }]}>Terms of Service (EULA)</Text>
                  </Pressable>
                </View>
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

                {/* Free Trial CTA (if not already in trial or subscribed) */}
                {!isCurrentlyInTrial && !hasActiveSubscription && (
                  <View style={[styles.pricingCard, { backgroundColor: theme.colors.primaryLight }]}> 
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
                      onPress={handleStartTrial}
                      disabled={processing}
                    >
                      {processing ? (
                        <ActivityIndicator color={theme.colors.text} />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="gift"
                            size={20}
                            color={theme.colors.intext}
                          />
                          <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: '600' }}>
                            Start 7-Day Free Trial
                          </Text>
                        </>
                      )}
                    </Pressable>
                    <Text style={[styles.trialNote, { color: theme.colors.accentMid, marginTop: 12 }]}> 
                      (No card needed)
                    </Text>
                  </View>
                )}
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
            ? 'iOS subscriptions are billed by Apple. Any trial eligibility is shown directly by the App Store at checkout.'
            : 'Yes, you get a 7-day free trial of Pro features. No card required for the trial.'}
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
});
