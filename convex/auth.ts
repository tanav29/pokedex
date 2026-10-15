import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { query } from "./_generated/server";

// Expo Go dev-client schemes. The host part is whatever address `makeRedirectUri()`
// reports for the current network: the machine's LAN IP on a device, and
// 10.0.2.2 (the emulator's alias for the host) on the Android emulator. That
// address changes between networks, so matching on an exact string silently
// rejects sign-in whenever the machine moves.
const EXPO_DEV_SCHEMES = new Set(["exp", "exps"]);

// `expo.scheme` from app.json, used by standalone/dev builds.
const APP_SCHEMES = new Set(["pokedex"]);

function extraAllowedRedirects(): Set<string> {
  return new Set(
    (process.env.AUTH_ALLOWED_REDIRECTS ?? "")
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean),
  );
}

/**
 * Guards against open redirects while still accepting every URI the Expo client
 * can realistically produce.
 */
function isAllowedRedirect(redirectTo: string, extra: Set<string>): boolean {
  if (extra.has(redirectTo)) {
    return true;
  }

  // Same-origin relative redirects cannot leave SITE_URL.
  if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) {
    return true;
  }

  let url: URL;
  try {
    url = new URL(redirectTo);
  } catch {
    return false;
  }

  const scheme = url.protocol.replace(/:$/, "");
  if (EXPO_DEV_SCHEMES.has(scheme) || APP_SCHEMES.has(scheme)) {
    return true;
  }

  // Expo web dev server.
  if (
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return true;
  }

  return false;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async redirect({ redirectTo }) {
      if (!isAllowedRedirect(redirectTo, extraAllowedRedirects())) {
        throw new Error(`Invalid redirectTo URI ${redirectTo}`);
      }
      return redirectTo;
    },
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
