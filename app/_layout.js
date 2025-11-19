import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from "expo-router";
import AuthProvider from "../context/AuthContext";
import RoleProvider from "../context/RoleContext";

export default function RootLayout() {
const [loaded] = useFonts(Ionicons.font);
if (!loaded) return null;
  return (
    <AuthProvider>
      <RoleProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </RoleProvider>
    </AuthProvider>
  );
}
