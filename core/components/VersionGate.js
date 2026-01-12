import theme from "@themes";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function VersionGate({ visible, forced, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Update Available</Text>

          <Text style={styles.body}>
            {forced
              ? "This version of Coffee Rider is no longer supported. Please uninstall it and install the latest version to continue."
              : "A newer version of Coffee Rider is available. Please upgrade to get the latest fixes and improvements."}
          </Text>

          <Pressable
            style={styles.primary}
            onPress={() =>
              Linking.openURL("https://drive.google.com/drive/folders/1w6FK9Vp7J3m2lgY7z9LRl2h8RxPFEuC8?usp=drive_link")
            }
          >
            <Text style={styles.primaryText}>Download Latest Version</Text>
          </Pressable>

          {!forced && (
            <Pressable onPress={onClose}>
              <Text style={styles.later}>Maybe Later</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  card: {
    width: "100%",
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.primary,
    marginBottom: 12,
    textAlign: "center",
  },

  body: {
    fontSize: 15,
    color: theme.colors.primaryLight,
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 22,
  },

  primary: {
    backgroundColor: theme.colors.accentDark,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    width: "100%",
    marginBottom: 12,
  },

  primaryText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 15,
  },

  later: {
    color: theme.colors.primaryLight,
    opacity: 0.7,
    fontSize: 13,
  },
});
