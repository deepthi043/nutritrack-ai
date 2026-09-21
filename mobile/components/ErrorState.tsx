import { View, Text, StyleSheet } from "react-native";
import { Button } from "./Button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong.", onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {onRetry && <Button label="Try again" variant="outline" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: "#fef2f2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  text: { color: "#b91c1c", fontSize: 14, textAlign: "center" },
});
