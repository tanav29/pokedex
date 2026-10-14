import { Link } from "expo-router";
import { FlatList, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function Favorites() {
  const favorites = useQuery(api.favorites.getUserFavorites);

  if (!favorites) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4">Loading favorites...</Text>
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl text-gray-500">No favorite Pokemon yet</Text>
        <Text className="text-gray-400 mt-2">Go to a Pokemon details page to add favorites!</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: { pokemonName: string } }) => (
    <Link
      key={item.pokemonName}
      href={{ pathname: "/details", params: { name: item.pokemonName } }}
      asChild
    >
      <Pressable
        className="rounded-3xl p-3 flex-col items-center justify-center shadow-sm mb-4"
        style={{ backgroundColor: "#E4E4E7" }} // Placeholder, need to fetch types
      >
        <Text className="text-2xl opacity-80 font-bold capitalize">{item.pokemonName}</Text>
        <Text className="text-lg opacity-50 font-bold">Favorite</Text>
      </Pressable>
    </Link>
  );

  return (
    <FlatList
      data={favorites}
      renderItem={renderItem}
      keyExtractor={(item) => item.pokemonName}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <Text className="text-2xl font-bold mb-4">My Favorite Pokemon</Text>
      }
    />
  );
}
