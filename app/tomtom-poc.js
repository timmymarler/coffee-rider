import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import {
  getTomTomNavigationStatus,
  initializeTomTomNavigation,
} from '@/core/map/tomtomNavigationSdk';

export default function TomTomPocScreen() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(await getTomTomNavigationStatus());
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const initialize = async (telemetryEnabled) => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(await initializeTomTomNavigation({ telemetryEnabled }));
    } catch (initializationError) {
      setError(initializationError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headingRow}>
          <Ionicons name="navigate-circle" size={34} color="#E6B93F" />
          <View style={styles.headingText}>
            <Text style={styles.title}>TomTom SDK Proof</Text>
            <Text style={styles.subtitle}>Native Android initialization only</Text>
          </View>
        </View>

        <View style={styles.statusPanel}>
          <StatusRow label="Native module" value={status?.available ? 'Available' : 'Unavailable'} />
          <StatusRow label="SDK key" value={status?.configured ? 'Configured' : 'Missing'} />
          <StatusRow label="Initialized" value={status?.initialized ? 'Yes' : 'No'} />
          <StatusRow label="SDK version" value={status?.sdkVersion || 'Unknown'} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {status?.initialized ? (
          <Text style={styles.notice}>
            SDK already initialized for this app session. Restart the proof app to test a different telemetry choice.
          </Text>
        ) : null}
        {isLoading ? <ActivityIndicator color="#E6B93F" /> : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading || status?.initialized}
            onPress={() => initialize(false)}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              status?.initialized && styles.disabledButton,
              pressed && !status?.initialized && styles.pressed,
            ]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#F5F5F0" />
            <Text style={styles.buttonText}>Initialize without telemetry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading || status?.initialized}
            onPress={() => initialize(true)}
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              status?.initialized && styles.disabledButton,
              pressed && !status?.initialized && styles.pressed,
            ]}
          >
            <Ionicons name="analytics-outline" size={20} color="#17191A" />
            <Text style={styles.primaryButtonText}>Allow telemetry and initialize</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={refreshStatus}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="refresh" size={22} color="#F5F5F0" />
            <Text style={styles.buttonText}>Refresh status</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatusRow({ label, value }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121516' },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 28, gap: 24 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingText: { flex: 1, gap: 3 },
  title: { color: '#F5F5F0', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#A8B0B2', fontSize: 14 },
  statusPanel: { borderWidth: 1, borderColor: '#303638', backgroundColor: '#1B1F20' },
  statusRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3A4143',
  },
  statusLabel: { color: '#A8B0B2', fontSize: 14 },
  statusValue: { color: '#F5F5F0', fontSize: 14, fontWeight: '600' },
  actions: { gap: 12 },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButton: { backgroundColor: '#E6B93F' },
  secondaryButton: { borderWidth: 1, borderColor: '#586164', backgroundColor: '#24292B' },
  iconButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { color: '#F5F5F0', fontSize: 15, fontWeight: '600' },
  primaryButtonText: { color: '#17191A', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  error: { color: '#FF8C82', fontSize: 14, lineHeight: 20 },
  notice: { color: '#E6B93F', fontSize: 14, lineHeight: 20 },
  disabledButton: { opacity: 0.45 },
});