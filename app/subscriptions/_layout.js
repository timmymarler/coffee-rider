import { Stack } from 'expo-router';

export default function SubscriptionsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Pro Subscription',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="manage"
        options={{
          title: 'Manage Subscription',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
