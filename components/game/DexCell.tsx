import { memo } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Txt } from "@/components/ui/Txt";
import { TypeChip } from "@/components/game/TypeChip";
import { TYPE_COLORS, homeSprite } from "@/convex/lib/gameLogic";

export type DexEntry = {
  pokemonId: number;
  name: string;
  types: string[];
  shiny: boolean;
  count: number;
};

/**
 * One square of the dex grid.
 *
 * Uncaught species keep their silhouette and number but lose their name — the
 * missing entries are the whole point of the collection, so they have to read as
 * absent rather than as empty. Caught-and-shiny gets the foil corner, which is
 * the only place in the grid that uses it.
 */
export const DexCell = memo(function DexCell({
  entry,
  caught,
  width,
  onPress,
}: {
  entry?: DexEntry;
  caught: DexEntry | null;
  width: number;
  onPress?: () => void;
}) {
  const id = caught?.pokemonId ?? entry?.pokemonId ?? 0;
  const types = caught?.types ?? entry?.types ?? [];
  const primary = types[0] ? TYPE_COLORS[types[0]] : "#2C3044";

  const body = (
    <View
      style={{
        width,
        height: width * 1.04,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: caught ? "#2C3044" : "#222638",
        backgroundColor: caught ? "#1D2030" : "#141620",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 6,
        gap: 2,
      }}
    >
      {caught ? (
        <>
          {/* Type wash bleeds from the top edge so the grid reads as colour-coded
              at a glance, without a chip on every tile. */}
          <View
            style={{
              position: "absolute",
              top: -width * 0.3,
              left: -width * 0.15,
              width: width * 1.3,
              height: width * 0.7,
              borderRadius: width,
              backgroundColor: primary,
              opacity: 0.16,
            }}
          />
          <Image
            source={{ uri: homeSprite(caught.pokemonId, caught.shiny) }}
            style={{ width: width * 0.78, height: width * 0.78 }}
            contentFit="contain"
            transition={160}
          />
          <Txt w="semibold" color="#EDEAE0" numberOfLines={1} style={{ fontSize: 11, paddingHorizontal: 3 }}>
            {caught.name}
          </Txt>
          <View className="flex-row gap-1">
            {types.slice(0, 2).map((type) => (
              <TypeChip key={type} type={type} size="sm" />
            ))}
          </View>

          {caught.shiny ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                backgroundColor: "#5FD3C4",
                borderBottomLeftRadius: 8,
                borderTopLeftRadius: 8,
                paddingHorizontal: 5,
                paddingVertical: 2,
              }}
            >
              <Ionicons name="sparkles" size={9} color="#141620" />
            </View>
          ) : null}

          {caught.count > 1 ? (
            <View style={{ position: "absolute", bottom: 5, right: 6 }}>
              <Txt mono w="bold" color="#5D6178" style={{ fontSize: 9 }}>
                ×{caught.count}
              </Txt>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Image
            source={{ uri: homeSprite(id, false) }}
            style={{ width: width * 0.72, height: width * 0.72, opacity: 0.13 }}
            contentFit="contain"
          />
          <Txt mono color="#3A3F55" style={{ fontSize: 10 }}>
            #{String(id).padStart(3, "0")}
          </Txt>
        </>
      )}
    </View>
  );

  if (!caught) return body;

  return (
    <Link href={{ pathname: "/details", params: { name: caught.name } }} asChild>
      <Pressable onPress={onPress}>{body}</Pressable>
    </Link>
  );
});
