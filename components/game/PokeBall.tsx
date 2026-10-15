import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { BallId } from "@/convex/lib/gameLogic";

/**
 * The ball.
 *
 * This is the one place the app spends its visual budget: the pull screen around
 * it stays flat and quiet so the shake, the split and the reveal land. Everything
 * here is built from plain views so it renders identically on web and native.
 *
 * Phases are driven by the parent — the ball never runs its own timer, which
 * keeps the pull sequence and the network result in one state machine.
 */

export type BallPhase = "idle" | "shaking" | "opening" | "open";

type BallSkin = { top: string; bottom: string; band: string; button: string; ring: string };

const SKINS: Record<BallId, BallSkin> = {
  // Poké Ball — red over white.
  poke: { top: "#E2483F", bottom: "#EDEAE0", band: "#141620", button: "#EDEAE0", ring: "#141620" },
  // Great Ball — the red half drops to blue with a white base.
  great: { top: "#3D8FD6", bottom: "#EDEAE0", band: "#3D8FD6", button: "#EDEAE0", ring: "#141620" },
  // Ultra Ball — near-black cap over a gold base.
  ultra: { top: "#141620", bottom: "#E9B23C", band: "#141620", button: "#E9B23C", ring: "#141620" },
};

type Props = {
  tier: BallId;
  phase: BallPhase;
  size?: number;
};

export function PokeBall({ tier, phase, size = 176 }: Props) {
  const skin = SKINS[tier];

  // Lazy `useState` rather than `useRef(...).current`: both create the value once,
  // but only one of them keeps the React Compiler's render-purity check happy.
  const [shake] = useState(() => new Animated.Value(0));
  const [open] = useState(() => new Animated.Value(0));

  const half = size / 2;
  // Scaled off the ball so the button and band stay proportional at any size.
  const bandHeight = Math.max(4, size * 0.052);
  const buttonSize = size * 0.3;
  const buttonCore = size * 0.15;

  const transform = useMemo(
    () => [
      {
        rotate: shake.interpolate({
          inputRange: [0, 1, 2, 3, 4],
          outputRange: ["0deg", "-11deg", "11deg", "-9deg", "0deg"],
        }),
      },
      {
        translateY: shake.interpolate({
          inputRange: [0, 1, 2, 3, 4],
          outputRange: [0, -size * 0.03, 0, -size * 0.03, 0],
        }),
      },
      { scale: shake.interpolate({ inputRange: [0, 4], outputRange: [1, 1.06] }) },
    ],
    [shake, size],
  );

  useEffect(() => {
    if (phase === "shaking") {
      shake.setValue(0);
      Animated.timing(shake, {
        toValue: 4,
        duration: 620,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    }
  }, [phase, shake]);

  useEffect(() => {
    if (phase === "opening" || phase === "open") {
      Animated.timing(open, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      open.setValue(0);
    }
  }, [phase, open]);

  const topStyle = {
    backgroundColor: skin.top,
    borderTopLeftRadius: half,
    borderTopRightRadius: half,
    transform: [
      {
        translateY: open.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -size * 0.34],
        }),
      },
      {
        rotate: open.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "-26deg"],
        }),
      },
    ],
  };

  const bottomStyle = {
    backgroundColor: skin.bottom,
    borderBottomLeftRadius: half,
    borderBottomRightRadius: half,
    transform: [
      {
        translateY: open.interpolate({
          inputRange: [0, 1],
          outputRange: [0, size * 0.34],
        }),
      },
      {
        rotate: open.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "26deg"],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[{ width: size, height: size }, transform]}>
      <View style={styles.halves}>        <Animated.View style={[styles.half, topStyle]} />
        <Animated.View style={[styles.half, bottomStyle]} />
      </View>

      <Animated.View
        style={[
          styles.centered,
          {
            height: bandHeight,
            backgroundColor: skin.band,
            transform: [
              { translateX: -size / 2 },
              { translateY: -bandHeight / 2 },
              {
                scaleX: open.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }),
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.centered,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: skin.button,
            borderColor: skin.ring,
            transform: [
              { translateX: -buttonSize / 2 },
              { translateY: -buttonSize / 2 },
              {
                scale: open.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }),
              },
            ],
          },
        ]}
      >
        <View
          style={{
            width: buttonCore,
            height: buttonCore,
            borderRadius: buttonCore / 2,
            backgroundColor: skin.ring,
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halves: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  half: { position: "absolute", left: 0, width: "100%", height: "50%" },
  centered: { position: "absolute", top: "50%", left: "50%" },
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
  },
});
