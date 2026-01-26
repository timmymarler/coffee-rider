// core/utils/sponsorshipUtils.js
import { db } from "@config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

/**
 * Renew or extend a user's sponsorship
 * @param {string} userId - The ID of the user (place owner)
 * @param {number} durationDays - Number of days to extend the sponsorship
 * @param {object} transactionDetails - Optional payment transaction details
 * @returns {object} - { success: boolean, validTo: timestamp, message: string }
 */
export async function renewSponsorship(userId, durationDays, transactionDetails = null) {
  try {
    if (!userId || !durationDays || durationDays <= 0) {
      return {
        success: false,
        message: "Invalid user ID or duration",
      };
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return {
        success: false,
        message: "User not found",
      };
    }

    // Calculate new validTo date
    const now = Date.now();
    const currentValidTo = userSnap.data()?.sponsorship?.validTo?.toMillis?.() || 
                          userSnap.data()?.sponsorship?.validTo || 
                          now;
    
    // If already expired, extend from today; otherwise extend from current expiry
    const baseDate = currentValidTo < now ? now : currentValidTo;
    const newValidTo = new Date(baseDate + durationDays * 24 * 60 * 60 * 1000);

    // Update user sponsorship
    await updateDoc(userRef, {
      sponsorship: {
        isActive: true,
        validTo: newValidTo,
        lastRenewed: new Date(),
        ...(transactionDetails && { lastTransactionId: transactionDetails.transactionId }),
      },
    });

    return {
      success: true,
      validTo: newValidTo,
      message: `Sponsorship renewed until ${newValidTo.toLocaleDateString()}`,
    };
  } catch (error) {
    console.error("Error renewing sponsorship:", error);
    return {
      success: false,
      message: error.message || "Failed to renew sponsorship",
    };
  }
}

/**
 * Check if a user has active sponsorship
 * @param {string} userId - The ID of the user
 * @returns {object} - { isActive: boolean, validTo: date, daysRemaining: number }
 */
export async function checkSponsorship(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return {
        isActive: false,
        message: "User not found",
      };
    }

    const sponsorshipData = userSnap.data()?.sponsorship;
    if (!sponsorshipData) {
      return {
        isActive: false,
        message: "No sponsorship data",
      };
    }

    const now = Date.now();
    const validTo = sponsorshipData.validTo?.toMillis?.() || sponsorshipData.validTo;
    const isActive = sponsorshipData.isActive && validTo > now;
    const daysRemaining = isActive ? Math.ceil((validTo - now) / (24 * 60 * 60 * 1000)) : 0;

    return {
      isActive,
      validTo: new Date(validTo),
      daysRemaining,
    };
  } catch (error) {
    console.error("Error checking sponsorship:", error);
    return {
      isActive: false,
      message: error.message,
    };
  }
}

/**
 * Format sponsorship duration options
 * Returns common sponsorship packages
 */
export const SPONSORSHIP_PACKAGES = [
  { name: "1 Month", days: 30, price: 9.99 },
  { name: "3 Months", days: 90, price: 24.99 },
  { name: "6 Months", days: 180, price: 44.99 },
  { name: "1 Year", days: 365, price: 79.99 },
];
