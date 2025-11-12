import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from "react";
import { db } from "./config/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function App() {
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
    <View style={styles.container}>
      <Text>{status}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});