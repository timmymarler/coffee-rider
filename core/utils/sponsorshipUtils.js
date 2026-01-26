// core/utils/sponsorshipUtils.js
import { db } from "@config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

/**
 * Renew or extend a place's sponsorship
 * @param {string} placeId - The ID of the place
 * @param {number} durationDays - Number of days to extend the sponsorship
 * @param {object} transactionDetails - Optional payment transaction details
 * @returns {object} - { success: boolean, validTo: timestamp, message: string }
 */
export async function renewSponsorship(placeId, durationDays, transactionDetails = null) {
  try {
    if (!placeId || !durationDays || durationDays <= 0) {
      return {
        success: false,
        message: "Invalid place ID or duration",
      };
    }

    const placeRef = doc(db, "places", placeId);
    const placeSnap = await getDoc(placeRef);

    if (!placeSnap.exists()) {
      return {
        success: false,
        message: "Place not found",
      };
    }

    // Calculate new validTo date
    const now = Date.now();
    const currentValidTo = placeSnap.data()?.sponsorship?.validTo?.toMillis?.() || 
                          placeSnap.data()?.sponsorship?.validTo || 
                          now;
    
    // If already expired, extend from today; otherwise extend from current expiry
    const baseDate = currentValidTo < now ? now : currentValidTo;
    const newValidTo = new Date(baseDate + durationDays * 24 * 60 * 60 * 1000);

    // Update place sponsorship
    await updateDoc(placeRef, {
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
 * Check if a place has active sponsorship
 * @param {string} placeId - The ID of the place
 * @returns {object} - { isActive: boolean, validTo: date, daysRemaining: number }
 */
export async function checkSponsorship(placeId) {
  try {
    const placeRef = doc(db, "places", placeId);
    const placeSnap = await getDoc(placeRef);

    if (!placeSnap.exists()) {
      return {
        isActive: false,
        message: "Place not found",
      };
    }

    const sponsorshipData = placeSnap.data()?.sponsorship;
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
