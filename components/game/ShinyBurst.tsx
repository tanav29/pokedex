import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

/**
 * A one-shot shower of foil squares for shiny reveals and level-ups.
 *
 * Deliberately not a particle library: 22 plain views with fixed-pitch physics is
 * enough to read as an event, costs nothing, and never fights the ball animation
 * running at the same moment in the same viewport.
 */

const PIECES = 22;
const COLORS = ["#5FD3C4", "#E9B23C", "#EDEAE0", "#E2483F"];
const TOTAL_MS = 1500;

type Piece = {
  x: number;
  delay: number;
  drift: number;
  size: number;
  color: string;
  spin: number;
};

/** Freshly seeded per burst so a replay never falls back to the same layout. */
function buildPieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    x: (i + 0.5) / PIECES,
    delay: (i % 5) * 70,
    drift: ((i % 3) - 1) * 34,
    size: 5 + (i % 3) * 3,
    color: COLORS[i % COLORS.length],
    spin: (i % 2 === 0 ? 1 : -1) * (180 + i * 24),
  }));
}

/** Remaps the shared 0..1 timeline onto each piece's own start time. */
function stagger(progress: Animated.Value, delayMs: number) {
  const start = Math.min(0.9, Math.max(0.001, delayMs / TOTAL_MS));
  return progress.interpolate({ inputRange: [0, start, 1], outputRange: [0, 0, 1] });
}

export function ShinyBurst({ trigger, width }: { trigger: number; width: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  // Derived, not stored: a new trigger means a new layout, and seeding it here
  // keeps the effect below to driving the animation only.
  const pieces = useMemo(() => (trigger > 0 ? buildPieces() : []), [trigger]);

  useEffect(() => {
    if (trigger <= 0) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: TOTAL_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [trigger, progress]);

  if (pieces.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => {
        const p = stagger(progress, piece.delay);
        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              left: piece.x * width,
              top: 0,
              width: piece.size,
              height: piece.size * 0.55,
              backgroundColor: piece.color,
              opacity: p.interpolate({
                inputRange: [0, 0.12, 0.75, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-24, 340] }) },
                { translateX: piece.drift },
                {
                  rotate: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", `${piece.spin}deg`],
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
