import { View } from "react-native";
import { clamp } from "@/lib/format";

type Props = {
  /** 0..1 */
  value: number;
  color?: string;
  height?: number;
  /** Fades the fill out at low values so an empty bar does not shout. */
  trackColor?: string;
};

/**
 * Progress as a filled rule rather than a rounded pill — it reads as a gauge on
 * the field terminal, and a hairline track keeps it from competing with the
 * numbers sitting next to it.
 */
export function Track({
  value,
  color = "#E2483F",
  height = 6,
  trackColor = "#0E1017",
}: Props) {
  const ratio = clamp(value, 0, 1);

  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor,
        borderWidth: 1,
        borderColor: "#222638",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${ratio * 100}%`,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
