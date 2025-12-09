// core/components/ui/CRInput.js

import theme from "@themes";
import { TextInput, View } from "react-native";

export function CRInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
  style,
  textStyle,
}) {

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.primaryMid,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        },
        style,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.accentDark}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={[
          {
            fontSize: theme.typography.md,
            color: theme.colors.textMuted,
            padding: 0,
            margin: 0,
          },
          textStyle,
        ]}
      />
    </View>
  );
}
