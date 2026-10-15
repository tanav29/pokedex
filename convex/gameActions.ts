import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import {
  BALL_TIERS,
  MAX_POOL,
  poolCap,
  titleCase,
  type BattlePokemon,
  type BattleStats,
  type CatchResult,
  type SpeciesMeta,
} from "./lib/gameLogic";

/**
 * Actions that need the network.
 *
 * These live apart from `game.ts` on purpose. The generated `api.d.ts` folds every
 * module into one `fullApi`, so an action that calls `internal.game.*` is asking
 * for a type that transitively contains the action itself — inference never
 * terminates. Naming the result types explicitly cuts the loop, and it also gives
 * the client something concrete to type against.
 */

const POKEAPI = "https://pokeapi.co/api/v2/pokemon";
/** How many species a single `primeSpeciesMeta` call goes and fetches. */
const PRIME_BATCH = 24;
/** PokéAPI is happier with a handful of requests in flight than a hundred. */
const PRIME_CONCURRENCY = 6;

async function fetchSpecies(pokemonId: number): Promise<SpeciesMeta> {
  const response = await fetch(`${POKEAPI}/${pokemonId}`);
  if (!response.ok) throw new Error(`PokéAPI returned ${response.status} for #${pokemonId}`);
  const data = (await response.json()) as { name: string; types: { type: { name: string } }[] };
  return { pokemonId, name: data.name, types: data.types.map((t) => t.type.name) };
}

/** Cache first, PokéAPI second — the second hit never costs a round trip again. */
async function resolveMeta(ctx: any, pokemonId: number): Promise<SpeciesMeta> {
  const cached = await ctx.runQuery(internal.game.getMeta, { pokemonId });
  if (cached) return { pokemonId: cached.pokemonId, name: cached.name, types: cached.types };
  const meta = await fetchSpecies(pokemonId);
  await ctx.runMutation(internal.game.saveMeta, meta);
  return meta;
}

/**
 * Rolls a pull and commits it.
 *
 * The species and the shiny roll are decided here, on the server. The client
 * learns the outcome only once `commitCatch` has landed, so there is no state in
 * which the app is showing a Pokémon the backend never awarded.
 */
export const throwBall = action({
  args: { tier: v.union(v.literal("poke"), v.literal("great"), v.literal("ultra")) },
  handler: async (ctx, args): Promise<CatchResult> => {
    const profile = await ctx.runQuery(api.game.getProfile, {});
    if (!profile) throw new Error("Unauthorized");

    const tier = args.tier;
    if (profile.balls[tier] <= 0) throw new Error(`You're out of ${BALL_TIERS[tier].label}s.`);

    const pokemonId = 1 + Math.floor(Math.random() * profile.poolCap);
    const shiny = Math.random() < 1 / BALL_TIERS[tier].shinyOdds;
    const meta = await resolveMeta(ctx, pokemonId);

    return await ctx.runMutation(api.game.commitCatch, {
      pokemonId: meta.pokemonId,
      pokemonName: meta.name,
      types: meta.types,
      shiny,
      tier: args.tier,
    });
  },
});

export type PrimeResult = { complete: boolean; fetched: number; remaining: number };

/**
 * Warms the species metadata cache.
 *
 * The dex grid needs a name and type for every species in the pool, not just the
 * caught ones, and PokéAPI has no bulk endpoint that provides them — so the cache
 * fills in batches as the player plays. Call it repeatedly until `complete`.
 */
export const primeSpeciesMeta = action({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args): Promise<PrimeResult> => {
    const from = Math.max(1, args.from ?? 1);
    const to = Math.min(MAX_POOL, args.to ?? 151);

    const missing: number[] = await ctx.runQuery(internal.game.findMissingMeta, { from, to });
    if (missing.length === 0) return { complete: true, fetched: 0, remaining: 0 };

    const batch = missing.slice(0, PRIME_BATCH);
    const rows: SpeciesMeta[] = [];
    for (let i = 0; i < batch.length; i += PRIME_CONCURRENCY) {
      const settled = await Promise.allSettled(
        batch.slice(i, i + PRIME_CONCURRENCY).map(fetchSpecies),
      );
      for (const result of settled) {
        if (result.status === "fulfilled") rows.push(result.value);
      }
    }
    if (rows.length) await ctx.runMutation(internal.game.bulkSaveMeta, { rows });
    return { complete: false, fetched: rows.length, remaining: missing.length - rows.length };
  },
});

/** Picks a wild rival from the part of the pool the trainer has actually reached. */
export const findRival = action({
  args: { trainerLevel: v.number() },
  handler: async (ctx, args): Promise<BattlePokemon> => {
    const cap = poolCap(Math.max(1, Math.min(30, Math.round(args.trainerLevel))));
    const meta = await resolveMeta(ctx, 1 + Math.floor(Math.random() * cap));
    const detail = await fetchDetail(meta.name);
    return {
      pokemonId: meta.pokemonId,
      name: meta.name,
      displayName: titleCase(meta.name),
      types: meta.types,
      stats: battleStats(detail.stats),
    };
  },
});

/** Full combat data for one species, used by the player's chosen fighter. */
export const getBattleStats = action({
  args: { name: v.string() },
  handler: async (_ctx, args): Promise<BattlePokemon> => {
    const detail = await fetchDetail(args.name.toLowerCase());
    return {
      pokemonId: detail.id,
      name: detail.name,
      displayName: titleCase(detail.name),
      types: detail.types.map((t) => t.type.name),
      stats: battleStats(detail.stats),
    };
  },
});

type PokeDetail = {
  id: number;
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
};

async function fetchDetail(nameOrId: string | number): Promise<PokeDetail> {
  const response = await fetch(`${POKEAPI}/${nameOrId}`);
  if (!response.ok) throw new Error(`PokéAPI returned ${response.status} for ${nameOrId}`);
  return (await response.json()) as PokeDetail;
}

/** Pulls the four stats the battle uses out of PokéAPI's stat array. */
function battleStats(stats: PokeDetail["stats"]): BattleStats {
  const read = (key: string) => stats.find((s) => s.stat.name === key)?.base_stat ?? 60;
  return {
    hp: read("hp"),
    attack: read("attack"),
    defense: read("defense"),
    speed: read("speed"),
  };
}
