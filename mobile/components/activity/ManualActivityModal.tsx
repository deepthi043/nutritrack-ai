import { useState } from "react";
import { Modal, View, Text, TextInput, StyleSheet } from "react-native";
import { Button } from "../Button";
import { syncActivity } from "../../services/activityService";
import { getApiErrorMessage } from "../../services/api";

interface ManualActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Manual activity entry — only ever offered as a fallback when real
 * platform activity data is unavailable (permission denied, unsupported
 * device). Always clearly labeled as demo/manual data, per section 12 —
 * never presented as real sensor tracking.
 */
export function ManualActivityModal({ visible, onClose, onSaved }: ManualActivityModalProps) {
  const [steps, setSteps] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [activeMinutes, setActiveMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const stepsNum = Number(steps);
    if (!Number.isFinite(stepsNum) || stepsNum < 0) {
      setError("Enter a valid, non-negative step count.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await syncActivity({
        date: new Date().toISOString().slice(0, 10),
        steps: stepsNum,
        distance_km: Number(distanceKm) || 0,
        active_minutes: Number(activeMinutes) || 0,
        source: "mock",
      });
      setSteps("");
      setDistanceKm("");
      setActiveMinutes("");
      onSaved();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Add Activity Manually</Text>
          <Text style={styles.badge}>Development / Demo Activity Data — not real sensor tracking</Text>

          <Text style={styles.label}>Steps</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={steps} onChangeText={setSteps} placeholder="0" />

          <Text style={styles.label}>Distance (km)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={distanceKm}
            onChangeText={setDistanceKm}
            placeholder="0.0"
          />

          <Text style={styles.label}>Active minutes</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={activeMinutes}
            onChangeText={setActiveMinutes}
            placeholder="0"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} disabled={isSaving} style={styles.actionButton} />
            <Button label="Save" onPress={handleSave} isLoading={isSaving} style={styles.actionButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  badge: {
    fontSize: 12,
    color: "#92400e",
    backgroundColor: "#fef3c7",
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
  },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  actionButton: { flex: 1 },
});
