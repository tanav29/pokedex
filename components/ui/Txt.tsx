import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/**
 * Every piece of type in the app goes through here so the two-family system holds.
 *
 * Outfit carries names, headings and prose. Martian Mono is reserved for machine
 * readouts — dex numbers, HP values, XP counters, quantities — where a fixed pitch
 * makes changing digits legible. Using mono for everything would flatten that
 * distinction, so there is a separate `Mono` rather than a weight prop.
 */

export type Weight = "regular" | "medium" | "semibold" | "bold" | "black";

const OUTFIT: Record<Weight, string> = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
  black: "Outfit_800ExtraBold",
};

const MONO: Record<Weight, string> = {
  regular: "MartianMono_400Regular",
  medium: "MartianMono_500Medium",
  semibold: "MartianMono_600SemiBold",
  bold: "MartianMono_700Bold",
  black: "MartianMono_800ExtraBold",
};

type TxtProps = RNTextProps & {
  w?: Weight;
  /** Fixed-pitch readout. Default text colour is the app's paper tone. */
  mono?: boolean;
  color?: string;
};

export function Txt({ w = "regular", mono = false, color, style, ...rest }: TxtProps) {
  const family = mono ? MONO[w] : OUTFIT[w];
  return (
    <RNText
      {...rest}
      style={[{ fontFamily: family, color: color ?? "#EDEAE0" }, style]}
    />
  );
}

/**
 * Small structural labels — section headers and field names. Kept as one component
 * so they stay consistent instead of every screen inventing its own eyebrow style.
 */
export function Label({ children, color = "#8B8FA6", className, style, ...rest }: TxtProps) {
  return (
    <Txt
      mono
      w="medium"
      color={color}
      // 10px with +0.08em tracking: legible as a label, never as a headline.
      className={className}
      style={[{ fontSize: 10, letterSpacing: 0.8 }, style]}
      {...rest}
    >
      {children}
    </Txt>
  );
}

/** Large numerals — HP, XP, level, coin counts. */
export function Figure({
  children,
  size = 16,
  color,
  w = "bold",
  style,
  ...rest
}: TxtProps & { size?: number }) {
  return (
    <Txt
      mono
      w={w}
      color={color}
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.25) }, style]}
      {...rest}
    >
      {children}
    </Txt>
  );
}
