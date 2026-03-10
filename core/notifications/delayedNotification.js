/**
 * Delayed notification system
 * Adds a configurable delay before showing notifications
 * Prevents showing notifications too early when crossing junction thresholds
 */

let pendingNotificationTimeout = null;

/**
 * Schedule a notification after a delay
 * If another notification is scheduled before the delay expires, the first one is cancelled
 * @param {Function} notificationFn - Async function that sends the notification
 * @param {number} delayMs - Delay in milliseconds (default: 2000ms = 2 seconds)
 * @param {string} debugLabel - For logging purposes
 */
export async function delayedNotification(notificationFn, delayMs = 2000, debugLabel = 'notification') {
  // Cancel any pending notification
  if (pendingNotificationTimeout) {
    clearTimeout(pendingNotificationTimeout);
    console.log(`[DelayedNotification] Cancelled pending ${debugLabel}`);
  }

  // Schedule new notification
  pendingNotificationTimeout = setTimeout(async () => {
    try {
      console.log(`[DelayedNotification] Sending ${debugLabel} after ${delayMs}ms delay`);
      await notificationFn();
    } catch (error) {
      console.error(`[DelayedNotification] Error sending ${debugLabel}:`, error);
    } finally {
      pendingNotificationTimeout = null;
    }
  }, delayMs);
}

/**
 * Cancel any pending notifications
 */
export function cancelPendingNotification() {
  if (pendingNotificationTimeout) {
    clearTimeout(pendingNotificationTimeout);
    pendingNotificationTimeout = null;
    console.log('[DelayedNotification] Pending notification cancelled');
  }
}
