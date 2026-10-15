import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import {
  BALL_REGEN_CAP,
  BALL_REGEN_MS,
  BALL_TIERS,
  BATTLE_REWARDS,
  DAILY_BATTLE_REWARD_CAP,
  MAX_POOL,
  catchRewards,
  dailyRewardFor,
  dayKey,
  daysBetween,
  levelFromXp,
  poolCap,
  titleCase,
  type BattleResult,
  type BallCounts,
  type BallId,
  type CatchResult,
  type QuestPayout,
  type TrainerProfile,
} from "./lib/gameLogic";
import {
  achievementQuests,
  claimIdFor,
  dailyQuestsForDay,
  newlyCompletedQuests,
  type QuestDefinition,
  type QuestSnapshot,
} from "./lib/quests";

const POKEAPI = "https://pokeapi.co/api/v2/pokemon";

// ---------------------------------------------------------------- primitives

type ProfileDoc = {
  _id: any;
  userId: any;
  xp: number;
  coins: number;
  balls: BallCounts;
  streak: number;
  lastDailyDay: string;
  lastBallTick: number;
  totalCatches: number;
  totalShinies: number;
  speciesCount: number;
  battlesWon: number;
  battlesLost: number;
  claimedQuests: string[];
  createdAt: number;
};

const EMPTY_STATS = { catches: 0, shinies: 0, battlesWon: 0, battlesLost: 0, types: {} as Record<string, number> };

function addBalls(base: BallCounts, delta: Partial<BallCounts>): BallCounts {
  return {
    poke: base.poke + (delta.poke ?? 0),
    great: base.great + (delta.great ?? 0),
    ultra: base.ultra + (delta.ultra ?? 0),
  };
}

/**
 * Passive Poké Balls, computed rather than written.
 *
 * The read path reports balls the trainer is *owed* but has not had persisted
 * yet; `settleBalls` flushes that debt the moment any mutation touches the
 * profile. Keeping the timer a pure function means the pull screen can count
 * down from a plain query with no write amplification.
 */
function settleBalls(profile: ProfileDoc | null, now: number): { balls: BallCounts; lastBallTick: number } {
  const current = profile?.balls ?? { poke: 0, great: 0, ultra: 0 };
  if (!profile || current.poke >= BALL_REGEN_CAP) {
    return { balls: current, lastBallTick: now };
  }
  const earned = Math.max(0, Math.floor((now - profile.lastBallTick) / BALL_REGEN_MS));
  return {
    balls: { ...current, poke: Math.min(BALL_REGEN_CAP, current.poke + earned) },
    lastBallTick: now,
  };
}

function msToNextBall(profile: ProfileDoc | null, now: number): number | null {
  const poke = profile?.balls.poke ?? 0;
  if (poke >= BALL_REGEN_CAP) return null;
  const lastTick = profile?.lastBallTick ?? now;
  return BALL_REGEN_MS - ((now - lastTick) % BALL_REGEN_MS);
}

/** The client-facing projection: raw counters plus everything derived from them. */
function publicProfile(profile: ProfileDoc | null, now: number): TrainerProfile {
  const xp = profile?.xp ?? 0;
  const { level, intoLevel, needed } = levelFromXp(xp);
  const cap = poolCap(level);
  const claimedToday = (profile?.lastDailyDay ?? "") === dayKey(now);

  return {
    level,
    xp,
    intoLevel,
    needed,
    coins: profile?.coins ?? 0,
    balls: settleBalls(profile, now).balls,
    msToNextBall: msToNextBall(profile, now),
    streak: profile?.streak ?? 0,
    claimedToday,
    /**
     * Set while a streak is still alive but will lapse at the next midnight —
     * the "don't break your streak" nudge.
     */
    streakAtRisk:
      !!profile && profile.streak > 0 && profile.lastDailyDay !== ""
        ? daysBetween(profile.lastDailyDay, dayKey(now)) <= 1
        : false,
    totalCatches: profile?.totalCatches ?? 0,
    totalShinies: profile?.totalShinies ?? 0,
    speciesCount: profile?.speciesCount ?? 0,
    battlesWon: profile?.battlesWon ?? 0,
    battlesLost: profile?.battlesLost ?? 0,
    poolCap: cap,
    poolMaxed: cap >= MAX_POOL,
    poolNextCap: Math.min(MAX_POOL, poolCap(level + 1)),
    poolLevelNeeded: cap >= MAX_POOL ? level : level + 1,
  };
}

