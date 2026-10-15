import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Txt, Label } from "@/components/ui/Txt";
import { Track } from "@/components/game/Track";
import { TypeChip } from "@/components/game/TypeChip";
import * as haptics from "@/lib/haptics";

/**
 * A Pokédex entry.
 *
 * The ownership banner at the top is the important part: it is the one place a
 * player sees what a species is worth to them, and whether the better form is
 * still out there. Everything below is reference data and stays flat and quiet.
 */

interface PokemonDetails {
  name: string;
  id: number;
  sprites: {
    other: {
      home: {
        front_default: string;
        front_female: string;
        front_shiny: string;
        front_shiny_female: string;
      };
    };
    versions: Record<string, Record<string, { front_default: string }>>;
  };
  base_experience: number;
  types: { type: { name: string } }[];
  weight: number;
  height: number;
  order: number;
  abilities: { ability: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

export default function Details() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string | string[] }>();
  const pokemonName = Array.isArray(name) ? name[0] : name;

  const [pokemon, setPokemon] = useState<PokemonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [male, setMale] = useState(true);
  const [shiny, setShiny] = useState(false);

  const isFav = useQuery(api.favorites.isFavorite, pokemonName ? { pokemonName } : "skip");
  const toggleFav = useMutation(api.favorites.toggleFavorite);
  const collection = useQuery(api.game.getCollection, { search: "" });

