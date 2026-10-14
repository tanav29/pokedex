import { useAuthActions } from "@convex-dev/auth/react";
import { View, Text, Button, Platform, Alert } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import { openAuthSessionAsync } from "expo-web-browser";
import { useRouter } from "expo-router";

const redirectTo = makeRedirectUri();

export function SignIn() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      const { redirect } = await signIn("google", { redirectTo });
      if (!redirect) return;

      if (Platform.OS === "web") {
        window.location.assign(redirect.toString());
        return;
      }

      const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
      if (result.type === "success") {
        const code = new URL(result.url).searchParams.get("code");
        if (!code) throw new Error("The sign-in callback did not include a code.");
        await signIn("google", { code });
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.error("Google sign-in failed:", error);
      Alert.alert("Sign-in failed", "Please try signing in again.");
    }
  };

  return (
    <View className="w-full max-w-sm">
      <Text className="text-2xl font-bold text-center mb-6">Sign In</Text>
      <Button onPress={handleSignIn} title="Sign in with Google" />
    </View>
  );
}
