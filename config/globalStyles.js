import { StyleSheet } from "react-native";
import { theme } from "./theme";

export const globalStyles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },

  centeredScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },

  screenStandard: {
    backgroundColor: theme.colors.background,

  },

  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    alignSelf: "center",
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: theme.colors.primary,
    marginBottom: 6,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: 24,
    textAlign: "center",
  },

  errorText: {
    color: theme.colors.danger,
    marginBottom: 12,
    textAlign: "center",
  },
});
