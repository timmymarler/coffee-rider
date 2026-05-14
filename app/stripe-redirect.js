import { Redirect } from 'expo-router';

export default function StripeRedirectScreen() {
  return <Redirect href="/subscriptions" />;
}
