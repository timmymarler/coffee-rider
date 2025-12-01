import { useTheme } from "@/core/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

export default function TabBarIcon({ icon, focused }) {
  const theme = useTheme();

  return (
    <Ionicons
      name={focused ? icon : `${icon}-outline`}
      size={28}
      color={focused ? theme.brandPrimary : theme.textSecondary}
    />
  );
}