// ------------------------------------------------------------- profile store

async function loadProfile(ctx: any, userId: any): Promise<ProfileDoc | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

/** Fetches the trainer's profile, minting a Level 1 one on first contact. */
async function ensureProfile(ctx: any, userId: any, now: number): Promise<ProfileDoc> {
  const existing = await loadProfile(ctx, userId);
  if (existing) return existing;

  await ctx.db.insert("profiles", {
    userId,
    xp: 0,
    coins: 120,
    balls: { poke: 5, great: 1, ultra: 0 },
    streak: 0,
    lastDailyDay: "",
    lastBallTick: now,
    totalCatches: 0,
    totalShinies: 0,
    speciesCount: 0,
    battlesWon: 0,
    battlesLost: 0,
    claimedQuests: [],
    createdAt: now,
  });
  return (await loadProfile(ctx, userId)) as ProfileDoc;
}

type DailyStatsRow = {
  _id: any;
  userId: any;
  dayKey: string;
  catches: number;
  shinies: number;
  battlesWon: number;
  battlesLost: number;
  types: Record<string, number>;
};

async function readDailyStats(ctx: any, userId: any, today: string): Promise<DailyStatsRow> {
  const row = await ctx.db
    .query("dailyStats")
    .withIndex("by_user_day", (q: any) => q.eq("userId", userId).eq("dayKey", today))
    .first();
  if (row) return row as DailyStatsRow;
  return { _id: null, userId, dayKey: today, ...EMPTY_STATS };
}

async function bumpDailyStats(
  ctx: any,
  userId: any,
  today: string,
  delta: Partial<Pick<DailyStatsRow, "catches" | "shinies" | "battlesWon" | "battlesLost">> & {
    types?: Record<string, number>;
  },
) {
  const current = await readDailyStats(ctx, userId, today);
  const types = { ...current.types };
  for (const [type, count] of Object.entries(delta.types ?? {})) {
    types[type] = (types[type] ?? 0) + count;
  }

  const next = {
    catches: current.catches + (delta.catches ?? 0),
    shinies: current.shinies + (delta.shinies ?? 0),
    battlesWon: current.battlesWon + (delta.battlesWon ?? 0),
    battlesLost: current.battlesLost + (delta.battlesLost ?? 0),
    types,
  };

  if (current._id) await ctx.db.patch(current._id, next);
  else await ctx.db.insert("dailyStats", { userId, dayKey: today, ...next });
}

async function buildSnapshot(ctx: any, profile: ProfileDoc, now: number): Promise<QuestSnapshot> {
  const stats = await readDailyStats(ctx, profile.userId, dayKey(now));
  return {
    level: levelFromXp(profile.xp).level,
    streak: profile.streak,
    totalCatches: profile.totalCatches,
    totalShinies: profile.totalShinies,
    speciesCount: profile.speciesCount,
    battlesWon: profile.battlesWon,
    todayCatches: stats.catches,
    todayShinies: stats.shinies,
    todayBattlesWon: stats.battlesWon,
    todayTypes: stats.types,
  };
}

// ------------------------------------------------------------------- rewards

type RewardOutcome = { levelsGained: number; poolUnlocked: number };

/**
 * Applies XP/coins, rolls the trainer up through any levels they crossed, then
 * pays out every quest the new totals completed — all in one atomic write so a
 * level-up can never be seen without the rewards that came with it.
 */
