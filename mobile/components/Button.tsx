import { Pressable, Text, ActivityIndicator, StyleSheet, type PressableProps } from "react-native";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: "primary" | "outline" | "ghost";
  isLoading?: boolean;
}

const COLORS = {
  primary: { bg: "#059669", text: "#ffffff", border: "#059669" },
  outline: { bg: "transparent", text: "#334155", border: "#cbd5e1" },
  ghost: { bg: "transparent", text: "#475569", border: "transparent" },
};

export function Button({ label, variant = "primary", isLoading, disabled, style, ...rest }: ButtonProps) {
  const colors = COLORS[variant];
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 },
        style as object,
      ]}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
});
