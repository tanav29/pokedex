import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import "./globals.css";
import * as SecureStore from "expo-secure-store";
import { Platform , ActivityIndicator, View } from "react-native";
import { ConvexAuthProvider, useAuth } from "@convex-dev/auth/react";

const queryClient = new QueryClient();

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function AuthenticatedLayout() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack>
        <Stack.Screen name="signin" options={{ headerShown: false }} />
      </Stack>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="details"
        options={{
          title: "Details",
        }}
      />
      <Stack.Screen
        name="favorites"
        options={{
          title: "Favorites",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ConvexAuthProvider
      client={convex}
      storage={
        Platform.OS === "android" || Platform.OS === "ios"
          ? secureStorage
          : undefined
      }
    >
      <QueryClientProvider client={queryClient}>
        <AuthenticatedLayout />
      </QueryClientProvider>
    </ConvexAuthProvider>
  );
}