async function grantRewards(
  ctx: any,
  profile: ProfileDoc,
  grants: { xp?: number; coins?: number; balls?: Partial<BallCounts> },
  now: number,
): Promise<{ profile: ProfileDoc; outcome: RewardOutcome; quests: QuestPayout[] }> {
  const beforeLevel = levelFromXp(profile.xp).level;
  const xp = profile.xp + (grants.xp ?? 0);
  const afterLevel = levelFromXp(xp).level;

  const pending: ProfileDoc = {
    ...profile,
    xp,
    coins: profile.coins + (grants.coins ?? 0),
    balls: addBalls(profile.balls, grants.balls ?? {}),
  };

  const completed = newlyCompletedQuests(
    await buildSnapshot(ctx, pending, now),
    profile.claimedQuests,
    now,
  );

  let questCoins = 0;
  const questBalls: Partial<BallCounts> = {};
  for (const quest of completed) {
    questCoins += quest.reward.coins;
    if (quest.reward.balls) questBalls.poke = (questBalls.poke ?? 0) + quest.reward.balls;
  }

  await ctx.db.patch(profile._id, {
    xp,
    coins: pending.coins + questCoins,
    balls: addBalls(pending.balls, questBalls),
    claimedQuests: [...profile.claimedQuests, ...completed.map((q) => claimIdFor(q, now))],
  });

  return {
    profile: (await ctx.db.get(profile._id)) as ProfileDoc,
    outcome: { levelsGained: afterLevel - beforeLevel, poolUnlocked: poolCap(afterLevel) - poolCap(beforeLevel) },
    quests: completed.map((q) => ({ ...q.reward, title: q.title })),
  };
}

// -------------------------------------------------------------------- queries

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const now = Date.now();
    // Minting here rather than on the first mutation is deliberate: a trainer who
    // has never caught anything should still open the app to a usable field kit,
    // not to an empty screen with nothing to do. It costs one insert, once.
    const profile = await ensureProfile(ctx, userId, now);
    const nextSpecies = await nextSpeciesName(ctx, levelFromXp(profile.xp).level);
    return { ...publicProfile(profile, now), nextSpecies };
  },
});

/** The name teaser for "level up to unlock #152". Null once the pool is complete. */
async function nextSpeciesName(ctx: any, level: number): Promise<string | null> {
  const cap = poolCap(level);
  if (cap >= MAX_POOL) return null;
  const meta = await ctx.db
    .query("pokemonMeta")
    .withIndex("by_pokemon_id", (q: any) => q.eq("pokemonId", cap + 1))
    .first();
  return meta ? titleCase(meta.name) : null;
}

export const getCollection = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const entries = await ctx.db
      .query("catches")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const search = (args.search ?? "").trim().toLowerCase();
    const matched = search
      ? entries.filter((entry) => entry.pokemonName.includes(search))
      : entries;
    matched.sort((a, b) => a.pokemonId - b.pokemonId);

    const byType: Record<string, number> = {};
    for (const entry of entries) {
      for (const type of entry.types) byType[type] = (byType[type] ?? 0) + 1;
    }

    return {
      entries: matched.map((entry) => ({
        pokemonId: entry.pokemonId,
        name: entry.pokemonName,
        types: entry.types,
        shiny: entry.shiny,
        count: entry.count,
        firstCaughtAt: entry.firstCaughtAt,
      })),
      counts: {
        species: entries.length,
        shinies: entries.filter((entry) => entry.shiny).length,
        pulls: entries.reduce((sum, entry) => sum + entry.count, 0),
        byType,
      },
    };
  },
});

function toQuestView(quest: QuestDefinition, snapshot: QuestSnapshot, claimed: string[], now: number) {
  const claimId = claimIdFor(quest, now);
  const progress = Math.min(quest.progress(snapshot), quest.goal);
  return {
    id: claimId,
    questId: quest.id,
    kind: quest.kind,
    title: quest.title,
    detail: quest.detail,
    icon: quest.icon,
    goal: quest.goal,
    progress,
    done: progress >= quest.goal,
    paid: claimed.includes(claimId),
    reward: quest.reward,
  };
}

