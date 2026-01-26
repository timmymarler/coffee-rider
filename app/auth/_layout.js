import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="login"
    >
      <Stack.Screen 
        name="login"
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen 
        name="register"
        options={{
          animationEnabled: true,
        }}
      />
    </Stack>
  );
}
