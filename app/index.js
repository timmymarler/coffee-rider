import { Redirect } from "expo-router";
import { Buffer } from "buffer";
global.Buffer = Buffer;

export default function Index() {
  return <Redirect href="(tabs)/map" />;
}