export const getQuests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const now = Date.now();
    const profile = await ensureProfile(ctx, userId, now);
    const snapshot = await buildSnapshot(ctx, profile, now);

    return {
      daily: dailyQuestsForDay(now).map((q) => toQuestView(q, snapshot, profile.claimedQuests, now)),
      achievements: achievementQuests().map((q) => toQuestView(q, snapshot, profile.claimedQuests, now)),
      // Rewards are paid the instant a quest completes, so this is a read-only hint.
      autoClaim: true,
      totals: {
        species: snapshot.speciesCount,
        shinies: snapshot.totalShinies,
        pulls: snapshot.totalCatches,
        battlesWon: snapshot.battlesWon,
        level: snapshot.level,
      },
      dailyProgress: {
        catches: snapshot.todayCatches,
        shinies: snapshot.todayShinies,
        battlesWon: snapshot.todayBattlesWon,
      },
    };
  },
});

/**
 * Names for a range of species, keyed by dex number.
 *
 * The dex grid needs a label for every tile — including the ones still uncaught —
 * and reading the cache one row at a time would be a request per tile. Returns
 * only what is cached; `primeSpeciesMeta` fills the gaps in the background.
 */
export const getSpeciesNames = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const from = Math.max(1, args.from ?? 1);
    const to = Math.min(MAX_POOL, args.to ?? from + 150);
    // One read of a small, append-only table beats 150 index lookups.
    const cached = await ctx.db.query("pokemonMeta").collect();
    const names: Record<string, string> = {};
    for (const meta of cached) {
      if (meta.pokemonId >= from && meta.pokemonId <= to) names[String(meta.pokemonId)] = meta.name;
    }
    return names;
  },
});

const LEADERBOARD_DEPTH = 100;

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);

    // Bounded by design: past this depth the table returns only what it can
    // justify cheaply, rather than scanning every trainer in the database.
    const top = await ctx.db.query("profiles").withIndex("by_xp").order("desc").take(LEADERBOARD_DEPTH);

    const rows = top.map((doc, index) => ({
      rank: index + 1,
      isMe: doc.userId === userId,
      level: levelFromXp(doc.xp).level,
      xp: doc.xp,
      species: doc.speciesCount,
      shinies: doc.totalShinies,
    }));

    const myRank = rows.find((row) => row.isMe)?.rank ?? null;
    return { rows, myRank, depth: LEADERBOARD_DEPTH };
  },
});

// ----------------------------------------------------------------- mutations

export const claimDaily = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();
    const profile = await ensureProfile(ctx, userId, now);
    const today = dayKey(now);

    if (profile.lastDailyDay === today) {
      return {
        alreadyClaimed: true,
        reward: null,
        streak: profile.streak,
        profile: publicProfile(profile, now),
      };
    }

    // Exactly one day apart keeps the streak alive; anything longer restarts it.
    const gap = profile.lastDailyDay ? daysBetween(profile.lastDailyDay, today) : Number.POSITIVE_INFINITY;
    const streak = gap === 1 ? profile.streak + 1 : 1;
    const reward = dailyRewardFor(streak);

    const settled = settleBalls(profile, now);
    await ctx.db.patch(profile._id, {
      balls: settled.balls,
      lastBallTick: settled.lastBallTick,
      streak,
      lastDailyDay: today,
    });

    const claimed = (await ctx.db.get(profile._id)) as ProfileDoc;
    const result = await grantRewards(ctx, claimed, { coins: reward.coins, balls: { poke: reward.balls } }, now);

    return {
      alreadyClaimed: false,
      reward,
      streak,
      quests: result.quests,
      profile: publicProfile(result.profile, now),
    };
  },
});

