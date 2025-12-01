// core/components/ui/Input.js

import { getTheme } from "@themes";
import { StyleSheet, Text, TextInput, View } from "react-native";

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = "none",
}) {
  const theme = getTheme();

  return (
    <View style={styles(theme).wrapper}>
      {label && <Text style={styles(theme).label}>{label}</Text>}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inputPlaceholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={styles(theme).input}
      />
    </View>
  );
}

const styles = (theme) =>
  StyleSheet.create({
    wrapper: {
      marginBottom: 16,
    },
    label: {
      marginBottom: 6,
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "600",
    },
    input: {
      height: 48,
      backgroundColor: theme.colors.inputBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.colors.inputText,
    },
  });
