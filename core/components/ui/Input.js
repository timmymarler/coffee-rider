import { theme } from "@config/theme";
import { StyleSheet, TextInput, View } from "react-native";

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  style,
  inputStyle,
  ...props
}) {
  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={[styles.input, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.placeholder,
    fontSize: 16,
  },
});
