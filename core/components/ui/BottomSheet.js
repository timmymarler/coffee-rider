import { useTheme } from "@/core/context/ThemeContext";
import { View } from "react-native";

export default function BottomSheet({ children, style }) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.cardBackground,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderColor: theme.cardBorder,
          borderWidth: 1,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
