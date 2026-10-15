import { useAuthActions } from "@convex-dev/auth/react";
import { View, Text, Button, Platform, Alert } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import { openAuthSessionAsync } from "expo-web-browser";
import { useRouter } from "expo-router";

export function SignIn() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const handleSignIn = async () => {
    // Resolved per tap rather than at module scope: `makeRedirectUri()` reads
    // native module state (expo-constants) that is not reliably populated while
    // this module is first evaluated during Fast Refresh.
    const redirectTo = makeRedirectUri();

    try {
      const { redirect } = await signIn("google", { redirectTo });
      if (!redirect) {
        throw new Error("Convex returned no sign-in redirect URL.");
      }

      if (Platform.OS === "web") {
        window.location.assign(redirect.toString());
        return;
      }

      const result = await openAuthSessionAsync(redirect.toString(), redirectTo);

      // Android resolves this with a non-"success" type for several unrelated
      // reasons (user backed out, the Custom Tab raced away, no browser can
      // handle the intent). Surfacing the reason is the only way to tell them
      // apart -- previously every one of them was a silent no-op.
      if (result.type !== "success") {
        throw new Error(`Auth session ended with "${result.type}".`);
      }

      const code = new URL(result.url).searchParams.get("code");
      if (!code) {
        throw new Error("The sign-in callback did not include a code.");
      }

      await signIn("google", { code });
      router.replace("/(tabs)");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Google sign-in failed:", message);
      Alert.alert("Sign-in failed", message);
    }
  };

  return (
    <View className="w-full max-w-sm">
      <Text className="text-2xl font-bold text-center mb-6">Sign In</Text>
      <Button onPress={handleSignIn} title="Sign in with Google" />
    </View>
  );
}
