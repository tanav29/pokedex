import { View, Text, ScrollView, Image, Switch, Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface PokemonDetails {
  name: string;
  sprites: {
    other: {
      home: {
        front_default: string;
        front_female: string;
        front_shiny: string;
        front_shiny_female: string;
      };
    };
    versions: any;
  };
  base_experience: number;
  species: {
    name: string;
    url: string;
  };
  id: number;
  types: { type: { name: string } }[];
  weight: number;
  height: number;
  order: number;
  abilities: { ability: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

const Details = () => {
  const { name } = useLocalSearchParams<{ name?: string | string[] }>();
  const pokemonName = Array.isArray(name) ? name[0] : name;
  const [pokemon, setPokemon] = useState<PokemonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [male, setMale] = useState(true);
  const [shiny, setShiny] = useState(false);

  const isFav = useQuery(
    api.favorites.isFavorite,
    pokemonName ? { pokemonName } : "skip",
  );
  const toggleFav = useMutation(api.favorites.toggleFavorite);

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

  const handleToggleFavorite = async () => {
    try {
      if (!pokemonName) return;
      await toggleFav({ pokemonName });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      normal: "#E4E4E7",
      fire: "#FFD6C9",
      water: "#CFE5FF",
      electric: "#FFE08A",
      grass: "#CDECCD",
      ice: "#CDEFF6",
      fighting: "#F4B8B8",
      poison: "#D9C2F0",
      ground: "#E6D3A3",
      flying: "#D6DCFF",
      psychic: "#FFC1D9",
      bug: "#DDE8B5",
      rock: "#D6CCB5",
      ghost: "#C9C3E6",
      dragon: "#C4B8FF",
      dark: "#C6C6C6",
      steel: "#D1D9E6",
      fairy: "#FFD1E6",
    };
    return colors[type] || "#E4E4E7";
  };

  const getCurrentSprites = () => {
    if (!pokemon)
      return {
        front: null,
        back: null,
      };
    if (!male && pokemon.sprites.other.home.front_female) {
      if (shiny) {
        return {
          img: pokemon.sprites.other.home.front_shiny_female,
        };
      }
      return {
        img: pokemon.sprites.other.home.front_female,
      };
    } else {
      if (shiny) {
        return {
          img: pokemon.sprites.other.home.front_shiny,
        };
      }
      return {
        img: pokemon.sprites.other.home.front_default,
      };
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Ionicons name="refresh-circle" size={48} color="#007AFF" />
        <Text className="text-xl mt-4">Loading...</Text>
      </View>
    );
  }

  if (!pokemon) {
    return (
      <View className="flex-1 justify-center items-center">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text className="text-xl mt-4">Pokemon not found</Text>
      </View>
    );
  }

  const sprites = getCurrentSprites();

  return (
    <>
      <Stack.Screen
        options={{
          title: pokemon.name.toLocaleUpperCase(),
          headerRight: () => (
            <View className="flex-row items-center mr-4 gap-2">
              <Pressable onPress={handleToggleFavorite}>
                <Ionicons
                  name={isFav ? "heart" : "heart-outline"}
                  size={24}
                  color={isFav ? "#EF4444" : "#6B7280"}
                />
              </Pressable>
              {pokemon.sprites.other.home.front_female && (
                <>
                  <Text className="mr-2 text-sm">F/M</Text>
                  <Switch value={male} onValueChange={() => setMale(!male)} />
                </>
              )}
            </View>
          ),
        }}
      />
      <ScrollView contentContainerClassName="p-4 gap-4">
        <Pressable
          onPressIn={() => setShiny(true)}
          onPressOut={() => setShiny(false)}
          className="relative flex items-center justify-center py-1"
          android_ripple={{ color: "rgba(0,0,0,0.15)" }}
        >
          <Text className="absolute top-4 left-4 text-neutral-400 text-2xl font-black rounded-md">
            #{pokemon.id}
          </Text>
          {shiny && (
            <Text className="absolute top-4 right-4 bg-yellow-200 text-yellow-800 text-sm px-3 py-1 rounded-md">
              SHINY
            </Text>
          )}
          <View>
            <Image
              key={sprites.img}
              source={{ uri: sprites.img }}
              style={{ width: 300, height: 300 }}
            />
          </View>
        </Pressable>

        <View className="gap-2">
          <View className="flex-row items-center mb-2">
            <Ionicons name="pricetag" size={20} color="#6B7280" />
            <Text className="text-xl font-bold ml-2">Types</Text>
          </View>
          <View className="flex-row gap-2">
            {pokemon.types.map((type, index) => (
              <View
                key={index}
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: getTypeColor(type.type.name) }}
              >
                <Text className="capitalize font-medium">{type.type.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center mb-2">
            <MaterialIcons name="straighten" size={20} color="#6B7280" />
            <Text className="text-xl font-bold ml-2">Physical Stats</Text>
          </View>
          <View className="flex-row justify-between">
            <Text>Height: {pokemon.height / 10} m</Text>
            <Text>Weight: {pokemon.weight / 10} kg</Text>
          </View>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center mb-2">
            <Ionicons name="flash" size={20} color="#6B7280" />
            <Text className="text-xl font-bold ml-2">Abilities</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {pokemon.abilities.map((ability, index) => (
              <View key={index} className="bg-gray-200 px-3 py-1 rounded-full">
                <Text className="capitalize">
                  {ability.ability.name.replace("-", " ")}
                </Text>
              </View>
            ))}
            <View className="bg-gray-200 px-3 py-1 rounded-full">
              <Text className="capitalize">Exp: {pokemon.base_experience}</Text>
            </View>
            <View className="bg-gray-200 px-3 py-1 rounded-full">
              <Text className="capitalize">Gen: {pokemon.order}</Text>
            </View>
          </View>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center mb-2">
            <Ionicons name="stats-chart" size={20} color="#6B7280" />
            <Text className="text-xl font-bold ml-2">Base Stats</Text>
          </View>
          {pokemon.stats.map((stat, index) => (
            <View key={index} className="flex-row justify-between items-center">
              <Text className="capitalize w-24">
                {stat.stat.name.replace("-", " ")}
              </Text>
              <View className="flex-1 bg-gray-200 rounded-full h-2 mx-2">
                <View
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(stat.base_stat / 255) * 100}%` }}
                />
              </View>
              <Text className="w-8 text-right">{stat.base_stat}</Text>
            </View>
          ))}
        </View>

        <View>
          <View className="flex-row items-center mb-2">
            <Ionicons name="stats-chart" size={20} color="#6B7280" />
            <Text className="text-xl font-bold ml-2">Generations</Text>
          </View>
          <View
            className="flex gap-3"
            style={{
              flexDirection: "row",
              overflowX: "scroll",
            }}
          >
            {Object.values(pokemon.sprites.versions).map((v: any) => (
              <Image
                key={(Object.values(v)[0] as any).front_default as string}
                source={{ uri: (Object.values(v)[0] as any).front_default }}
                style={{ width: 50, height: 50 }}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
};

export default Details;
