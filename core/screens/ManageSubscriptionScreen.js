import { AuthContext } from '@core/context/AuthContext';
import { SubscriptionContext } from '@core/context/SubscriptionContext';
import { useTheme } from '@core/context/ThemeContext';
import { cancelSubscription } from '@core/payments/stripeService';
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

export default function ManageSubscriptionScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { subscription, isSubscribed, isInTrial, getTrialDaysRemaining } = useContext(SubscriptionContext);
  const theme = useTheme();
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const hasActiveSubscription = isSubscribed();
  const isCurrentlyInTrial = isInTrial();
  const trialDaysLeft = getTrialDaysRemaining();

  const handleCancelSubscription = async () => {
    if (!subscription?.stripeSubscriptionId) {
      return;
    }

    try {
      setCancelling(true);
      await cancelSubscription({
        userId: user.uid,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      });
      Alert.alert(
        'Cancellation Scheduled',
        `You will keep Pro access until ${formatDate(subscription.renewalDate) || 'the next renewal date'}.`
      );
    } catch (err) {
      console.error('[Subscription] Failed to cancel subscription', err);
      Alert.alert('Error', err?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date?.seconds ? date.seconds * 1000 : date);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatPlanLabel = (plan) => {
    if (!plan) return 'UNKNOWN';
    const normalized = plan.toLowerCase();
    if (normalized === 'daily') return 'LEGACY';
    return normalized.toUpperCase();
  };

  if (!hasActiveSubscription && !isCurrentlyInTrial) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.primaryDark }]}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.textLight}
          />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Active Subscription
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>
            You don't have an active Pro subscription yet.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, { color: theme.colors.primaryDark }]}>
              Back to Subscriptions
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.primaryDark }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="check-circle"
          size={48}
          color={theme.colors.primary}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {isCurrentlyInTrial ? 'Free Trial' : 'Pro Subscriber'}
        </Text>
      </View>

      {/* Status Card */}
      <View
        style={[
          styles.statusCard,
          { backgroundColor: theme.colors.accentMid },
        ]}
      >
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: theme.colors.textLight }]}>
            {isCurrentlyInTrial ? 'Trial Remaining' : 'Plan'}
          </Text>
          <Text style={[styles.statusValue, { color: theme.colors.text }]}>
            {isCurrentlyInTrial ? `${trialDaysLeft} days` : formatPlanLabel(subscription?.plan)}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.primaryLight }]} />

        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: theme.colors.textLight }]}>
            {isCurrentlyInTrial ? 'Trial Ends' : 'Renewal Date'}
          </Text>
          <Text style={[styles.statusValue, { color: theme.colors.text }]}>
            {isCurrentlyInTrial
              ? formatDate(subscription?.trialEndsAt)
              : formatDate(subscription?.renewalDate)}
          </Text>
        </View>
      </View>

      {/* Features List */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Your Pro Features
        </Text>
        <ProFeatures theme={theme} />
      </View>

      {/* Cancel Button (only for paid subscriptions, not trials) */}
      {hasActiveSubscription && !isCurrentlyInTrial && (
        <View style={styles.section}>
          {confirmingCancel ? (
            <View style={styles.confirmColumn}>
              <Pressable
                style={[
                  styles.cancelButton,
                  { borderColor: theme.colors.primary },
                  cancelling && styles.buttonDisabled,
                ]}
                onPress={() => setConfirmingCancel(false)}
                disabled={cancelling}
              >
                <MaterialCommunityIcons
                  name="arrow-left-circle"
                  size={20}
                  color={theme.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.cancelButtonText, { color: theme.colors.primary }]}>
                  Keep Subscription
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.destructiveButton,
                  { backgroundColor: theme.colors.danger },
                  cancelling && styles.buttonDisabled,
                ]}
                onPress={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color={theme.colors.background} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={theme.colors.background}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.cancelButtonText, { color: theme.colors.background }]}>
                      Cancel Subscription
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[
                styles.cancelButton,
                { borderColor: theme.colors.danger },
                cancelling && styles.buttonDisabled,
              ]}
              onPress={() => setConfirmingCancel(true)}
              disabled={cancelling}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={theme.colors.danger}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.cancelButtonText, { color: theme.colors.danger }]}>
                Cancel Subscription
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Back Button */}
      <View style={styles.section}>
        <Pressable
          style={[styles.button, { backgroundColor: theme.colors.primaryLight }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>
            Back
          </Text>
        </Pressable>
      </View>

      <View style={styles.spacing} />
    </ScrollView>
  );
}

function ProFeatures({ theme }) {
  const features = [
    'Unlimited saved routes',
    'Multi-stop navigation',
    'Create and manage events',
    'Create and manage groups',
    'Advanced route search',
    'Higher search limits',
  ];

  return (
    <View>
      {features.map((feature, idx) => (
        <View key={idx} style={styles.featureRow}>
          <MaterialCommunityIcons
            name="check"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.featureText, { color: theme.colors.text, marginLeft: 12 }]}>
            {feature}
          </Text>
        </View>
      ))}
    </View>
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
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destructiveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmColumn: {
    flexDirection: 'column',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  spacing: {
    height: 40,
  },
});