  const entry = collection?.entries.find((item) => item.name === pokemonName) ?? null;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadPokemon() {
      setLoading(true);
      setPokemon(null);
      if (!pokemonName) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(pokemonName)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`PokéAPI returned ${response.status}`);
        const data: PokemonDetails = await response.json();
        if (!cancelled) setPokemon(data);
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          console.error("Failed to load Pokémon details:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPokemon();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pokemonName]);

  async function handleToggleFavorite() {
    if (!pokemonName) return;
    try {
      await toggleFav({ pokemonName });
      haptics.press();
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }

  function currentSprite() {
    if (!pokemon) return null;
    const home = pokemon.sprites.other.home;
    const female = !male && home.front_female;
    if (shiny) return female ? home.front_shiny_female : home.front_shiny;
    return female ? home.front_female : home.front_default;
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Ionicons name="refresh-circle" size={40} color="#E2483F" />
        <Txt color="#8B8FA6" className="mt-3">
          Loading entry…
        </Txt>
      </View>
    );
  }

  if (!pokemon) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Ionicons name="alert-circle-outline" size={40} color="#E2483F" />
        <Txt color="#EDEAE0" className="mt-3">
          Pokémon not found
        </Txt>
      </View>
    );
  }

  const sprite = currentSprite();
  const hasFemale = !!pokemon.sprites.other.home.front_female;

  return (
    <>
      <Stack.Screen
        options={{
          title: pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1),
          headerRight: () => (
            <Pressable onPress={handleToggleFavorite} hitSlop={10}>
              <Ionicons
                name={isFav ? "heart" : "heart-outline"}
                size={22}
                color={isFav ? "#E2483F" : "#8B8FA6"}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View className="flex-row items-center justify-between">
          <Txt mono w="bold" color="#5D6178" style={{ fontSize: 15 }}>
            #{String(pokemon.id).padStart(3, "0")}
          </Txt>
          <View className="flex-row items-center gap-2">
            {hasFemale ? (
              <>
                <Txt mono color="#5D6178" style={{ fontSize: 11 }}>
                  {male ? "M" : "F"}
                </Txt>
                <Switch value={male} onValueChange={setMale} trackColor={{ true: "#8E2F2A" }} />
              </>
            ) : null}
          </View>
        </View>

        <Pressable
          onPressIn={() => setShiny(true)}
          onPressOut={() => setShiny(false)}
          className="items-center py-2"
          android_ripple={{ color: "rgba(255,255,255,0.08)" }}
        >
          {sprite ? (
            <Image
              source={{ uri: sprite }}
              style={{ width: 240, height: 240 }}
              contentFit="contain"
            />
          ) : null}
          {shiny ? (
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 24,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: "#5FD3C4",
              }}
            >
              <Txt mono w="bold" color="#141620" style={{ fontSize: 11, letterSpacing: 1.2 }}>
                SHINY
              </Txt>
            </View>
          ) : null}
          <Txt color="#5D6178" style={{ fontSize: 11 }}>
            Press and hold to preview the shiny form
          </Txt>
        </Pressable>

        <View className="flex-row justify-center gap-1.5">
          {pokemon.types.map((type) => (
            <TypeChip key={type.type.name} type={type.type.name} />
          ))}
        </View>

        {/* Ownership — the only part of this screen that is about the player. */}
        <View className="mt-5 border border-ink-line rounded-cell bg-ink-raised p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Label color="#5D6178">IN YOUR DEX</Label>
            {entry ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="ellipse-outline" size={12} color="#8B8FA6" />
                <Txt mono w="bold" color="#EDEAE0" style={{ fontSize: 13 }}>
                  {entry.count}
                </Txt>
              </View>
            ) : null}
          </View>

          {entry ? (
            <>
              <Track value={1} color="#5FD3C4" height={4} />
              <Txt color="#8B8FA6" style={{ fontSize: 12 }}>
                {entry.shiny
                  ? "Shiny form recorded. It stays yours."
                  : "No shiny form yet — keep throwing."}
              </Txt>
              <Pressable
                onPress={() => {
                  haptics.press();
                  router.push({ pathname: "/battle", params: { name: pokemon.name } });
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 11,
                  borderRadius: 10,
                  backgroundColor: "#E2483F",
                }}
              >
                <Ionicons name="flash" size={14} color="#141620" />
                <Txt w="bold" color="#141620" style={{ fontSize: 14 }}>
                  Send to battle
                </Txt>
              </Pressable>
            </>
          ) : (
            <Txt color="#8B8FA6" style={{ fontSize: 13 }}>
              Not caught yet. Throw a ball to register this species in your dex.
            </Txt>
          )}
        </View>

        <Section icon="stats-chart" title="Base stats">
          {pokemon.stats.map((stat, index) => (
            <View
              key={index}
              className="flex-row items-center gap-3"
              style={{ marginBottom: index === pokemon.stats.length - 1 ? 0 : 10 }}
            >
              <Txt color="#8B8FA6" style={{ fontSize: 12, width: 62 }}>
                {stat.stat.name.replace("-", " ")}
              </Txt>
              <View style={{ flex: 1 }}>
                <Track value={stat.base_stat / 255} color="#E2483F" height={5} />
              </View>
              <Txt mono color="#EDEAE0" style={{ fontSize: 12, width: 28, textAlign: "right" }}>
                {stat.base_stat}
              </Txt>
            </View>
          ))}
        </Section>

        <Section icon="flash" title="Abilities">
          <View className="flex-row flex-wrap gap-1.5">
            {pokemon.abilities.map((ability, index) => (
              <TypeChip key={index} type={ability.ability.name.replace("-", " ")} muted />
            ))}
          </View>
        </Section>

        <Section icon="straighten" title="Physical">
          <View className="flex-row justify-between">
            <Txt color="#8B8FA6" style={{ fontSize: 13 }}>
              Height {pokemon.height / 10} m
            </Txt>
            <Txt color="#8B8FA6" style={{ fontSize: 13 }}>
              Weight {(pokemon.weight / 10).toFixed(1)} kg
            </Txt>
          </View>
          <View className="flex-row justify-between mt-2">
            <Txt color="#8B8FA6" style={{ fontSize: 13 }}>
              Base exp {pokemon.base_experience ?? "—"}
            </Txt>
            <Txt color="#8B8FA6" style={{ fontSize: 13 }}>
              Gen {pokemon.order}
            </Txt>
          </View>
        </Section>
      </ScrollView>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name={icon as never} size={15} color="#5D6178" />
        <Label color="#8B8FA6">{title.toUpperCase()}</Label>
      </View>
      {children}
    </View>
  );
}
