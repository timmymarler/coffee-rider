import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_LOG_KEY = 'coffee_rider_debug_logs';
const MAX_LOGS = 200; // Keep last 200 log entries

/**
 * Structured debug logging to console, AsyncStorage, and optionally toast
 * @param {string} tag - Log tag (e.g., "ROUTE_TO_HOME", "GPS")
 * @param {string} message - Log message
 * @param {object} data - Optional additional data
 * @param {function} onToast - Optional callback to show toast (receives {title, message})
 */
export async function debugLog(tag, message, data = null, onToast = null) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    tag,
    message,
    data: data || {},
  };

  // Console log
  console.log(`[${tag}] ${message}`, data || '');

  // Toast notification (skip verbose location updates)
  if (onToast && !['GPS_UPDATE', 'LOCATION_FILTERED'].includes(tag)) {
    onToast({
      title: `[${tag}]`,
      message: message,
    });
  }

  // Persist to AsyncStorage
  try {
    const existingLogs = await AsyncStorage.getItem(DEBUG_LOG_KEY);
    let logs = existingLogs ? JSON.parse(existingLogs) : [];
    
    // Add new entry
    logs.push(entry);
    
    // Keep only last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(logs.length - MAX_LOGS);
    }
    
    await AsyncStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('[debugLog] Failed to persist logs:', err);
  }
}

/**
 * Get all stored debug logs
 * @returns {Promise<array>} Array of log entries
 */
export async function getDebugLogs() {
  try {
    const logs = await AsyncStorage.getItem(DEBUG_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (err) {
    console.error('[getDebugLogs] Failed to retrieve logs:', err);
    return [];
  }
}

/**
 * Clear all debug logs
 */
export async function clearDebugLogs() {
  try {
    await AsyncStorage.removeItem(DEBUG_LOG_KEY);
  } catch (err) {
    console.error('[clearDebugLogs] Failed to clear logs:', err);
  }
}

/**
 * Export logs as text (for sharing/debugging)
 * @returns {Promise<string>} Formatted log text
 */
export async function exportDebugLogsAsText() {
  try {
    const logs = await getDebugLogs();
    let text = `Coffee Rider Debug Logs - ${new Date().toISOString()}\n`;
    text += '='.repeat(60) + '\n\n';
    
    logs.forEach(log => {
      text += `${log.timestamp} [${log.tag}] ${log.message}\n`;
      if (Object.keys(log.data).length > 0) {
        text += `  Data: ${JSON.stringify(log.data)}\n`;
      }
    });
    
    return text;
  } catch (err) {
    console.error('[exportDebugLogsAsText] Failed:', err);
    return '';
  }
}
