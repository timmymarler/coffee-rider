import { Stack } from "expo-router";
import LoginScreen from "./login";
import RegisterScreen from "./register";

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
        component={LoginScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen 
        name="register"
        component={RegisterScreen}
        options={{
          animationEnabled: true,
        }}
      />
    </Stack>
  );
}
