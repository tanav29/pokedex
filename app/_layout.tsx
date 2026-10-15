import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import "./globals.css";
import * as SecureStore from "expo-secure-store";
import { Platform, ActivityIndicator, View } from "react-native";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";
import {
  MartianMono_400Regular,
  MartianMono_500Medium,
  MartianMono_600SemiBold,
  MartianMono_700Bold,
  MartianMono_800ExtraBold,
} from "@expo-google-fonts/martian-mono";

// Holding the splash until the two families are registered avoids a frame of
// fallback system type on first paint, which is very visible on the pull screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_CONVEX_URL. Run `npm run convex` once to populate .env.local, then restart Expo.",
  );
}

// Fast Refresh re-evaluates this module on every file edit. Constructing a new
// ConvexReactClient each time opens another websocket and leaves the previous
// client (and its reconnect timers) running, which shows up as endless
// "reconnecting" / "websocket disconnected" messages. Cache the client on
// globalThis so a refresh reuses the one existing connection.
const globalForConvex = globalThis as unknown as {
  __convexClient?: ConvexReactClient;
};
const convex =
  globalForConvex.__convexClient ??
  (globalForConvex.__convexClient = new ConvexReactClient(convexUrl, {
    unsavedChangesWarning: false,
  }));

function AuthenticatedLayout({ ready }: { ready: boolean }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (!ready || isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-ink">
        <ActivityIndicator size="large" color="#E2483F" />
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
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#141620" },
        headerTintColor: "#EDEAE0",
        headerTitleStyle: { fontFamily: "Outfit_700Bold", fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#141620" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="details" options={{ title: "Pokédex entry" }} />
      <Stack.Screen name="battle" options={{ title: "Battle", headerShown: false }} />
      <Stack.Screen name="favorites" options={{ title: "Favourites" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    MartianMono_400Regular,
    MartianMono_500Medium,
    MartianMono_600SemiBold,
    MartianMono_700Bold,
    MartianMono_800ExtraBold,
  });

  // `fontError` is swallowed deliberately: a missing face degrades to the system
  // font, which is survivable. Blocking on it would leave a permanent spinner.
  void fontError;
  const ready = fontsLoaded === true;

  if (ready) {
    SplashScreen.hideAsync().catch(() => {});
  }

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
        <AuthenticatedLayout ready={ready} />
      </QueryClientProvider>
    </ConvexAuthProvider>
  );
}
