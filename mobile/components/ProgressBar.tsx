import { View, StyleSheet } from "react-native";

interface ProgressBarProps {
  percent: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ percent, color = "#059669", height = 8 }: ProgressBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: "#f1f5f9",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
