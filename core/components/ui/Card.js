import { useTheme } from "@/core/context/ThemeContext";
import { Text, View } from "react-native";

export default function Card({ children, style }) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.cardBackground,
          borderRadius: 12,
          padding: 12,
          borderColor: theme.cardBorder,
          borderWidth: 1,
          shadowColor: theme.shadow,
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        },
        style,
      ]}
    >
      <Text style={{ color: theme.textPrimary }}>{children}</Text>
    </View>
  );
}
