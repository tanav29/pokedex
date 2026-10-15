import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  favorites: defineTable({
    userId: v.id("users"),
    pokemonName: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_pokemon", ["userId", "pokemonName"]),

  /**
   * One row per trainer. `balls` is a small fixed shape rather than a map so the
   * shop and the pull screen can read a count without knowing which tiers exist.
   */
  profiles: defineTable({
    userId: v.id("users"),
    xp: v.number(),
    coins: v.number(),
    balls: v.object({
      poke: v.number(),
      great: v.number(),
      ultra: v.number(),
    }),
    /** Consecutive UTC days the daily reward has been claimed on. */
    streak: v.number(),
    /** Day key the daily reward was last claimed on, "YYYY-MM-DD". */
    lastDailyDay: v.string(),
    /** Watermark for the passive Poké Ball timer. */
    lastBallTick: v.number(),
    totalCatches: v.number(),
    totalShinies: v.number(),
    /** Denormalised so the dex header and quests never scan the catch table. */
    speciesCount: v.number(),
    battlesWon: v.number(),
    battlesLost: v.number(),
    /** Ids of one-time quests already paid out, so auto-rewards fire exactly once. */
    claimedQuests: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_xp", ["xp"]),

  /** Dex entries: one row per species, `count` is how many times it was pulled. */
  catches: defineTable({
    userId: v.id("users"),
    pokemonId: v.number(),
    pokemonName: v.string(),
    types: v.array(v.string()),
    shiny: v.boolean(),
    count: v.number(),
    firstCaughtAt: v.number(),
    lastCaughtAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_pokemon", ["userId", "pokemonId"]),

  /**
   * Running totals for one UTC day. Daily quests read this row instead of
   * range-scanning every catch, which keeps every pull to a constant number of
   * indexed reads no matter how large the dex gets.
   */
  dailyStats: defineTable({
    userId: v.id("users"),
    dayKey: v.string(),
    catches: v.number(),
    shinies: v.number(),
    battlesWon: v.number(),
    battlesLost: v.number(),
    types: v.record(v.string(), v.number()),
  }).index("by_user_day", ["userId", "dayKey"]),

  /** Species art/type cache, filled lazily the first time a species is pulled. */
  pokemonMeta: defineTable({
    pokemonId: v.number(),
    name: v.string(),
    types: v.array(v.string()),
  }).index("by_pokemon_id", ["pokemonId"]),

  /** Battle outcomes. `dayKey` is the UTC day so daily quest caps are a range read. */
  battles: defineTable({
    userId: v.id("users"),
    won: v.boolean(),
    pokemonId: v.number(),
    pokemonName: v.string(),
    rivalId: v.number(),
    rivalName: v.string(),
    coinsAwarded: v.number(),
    dayKey: v.string(),
    at: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_day", ["userId", "dayKey"]),
});

export default schema;
