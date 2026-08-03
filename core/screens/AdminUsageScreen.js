import { AuthContext } from '@context/AuthContext';
import { useThemeControls } from '@context/ThemeContext';
import { getDailyUsageStats } from '@core/utils/usageTelemetry';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const USAGE_TYPES = ['search', 'route', 'photo', 'navigation', 'other'];

function formatDateLabel(dayKey) {
  const dt = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dayKey;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function EmptyRow() {
  return (
    <View style={{ paddingVertical: 10 }}>
      <Text style={{ color: '#8A8A8A', fontSize: 13 }}>No usage data for this range yet.</Text>
    </View>
  );
}

export default function AdminUsageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useContext(AuthContext);
  const { theme: dynamicTheme } = useThemeControls();
  const theme = dynamicTheme;

  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  const isAdmin = profile?.role === 'admin';

  const styles = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.primaryLight,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: 120,
      gap: 12,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryDark,
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '700',
      marginTop: 4,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    card: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.primaryDark,
      padding: theme.spacing.md,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 10,
    },
    chipsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
      marginBottom: 6,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.primaryDark,
      backgroundColor: theme.colors.primaryDark,
    },
    chipActive: {
      backgroundColor: theme.colors.accentMid,
      borderColor: theme.colors.accentMid,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textMuted,
    },
    chipTextActive: {
      color: theme.colors.primaryDark,
    },
    totalValue: {
      color: theme.colors.text,
      fontSize: 30,
      fontWeight: '800',
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.primaryDark,
    },
    rowLeft: {
      color: theme.colors.text,
      fontSize: 13,
      textTransform: 'capitalize',
    },
    rowRight: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    dayRow: {
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.primaryDark,
      gap: 6,
    },
    dayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dayLabel: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    dayTotal: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    barTrack: {
      width: '100%',
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryDark,
      overflow: 'hidden',
    },
    barFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.accentMid,
    },
    adminOnlyText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      marginTop: 10,
      lineHeight: 20,
    },
    refreshButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.colors.accentMid,
    },
    refreshButtonText: {
      color: theme.colors.primaryDark,
      fontSize: 12,
      fontWeight: '700',
    },
  });

  const loadStats = useCallback(async (rangeDays, { silent = false } = {}) => {
    if (!isAdmin) return;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const data = await getDailyUsageStats(rangeDays);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setError(err?.message || 'Failed to load usage stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadStats(days);
  }, [days, loadStats]);

  const totals = useMemo(() => {
    const sum = {
      total: 0,
      search: 0,
      route: 0,
      photo: 0,
      navigation: 0,
      other: 0,
    };

    for (const row of rows) {
      sum.total += Number(row?.totalCount || 0);
      for (const type of USAGE_TYPES) {
        sum[type] += Number(row?.counts?.[type] || 0);
      }
    }

    return sum;
  }, [rows]);

  const maxDailyTotal = useMemo(() => {
    return rows.reduce((max, row) => Math.max(max, Number(row?.totalCount || 0)), 1);
  }, [rows]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View>
          <Text style={styles.title}>Admin Usage Dashboard</Text>
          <Text style={styles.subtitle}>Daily totals by usage type</Text>
        </View>

        {!isAdmin ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Access Restricted</Text>
            <Text style={styles.adminOnlyText}>
              This screen is only available for admin accounts.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Range</Text>
              <View style={styles.chipsRow}>
                {[7, 14, 30].map((n) => {
                  const active = days === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setDays(n)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{n} days</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.refreshButton} onPress={() => loadStats(days, { silent: true })}>
                <Text style={styles.refreshButtonText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total Events</Text>
              {loading ? (
                <ActivityIndicator color={theme.colors.accentMid} />
              ) : (
                <>
                  <Text style={styles.totalValue}>{totals.total}</Text>
                  {USAGE_TYPES.map((type) => (
                    <View key={type} style={styles.breakdownRow}>
                      <Text style={styles.rowLeft}>{type}</Text>
                      <Text style={styles.rowRight}>{totals[type]}</Text>
                    </View>
                  ))}
                </>
              )}
              {error ? <Text style={{ color: theme.colors.danger, marginTop: 10 }}>{error}</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Trend</Text>
              {loading ? (
                <ActivityIndicator color={theme.colors.accentMid} />
              ) : rows.length === 0 ? (
                <EmptyRow />
              ) : (
                rows.map((row) => {
                  const total = Number(row?.totalCount || 0);
                  const widthPercent = Math.max(3, Math.round((total / maxDailyTotal) * 100));
                  return (
                    <View key={row.dayKey} style={styles.dayRow}>
                      <View style={styles.dayHead}>
                        <Text style={styles.dayLabel}>{formatDateLabel(row.dayKey)}</Text>
                        <Text style={styles.dayTotal}>{total}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${widthPercent}%` }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
