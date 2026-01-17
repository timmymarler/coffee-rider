let counters = {};

// Enable in dev by default; can be disabled via env
const ENABLED = (typeof __DEV__ !== "undefined" && __DEV__) || process.env.EXPO_PUBLIC_ENABLE_DEV_METRICS === "1";

/**
 * Increment a named metric counter.
 * Logs every `logEvery` increments to avoid spam.
 */
export function incMetric(key, step = 1, logEvery = 10) {
  if (!ENABLED) return;
  const next = (counters[key] || 0) + step;
  counters[key] = next;
  if (next % logEvery === 0) {
    // Use console.debug to lower verbosity vs console.log
    console.debug(`[METRICS] ${key}: ${next}`);
  }
}

/**
 * Force a one-off metric log.
 */
export function logMetric(key, value) {
  if (!ENABLED) return;
  console.debug(`[METRICS] ${key}: ${value}`);
}

/**
 * Reset counters (useful in tests).
 */
export function resetMetrics() {
  counters = {};
}

/**
 * Get current counters snapshot and reset for next session.
 * Useful for per-session summaries.
 */
export function getAndResetSummary() {
  if (!ENABLED) return null;
  const snapshot = { ...counters };
  console.log(
    "%c[METRICS SUMMARY]",
    "color: #4a90e2; font-weight: bold;",
    snapshot
  );
  resetMetrics();
  return snapshot;
}