export const buyBall = mutation({
  args: { tier: v.union(v.literal("poke"), v.literal("great"), v.literal("ultra")) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();
    const profile = await ensureProfile(ctx, userId, now);
    const tier = BALL_TIERS[args.tier as BallId];

    if (tier.buyCost <= 0) throw new Error("Poké Balls refill on their own. No need to buy them.");
    if (profile.coins < tier.buyCost) throw new Error(`A ${tier.label} costs ${tier.buyCost} coins.`);

    const settled = settleBalls(profile, now);
    const balls = addBalls(settled.balls, { [args.tier]: 1 } as Partial<BallCounts>);
    await ctx.db.patch(profile._id, {
      coins: profile.coins - tier.buyCost,
      balls,
      lastBallTick: settled.lastBallTick,
    });

    return { profile: publicProfile((await ctx.db.get(profile._id)) as ProfileDoc, now) };
  },
});

/**
 * Settles one pull.
 *
 * The species and its shiny roll are decided server-side by `throwBall`, which is
 * an action because resolving species types can require a PokéAPI round trip.
 */
export const commitCatch = mutation({
  args: {
    pokemonId: v.number(),
    pokemonName: v.string(),
    types: v.array(v.string()),
    shiny: v.boolean(),
    tier: v.union(v.literal("poke"), v.literal("great"), v.literal("ultra")),
  },
  handler: async (ctx, args): Promise<CatchResult> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();
    const today = dayKey(now);
    const profile = await ensureProfile(ctx, userId, now);
    const settled = settleBalls(profile, now);
    const tier = BALL_TIERS[args.tier as BallId];

    const available = settled.balls[args.tier as BallId];
    if (available <= 0) throw new Error(`You're out of ${tier.label}s.`);

    const existing = await ctx.db
      .query("catches")
      .withIndex("by_user_pokemon", (q) =>
        q.eq("userId", userId).eq("pokemonId", args.pokemonId),
      )
      .first();
    const isNew = !existing;

    const reward = catchRewards({
      pokemonId: args.pokemonId,
      tier,
      shiny: args.shiny,
      isDuplicate: !isNew,
    });

    await ctx.db.patch(profile._id, {
      balls: { ...settled.balls, [args.tier]: available - 1 } as BallCounts,
      lastBallTick: settled.lastBallTick,
      totalCatches: profile.totalCatches + 1,
      totalShinies: profile.totalShinies + (args.shiny ? 1 : 0),
      speciesCount: profile.speciesCount + (isNew ? 1 : 0),
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        lastCaughtAt: now,
        // Once a species has a shiny form recorded it keeps it, so the dex badge
        // never disappears because a later pull was the normal colour.
        shiny: existing.shiny || args.shiny,
      });
    } else {
      await ctx.db.insert("catches", {
        userId,
        pokemonId: args.pokemonId,
        pokemonName: args.pokemonName,
        types: args.types,
        shiny: args.shiny,
        count: 1,
        firstCaughtAt: now,
        lastCaughtAt: now,
      });
    }

    const typeDelta: Record<string, number> = {};
    for (const type of args.types) typeDelta[type] = (typeDelta[type] ?? 0) + 1;
    await bumpDailyStats(ctx, userId, today, {
      catches: 1,
      shinies: args.shiny ? 1 : 0,
      types: typeDelta,
    });

    const current = (await ctx.db.get(profile._id)) as ProfileDoc;
    const granted = await grantRewards(ctx, current, { xp: reward.xp, coins: reward.coins }, now);

    return {
      pokemon: {
        id: args.pokemonId,
        name: args.pokemonName,
        displayName: titleCase(args.pokemonName),
        types: args.types,
      },
      shiny: args.shiny,
      isNew,
      xp: reward.xp,
      coins: reward.coins,
      levelsGained: granted.outcome.levelsGained,
      poolUnlocked: granted.outcome.poolUnlocked,
      quests: granted.quests,
      profile: publicProfile(granted.profile, now),
    };
  },
});

