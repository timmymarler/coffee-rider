// core/hooks/useSponsorship.js
import { AuthContext } from "@context/AuthContext";
import { checkSponsorship, renewSponsorship } from "@core/utils/sponsorshipUtils";
import { useContext, useState } from "react";

export function useSponsorship() {
  const { user, profile } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sponsorshipStatus, setSponsorshipStatus] = useState(null);

  /**
   * Renew sponsorship after payment is processed
   * Call this from your payment handler after successful transaction
   * @param {number} durationDays - Days to extend
   * @param {object} transactionDetails - Payment details { transactionId, amount, etc }
   */
  const handlePaymentSuccess = async (durationDays, transactionDetails) => {
    if (!user?.uid) {
      setError("User not authenticated");
      return { success: false };
    }

    setLoading(true);
    setError(null);

    const result = await renewSponsorship(
      user.uid,
      durationDays,
      transactionDetails
    );

    setLoading(false);

    if (result.success) {
      setSponsorshipStatus({
        isActive: true,
        validTo: result.validTo,
      });
    } else {
      setError(result.message);
    }

    return result;
  };

  /**
   * Check current sponsorship status
   */
  const checkStatus = async () => {
    if (!user?.uid) {
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    const status = await checkSponsorship(user.uid);
    setLoading(false);

    if (status.isActive !== undefined) {
      setSponsorshipStatus(status);
    } else {
      setError(status.message);
    }

    return status;
  };

  return {
    handlePaymentSuccess,
    checkStatus,
    sponsorshipStatus,
    loading,
    error,
  };
}
