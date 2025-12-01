import { useTheme } from "@/core/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

export default function IconButton({ icon, onPress, size = 26 }) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.buttonPrimary,
        padding: 10,
        borderRadius: 50,
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      <Ionicons
        name={icon}
        size={size}
        color={theme.buttonText}
      />
    </TouchableOpacity>
  );
}
