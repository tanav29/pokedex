import { useEffect, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Txt, Label } from "@/components/ui/Txt";
import { TypeChip } from "@/components/game/TypeChip";
import { ShinyBurst } from "@/components/game/ShinyBurst";
import { TYPE_COLORS, homeSprite, type CatchResult } from "@/convex/lib/gameLogic";
import { formatNumber } from "@/lib/format";

/**
 * What a pull hands back.
 *
 * Two facts compete for attention — *what* it caught and *how new* it is — so
 * they are separated: the species sits on a type-washed plate, and the novelty
 * marker is a rotated stamp laid over the corner like a rubber stamp on a
 * specimen card. Shinies flip the whole plate to foil and fire the burst.
 */
export function RevealCard({
  result,
  onDismiss,
  burstKey,
  width,
}: {
  result: CatchResult;
  onDismiss: () => void;
  burstKey: number;
  width: number;
}) {
  const [enter] = useState(() => new Animated.Value(0));
  const { pokemon, shiny, isNew, xp, coins } = result;
  const plateColor = shiny
    ? "#5FD3C4"
    : pokemon.types[0]
      ? TYPE_COLORS[pokemon.types[0]]
      : "#8B8FA6";

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  return (
    <Pressable onPress={onDismiss} className="items-center">
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          ],
        }}
      >
        <View
          style={{
            width: Math.min(width - 48, 300),
            borderRadius: 18,
            borderWidth: 1,
            borderColor: shiny ? "#5FD3C4" : "#2C3044",
            backgroundColor: "#1D2030",
            overflow: "hidden",
          }}
        >
          <ShinyBurst trigger={burstKey} width={Math.min(width - 48, 300)} />

          <View style={{ height: 6, backgroundColor: plateColor }} />
          <View className="items-center px-5 pt-4 pb-5">
            <Label color="#5D6178">#{String(pokemon.id).padStart(3, "0")}</Label>

            <Image
              source={{ uri: homeSprite(pokemon.id, shiny) }}
              style={{ width: 168, height: 168, marginTop: 4 }}
              contentFit="contain"
            />

            <Txt w="black" color="#EDEAE0" style={{ fontSize: 27, marginTop: 2 }}>
              {pokemon.displayName}
            </Txt>

            <View className="flex-row gap-1.5 mt-2">
              {pokemon.types.map((type) => (
                <TypeChip key={type} type={type} />
              ))}
            </View>

            {shiny || isNew ? (
              <View
                style={{
                  marginTop: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: shiny ? "#5FD3C4" : "#E2483F",
                  transform: [{ rotate: "-3deg" }],
                }}
              >
                <Txt
                  mono
                  w="bold"
                  color="#141620"
                  style={{ fontSize: 11, letterSpacing: 1.2 }}
                >
                  {shiny ? "SHINY" : "NEW"}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-6 mt-4">
          <Figure icon="flash" tint="#E2483F" value={`+${formatNumber(xp)}`} caption="XP" />
          <Figure icon="flash" tint="#E9B23C" value={`+${formatNumber(coins)}`} caption="coins" />
        </View>

        <Txt color="#5D6178" style={{ fontSize: 12, marginTop: 14 }}>
          Tap to keep searching
        </Txt>
      </Animated.View>
    </Pressable>
  );
}

function Figure({
  icon,
  tint,
  value,
  caption,
}: {
  icon: string;
  tint: string;
  value: string;
  caption: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon as never} size={14} color={tint} />
      <Txt mono w="bold" color="#EDEAE0" style={{ fontSize: 16 }}>
        {value}
      </Txt>
      <Txt color="#5D6178" style={{ fontSize: 12 }}>
        {caption}
      </Txt>
    </View>
  );
}
