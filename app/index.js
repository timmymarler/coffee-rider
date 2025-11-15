import { Buffer } from "buffer";
import { Redirect } from "expo-router";
global.Buffer = Buffer;

export default function Index() {
  return <Redirect href="/(tabs)/map" />;
}