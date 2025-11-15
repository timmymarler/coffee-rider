// app/_layout.js
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppHeader from "../components/AppHeader";
import Banner from "../components/Banner";
import { AuthProvider } from "../context/AuthContext";
import { BannerProvider } from "../context/BannerContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BannerProvider>
          <AppHeader />
          <Banner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/login" />
          </Stack>
        </BannerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
