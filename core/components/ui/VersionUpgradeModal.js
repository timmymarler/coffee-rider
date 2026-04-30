import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { Linking, Modal, Platform, Text, TouchableOpacity, View } from "react-native";

const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.timmy.marler.coffeerider";
const IOS_TESTFLIGHT_WEB_URL = "https://testflight.apple.com";
const IOS_TESTFLIGHT_APP_URL = "itms-beta://";

export function VersionUpgradeModal({
  visible,
  isRequired,
  currentVersion,
  newVersion,
  releaseNotes,
  onDismiss,
  storeUrl,
}) {
  const resolveStoreUrl = async () => {
    if (storeUrl) return storeUrl;
    if (Platform.OS === "android") return ANDROID_STORE_URL;

    try {
      const canOpenTestFlight = await Linking.canOpenURL(IOS_TESTFLIGHT_APP_URL);
      return canOpenTestFlight ? IOS_TESTFLIGHT_APP_URL : IOS_TESTFLIGHT_WEB_URL;
    } catch {
      return IOS_TESTFLIGHT_WEB_URL;
    }
  };

  const handleUpdate = async () => {
    try {
      const targetUrl = await resolveStoreUrl();
      await Linking.openURL(targetUrl);
    } catch (error) {
      console.error("[VERSION] Failed to open store URL:", error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isRequired ? null : onDismiss}
      pointerEvents={visible ? "auto" : "none"}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.primaryDark,
            borderRadius: 16,
            padding: 24,
            width: "100%",
            maxWidth: 340,
            alignItems: "center",
          }}
        >
          {/* Icon */}
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: theme.colors.accentLight,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons
              name="arrow-up-circle"
              size={32}
              color={theme.colors.accentDark}
            />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.colors.text,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {isRequired ? "Update Required" : "Update Available"}
          </Text>

          {/* Subtitle */}
          <Text
            style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {isRequired
              ? "Please update to the latest version to continue using the app."
              : "A new version is available with improvements and bug fixes."}
          </Text>

          {/* Version Info */}
          <View
            style={{
              backgroundColor: theme.colors.primaryLight,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 16,
              width: "100%",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.textSecondary,
                textAlign: "center",
              }}
            >
              Current: {currentVersion} → Latest: {newVersion}
            </Text>
          </View>

          {/* Release Notes */}
          {releaseNotes && (
            <View
              style={{
                backgroundColor: theme.colors.primaryLight,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 20,
                width: "100%",
                maxHeight: 100,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: theme.colors.text,
                  lineHeight: 18,
                }}
                numberOfLines={5}
              >
                {releaseNotes}
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View
            style={{
              flexDirection: "row",
              width: "100%",
              gap: 12,
            }}
          >
            {!isRequired && (
              <TouchableOpacity
                onPress={onDismiss}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: theme.colors.primaryLight,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    textAlign: "center",
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  Later
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleUpdate}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: theme.colors.accentDark,
              }}
            >
              <Text
                style={{
                  color: theme.colors.primaryDark,
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                Update Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
