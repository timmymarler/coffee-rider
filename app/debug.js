// app/debug.js
import { router } from "expo-router";

export default function Debug() {
  console.log("ROUTES MANIFEST:", router.getRoutes());
  return null;
}
