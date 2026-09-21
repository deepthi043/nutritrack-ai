import { Text, StyleSheet, Linking } from "react-native";
import { Card } from "../Card";
import { Button } from "../Button";
import { useActivityPermission } from "../../hooks/useActivityPermission";

const SOURCE_LABEL: Record<string, string> = {
  android_native: "your phone's step sensor",
  android_health: "Health Connect",
  ios_health: "Apple Health",
  mock: "Demo mode",
};

/**
 * Section 7: explains why activity permission is needed BEFORE requesting
 * it, and after a denial stops re-prompting the OS dialog — instead
 * pointing the user to device settings. Wraps its children (the real
 * Activity screen content) and only renders them once permission is
 * granted or the platform has no real provider (falls back to manual entry).
 */
export function PermissionGate({ children }: { children: React.ReactNode }) {
  const { state, isChecking, wasPreviouslyDenied, request, providerSource } = useActivityPermission();

  if (isChecking) return null; // parent screen shows its own loading state

  if (state === "granted" || state === "unavailable") {
    return <>{children}</>;
  }

  // state === "denied"
  if (wasPreviouslyDenied) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Activity permission was not granted.</Text>
        <Text style={styles.body}>
          You can continue using NutriTrack, but automatic step synchronization is unavailable. You can add
          activity manually instead, or enable permission in your device settings.
        </Text>
        <Button
          label="Open device settings"
          variant="outline"
          onPress={() => Linking.openSettings()}
          style={styles.button}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Connect Activity Data</Text>
      <Text style={styles.body}>
        {providerSource === "android_native"
          ? "NutriTrack AI reads your step count directly from your phone's built-in step sensor to track activity progress. Distance and active time are estimated from your steps — nothing is sent to Google Fit, Samsung Health, or any other app."
          : `NutriTrack AI can use your activity data from ${
              SOURCE_LABEL[providerSource] ?? "your device"
            } to track steps and activity progress. We only read step count, distance, and active minutes — nothing else, and nothing is written back to ${
              SOURCE_LABEL[providerSource] ?? "Health"
            }.`}
      </Text>
      <Button label="Connect Activity Data" onPress={request} style={styles.button} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  body: { fontSize: 14, color: "#475569", lineHeight: 20 },
  button: { marginTop: 8 },
});
