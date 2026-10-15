import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { api } from "@/convex/_generated/api";
import { Txt, Label } from "@/components/ui/Txt";
import { Track } from "@/components/game/Track";
import { DexCell, type DexEntry } from "@/components/game/DexCell";
import { usePrimeSpeciesMeta } from "@/hooks/usePrimeSpeciesMeta";
import { TYPE_COLORS } from "@/convex/lib/gameLogic";
import * as haptics from "@/lib/haptics";

/**
 * The dex.
 *
 * It shows the whole reachable pool, not just what you own — the silhouette tiles
 * are the progress bar. Names come from the server's metadata cache in one read,
 * so a hundred tiles cost one query rather than a hundred; ownership is layered on
 * top by dex number.
 */
export default function Dex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const profile = useQuery(api.game.getProfile);
  const collection = useQuery(api.game.getCollection, { search: "" });
  const names = useQuery(api.game.getSpeciesNames, { from: 1, to: 151 });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Names for uncaught tiles arrive in the background; the grid renders without
  // them immediately and fills in as the cache warms.
  usePrimeSpeciesMeta(true);

  const poolCap = profile?.poolCap ?? 151;

  const caughtById = useMemo(() => {
    const map = new Map<number, DexEntry>();
    for (const entry of collection?.entries ?? []) map.set(entry.pokemonId, entry as DexEntry);
    return map;
  }, [collection]);

  const slots = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list: DexEntry[] = [];
    for (let id = 1; id <= poolCap; id++) {
      const caught = caughtById.get(id) ?? null;
      const name = caught?.name ?? names?.[id] ?? String(id);
      if (query && !name.toLowerCase().includes(query)) continue;
      if (typeFilter && !caught?.types.includes(typeFilter)) continue;
      list.push(caught ?? { pokemonId: id, name, types: [], shiny: false, count: 0 });
    }
    return list;
  }, [search, typeFilter, poolCap, caughtById, names]);

  const columns = width >= 700 ? 5 : width >= 420 ? 4 : 3;
  const gap = 10;
  const cellWidth = (width - 32 - gap * (columns - 1)) / columns;

  /**
   * "Battle" uses the species the trainer has caught most often — a crude but
   * honest proxy for their go-to Pokémon, and it avoids making them hunt through
   * the grid to pick a first opponent.
   */
  const battleBest = useCallback(() => {
    const best = (collection?.entries ?? []).reduce<DexEntry | null>((top, entry) => {
      const candidate = entry as DexEntry;
      return !top || candidate.count > top.count ? candidate : top;
    }, null);
    if (!best) {
      haptics.warn();
      return;
    }
    haptics.press();
    router.push({ pathname: "/battle", params: { name: best.name } });
  }, [collection, router]);

  const caughtCount = collection?.counts.species ?? 0;

  return (
    <View className="flex-1 bg-ink">
      <View style={{ paddingTop: insets.top + 8 }} className="px-4 pb-2">
        <View className="flex-row items-end justify-between">
          <View>
            <Label color="#5D6178">POKéDEX</Label>
            <Txt w="black" color="#EDEAE0" style={{ fontSize: 26 }}>
              {caughtCount}
              <Txt mono color="#5D6178" style={{ fontSize: 14 }}>
                {" "}
                / {poolCap}
              </Txt>
            </Txt>
          </View>

          <View className="flex-row items-center gap-3 pb-1.5">
            <View className="flex-row items-center gap-1">
              <Ionicons name="sparkles" size={12} color="#5FD3C4" />
              <Txt mono w="bold" color="#5FD3C4" style={{ fontSize: 12 }}>
                {collection?.counts.shinies ?? 0}
              </Txt>
            </View>
            <Link href="/favorites" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="heart-outline" size={17} color="#8B8FA6" />
              </Pressable>
            </Link>
            <Pressable
              onPress={battleBest}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#E2483F",
              }}
            >
              <Ionicons name="flash" size={12} color="#E2483F" />
              <Txt w="bold" color="#E2483F" style={{ fontSize: 12 }}>
                Battle
              </Txt>
            </Pressable>
          </View>
        </View>

        <View className="mt-3">
          <Track value={poolCap === 0 ? 0 : caughtCount / poolCap} color="#5FD3C4" height={5} />
        </View>

        <View className="flex-row items-center bg-ink-raised border border-ink-line rounded-cell px-3 mt-3">
          <Ionicons name="search" size={15} color="#5D6178" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search your dex"
            placeholderTextColor="#5D6178"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              marginLeft: 8,
              color: "#EDEAE0",
              fontFamily: "Outfit_400Regular",
              fontSize: 14,
              paddingVertical: 9,
            }}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#5D6178" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[null, ...Object.keys(TYPE_COLORS)]}
        keyExtractor={(item) => item ?? "all"}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}
        renderItem={({ item }) => {
          const active = item === typeFilter;
          return (
            <Pressable
              onPress={() => setTypeFilter(item)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 4,
                backgroundColor: item ? TYPE_COLORS[item] : "#1D2030",
                opacity: active ? 1 : 0.45,
              }}
            >
              <Txt w="semibold" color={item ? "#141620" : "#8B8FA6"} style={{ fontSize: 11 }}>
                {item ?? "All"}
              </Txt>
            </Pressable>
          );
        }}
      />

      <FlatList
        data={slots}
        key={`grid-${columns}`}
        numColumns={columns}
        keyExtractor={(item) => String(item.pokemonId)}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ gap, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => (
          <DexCell
            entry={item}
            caught={caughtById.get(item.pokemonId) ?? null}
            width={cellWidth}
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="search-outline" size={34} color="#2C3044" />
            <Txt color="#5D6178" className="mt-3">
              Nothing in the dex matches that.
            </Txt>
          </View>
        }
        ListFooterComponent={
          caughtCount > 0 ? (
            <View className="mt-6 px-1">
              <Label color="#5D6178">TAP A SPECIES TO OPEN ITS ENTRY</Label>
            </View>
          ) : (
            <View className="items-center py-10">
              <Txt color="#5D6178" className="text-center">
                Your dex is empty. Throw a ball to register your first species.
              </Txt>
            </View>
          )
        }
      />
    </View>
  );
}
