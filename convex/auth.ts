import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { query } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async redirect({ redirectTo }) {
      const allowedRedirects = new Set([
        "exp://d4qgmug-tanav-8081.exp.direct",
        "http://localhost:3000",
        "http://localhost:8081",
        "pokedex://",
        ...(process.env.AUTH_ALLOWED_REDIRECTS ?? "")
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean),
      ]);
      if (!allowedRedirects.has(redirectTo)) {
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
