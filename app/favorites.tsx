import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { Txt, Label } from "@/components/ui/Txt";
import { TypeChip } from "@/components/game/TypeChip";
import { homeSprite } from "@/convex/lib/gameLogic";
import { formatNumber } from "@/lib/format";

/**
 * Favourites.
 *
 * These are a hand-picked shortlist rather than a copy of the dex, so they get
 * the trainer's own artwork and their real pull count instead of a grid tile.
 */
export default function Favorites() {
  const favorites = useQuery(api.favorites.getUserFavorites);
  const collection = useQuery(api.game.getCollection, { search: "" });
  const { width } = useWindowDimensions();

  const names = (favorites ?? []).map((fav) => fav.pokemonName);

  const entries = names
    .map((name) => collection?.entries.find((entry) => entry.name === name))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  const columns = width >= 700 ? 4 : width >= 420 ? 3 : 2;
  const gap = 12;
  const cardWidth = (width - 32 - gap * (columns - 1)) / columns;

  if (favorites === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Txt color="#5D6178">Loading favourites…</Txt>
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-ink px-10">
        <Ionicons name="heart-outline" size={36} color="#2C3044" />
        <Txt w="semibold" color="#EDEAE0" className="mt-4">
          No favourites yet
        </Txt>
        <Txt color="#5D6178" className="mt-1 text-center">
          Open any species in your dex and tap the heart to keep it here.
        </Txt>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-ink"
      data={entries}
      key={`favs-${columns}`}
      numColumns={columns}
      keyExtractor={(item) => item.name}
      columnWrapperStyle={{ gap }}
      contentContainerStyle={{
        gap,
        padding: 16,
        paddingBottom: 40,
      }}
      ListHeaderComponent={
        <View className="mb-1" style={{ width: "100%" }}>
          <Label color="#5D6178">SHORTLIST</Label>
          <Txt w="black" color="#EDEAE0" style={{ fontSize: 24 }}>
            {favorites.length} kept
          </Txt>
        </View>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: "/details", params: { name: item.name } }} asChild>
          <Pressable
            style={{
              width: cardWidth,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: item.shiny ? "#2E6B66" : "#2C3044",
              backgroundColor: "#1D2030",
              padding: 12,
              alignItems: "center",
              gap: 6,
            }}
          >
            <Image
              source={{ uri: homeSprite(item.pokemonId, item.shiny) }}
              style={{ width: cardWidth * 0.7, height: cardWidth * 0.7 }}
              contentFit="contain"
            />
            <Txt w="bold" color="#EDEAE0" style={{ fontSize: 14 }}>
              {item.name}
            </Txt>
            <View className="flex-row gap-1">
              {item.types.slice(0, 2).map((type) => (
                <TypeChip key={type} type={type} size="sm" />
              ))}
            </View>
            <View className="flex-row items-center gap-1 mt-1">
              <Ionicons name="ellipse-outline" size={11} color="#5D6178" />
              <Txt mono color="#5D6178" style={{ fontSize: 11 }}>
                {formatNumber(item.count)}
              </Txt>
              {item.shiny ? (
                <Ionicons name="sparkles" size={11} color="#5FD3C4" style={{ marginLeft: 4 }} />
              ) : null}
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}
