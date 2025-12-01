// config/globalStyles.js

import { getTheme } from "@themes";
import { StyleSheet } from "react-native";

const theme = getTheme();

export const globalStyles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: theme.colors.background,
  },

  centeredScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },

  card: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },

  errorText: {
    color: theme.colors.danger,
    textAlign: "center",
  },
});
