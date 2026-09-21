import { Text, StyleSheet } from "react-native";
import { Card } from "../Card";

interface ActivityStatCardProps {
  emoji: string;
  value: string;
  label: string;
}

export function ActivityStatCard({ emoji, value, label }: ActivityStatCardProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 20 },
  emoji: { fontSize: 22 },
  value: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  label: { fontSize: 12, color: "#64748b" },
});
