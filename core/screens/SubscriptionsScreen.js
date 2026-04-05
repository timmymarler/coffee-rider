import { AuthContext } from '@core/context/AuthContext';
import { SubscriptionContext } from '@core/context/SubscriptionContext';
import { useTheme } from '@core/context/ThemeContext';
import { SUBSCRIPTION_PLANS, startFreeTrial } from '@core/payments/stripeService';
import { useStripeSubscription } from '@core/payments/useStripeSubscription';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useContext(AuthContext);
  const { subscription, isSubscribed, isInTrial, getTrialDaysRemaining, loading } = useContext(SubscriptionContext);
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const { subscribeToPlan, status: stripeStatus } = useStripeSubscription();

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
        'Processing Payment',
        'Once Stripe confirms the payment your Pro access will unlock automatically.',
        [{ text: 'OK', onPress: () => router.replace('/profile') }]
      );
      await refreshProfile();
    } catch (err) {
      Alert.alert('Error', err.message || 'Payment failed');
    } finally {
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
          Unlock all features with a Pro subscription
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
              Pro Subscriber
            </Text>
            <Text style={[styles.statusText, { color: theme.colors.textLight }]}>
              Renews {subscription?.renewalDate}
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

      {/* Pricing Plans */}
      <View style={styles.section}>
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
          answer="Yes, start with a 30-day free trial of all Pro features. No credit card required."
          theme={theme}
        />
        <FAQItem
          question="What if I switch plans?"
          answer="You can upgrade or downgrade your plan anytime. We'll prorate the charges or credits based on your remaining billing period."
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

      {plan.id === 'annual' && (
        <Text style={[styles.trialNote, { color: theme.colors.accentMid, marginTop: 12 }]}>
          (12 months for the price of 10)
        </Text>
      )}
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