/** Records a finished battle. The fight itself is simulated on the client. */
export const reportBattle = mutation({
  args: {
    won: v.boolean(),
    pokemonId: v.number(),
    pokemonName: v.string(),
    rivalId: v.number(),
    rivalName: v.string(),
  },
  handler: async (ctx, args): Promise<BattleResult> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();
    const today = dayKey(now);
    const profile = await ensureProfile(ctx, userId, now);
    const settled = settleBalls(profile, now);
    const todayBattles = await ctx.db
      .query("battles")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("dayKey", today))
      .collect();
    // Winners still bank XP past the daily coin cap, so the fight stays worth
    // playing without letting coins be farmed indefinitely.
    const capped = args.won && todayBattles.filter((b) => b.won && b.coinsAwarded > 0).length >= DAILY_BATTLE_REWARD_CAP;
    const coinsAwarded = args.won && !capped ? BATTLE_REWARDS.win.coins : 0;

    await ctx.db.insert("battles", {
      userId,
      won: args.won,
      pokemonId: args.pokemonId,
      pokemonName: args.pokemonName,
      rivalId: args.rivalId,
      rivalName: args.rivalName,
      coinsAwarded,
      dayKey: today,
      at: now,
    });

    await ctx.db.patch(profile._id, {
      balls: settled.balls,
      lastBallTick: settled.lastBallTick,
      battlesWon: profile.battlesWon + (args.won ? 1 : 0),
      battlesLost: profile.battlesLost + (args.won ? 0 : 1),
    });

    await bumpDailyStats(ctx, userId, today, {
      battlesWon: args.won ? 1 : 0,
      battlesLost: args.won ? 0 : 1,
    });

    const current = (await ctx.db.get(profile._id)) as ProfileDoc;
    const granted = await grantRewards(ctx, current, { xp: BATTLE_REWARDS.win.xp, coins: coinsAwarded }, now);

    return {
      won: args.won,
      coinsAwarded,
      capped,
      xp: BATTLE_REWARDS.win.xp,
      levelsGained: granted.outcome.levelsGained,
      quests: granted.quests,
      profile: publicProfile(granted.profile, now),
    };
  },
});

// ------------------------------------------------------- species metadata

/**
 * Species names and types, cached as players pull. There is no bulk PokéAPI
 * endpoint for "the types of the first 151", so these fill in a batch at a time.
 * Internal-only: the client never needs to write here directly.
 */
export type SpeciesMeta = { pokemonId: number; name: string; types: string[] };

export const getMeta = internalQuery({
  args: { pokemonId: v.number() },
  handler: async (ctx, args): Promise<SpeciesMeta | null> => {
    return await ctx.db
      .query("pokemonMeta")
      .withIndex("by_pokemon_id", (q) => q.eq("pokemonId", args.pokemonId))
      .first();
  },
});

export const saveMeta = internalMutation({
  args: { pokemonId: v.number(), name: v.string(), types: v.array(v.string()) },
  handler: async (ctx, args): Promise<null> => {
    const existing = await ctx.db
      .query("pokemonMeta")
      .withIndex("by_pokemon_id", (q) => q.eq("pokemonId", args.pokemonId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, types: args.types });
      return null;
    }
    await ctx.db.insert("pokemonMeta", args);
    return null;
  },
});

export const findMissingMeta = internalQuery({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, args): Promise<number[]> => {
    const cached = await ctx.db.query("pokemonMeta").collect();
    const have = new Set(cached.map((doc) => doc.pokemonId));
    const missing: number[] = [];
    for (let id = Math.max(1, args.from); id <= Math.min(MAX_POOL, args.to); id++) {
      if (!have.has(id)) missing.push(id);
    }
    return missing;
  },
});

export const bulkSaveMeta = internalMutation({
  args: {
    rows: v.array(
      v.object({ pokemonId: v.number(), name: v.string(), types: v.array(v.string()) }),
    ),
  },
  handler: async (ctx, args): Promise<number> => {
    const existing = await ctx.db.query("pokemonMeta").collect();
    const index = new Map(existing.map((doc) => [doc.pokemonId, doc._id]));
    for (const row of args.rows) {
      const id = index.get(row.pokemonId);
      if (id) await ctx.db.patch(id, { name: row.name, types: row.types });
      else await ctx.db.insert("pokemonMeta", row);
    }
    return args.rows.length;
  },
});

