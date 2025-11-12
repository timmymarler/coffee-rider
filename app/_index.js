import { View, Text } from "react-native";
import { useEffect, useState } from "react";
import { db } from "../config/firebase"; // go up one level to config folder
import { collection, getDocs } from "firebase/firestore";
import { Buffer } from "buffer";
global.Buffer = Buffer;


export default function Page() {
  const [status, setStatus] = useState("Connecting to Firebase...");

  useEffect(() => {
    const testFirebase = async () => {
      try {
        const snapshot = await getDocs(collection(db, "test"));
        setStatus(`✅ Connected! Found ${snapshot.size} docs in 'test'`);
      } catch (error) {
        setStatus(`❌ Connection failed: ${error.message}`);
      }
    };
    testFirebase();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 18, textAlign: "center" }}>{status}</Text>
    </View>
  );
}