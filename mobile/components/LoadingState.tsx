import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#059669" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 48 },
  text: { color: "#64748b", fontSize: 14 },
});
