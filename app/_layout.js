import { Stack } from "expo-router";
import { BannerProvider } from "../context/BannerContext";

export default function RootLayout() {
  return (
    <BannerProvider>
      <>
        <Stack screenOptions={{ headerShown: false }} />
      </>
    </BannerProvider>
  );
}
