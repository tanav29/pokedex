/**
 * Pure game rules shared by the Convex backend and the Expo client.
 *
 * Nothing in here may import from `convex/*` or touch `Date.now()` directly —
 * callers pass the timestamp in so the server stays the single source of truth
 * for "now". Keeping it dependency-free is what lets the app render optimistically
 * (pull rates, XP curve, "next species unlock") without a round trip.
 */

export const TYPE_COLORS: Record<string, string> = {
  normal: "#9FA3B0",
  fire: "#F2703E",
  water: "#3D8FD6",
  electric: "#E9B23C",
  grass: "#4FA35C",
  ice: "#5FC7C7",
  fighting: "#C8503C",
  poison: "#8B5FB0",
  ground: "#C09A5B",
  flying: "#7C8FD6",
  psychic: "#DB5A8E",
  bug: "#8CA635",
  rock: "#9C8B5E",
  ghost: "#6B5FA8",
  dragon: "#5A6BD6",
  dark: "#5F5B6B",
  steel: "#7F8C9B",
  fairy: "#DB74AE",
};

/** Gen VI+ matchup table, split by outcome so each cell reads unambiguously. */
const TYPE_CHART: Record<string, { strong: string[]; resist: string[]; immune: string[] }> = {
  normal: { strong: ["rock", "ghost", "steel"], resist: ["rock", "steel"], immune: ["ghost"] },
  fire: { strong: ["grass", "ice", "bug", "steel"], resist: ["fire", "water", "rock", "dragon"], immune: [] },
  water: { strong: ["fire", "ground", "rock"], resist: ["water", "grass", "dragon"], immune: [] },
  electric: { strong: ["water", "flying"], resist: ["electric", "grass", "dragon"], immune: [] },
  grass: {
    strong: ["water", "ground", "rock"],
    resist: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],
    immune: [],
  },
  ice: { strong: ["grass", "ground", "flying", "dragon"], resist: ["fire", "water", "ice", "steel"], immune: [] },
  fighting: {
    strong: ["normal", "ice", "rock", "dark", "steel"],
    resist: ["poison", "flying", "psychic", "bug", "fairy"],
    immune: ["ghost"],
  },
  poison: { strong: ["grass", "fairy"], resist: ["poison", "ground", "rock", "ghost"], immune: [] },
  ground: {
    strong: ["fire", "electric", "poison", "rock", "steel"],
    resist: ["grass", "bug"],
    immune: ["flying"],
  },
  flying: { strong: ["grass", "fighting", "bug"], resist: ["electric", "rock", "steel"], immune: [] },
  psychic: { strong: ["fighting", "poison"], resist: ["psychic", "steel"], immune: [] },
  bug: {
    strong: ["grass", "psychic", "dark"],
    resist: ["fire", "fighting", "poison", "flying", "ghost", "dark", "steel", "fairy"],
    immune: [],
  },
  rock: { strong: ["fire", "ice", "flying", "bug"], resist: ["fighting", "ground", "fire"], immune: [] },
  ghost: { strong: ["psychic", "ghost"], resist: ["normal", "psychic"], immune: ["dark"] },
  dragon: { strong: ["dragon"], resist: ["steel", "fairy"], immune: ["fairy"] },
  dark: { strong: ["psychic", "ghost"], resist: ["fighting", "dark", "fairy"], immune: [] },
  steel: {
    strong: ["rock", "fairy", "ice"],
    resist: ["fire", "water", "electric", "steel"],
    immune: [],
  },
  fairy: { strong: ["fighting", "dragon", "dark"], resist: ["fire", "poison", "steel"], immune: [] },
};

/** Multiplier for `attacker` hitting a defender with `defenders` (1 or 2 types). */
export function typeEffectiveness(attacker: string, defenders: string[]): number {
  const chart = TYPE_CHART[attacker];
  if (!chart) return 1;
  return defenders.reduce((mult, defender) => {
    if (chart.immune.includes(defender)) return 0;
    if (chart.strong.includes(defender)) return mult * 2;
    if (chart.resist.includes(defender)) return mult * 0.5;
    return mult;
  }, 1);
}

export function effectivenessLabel(multiplier: number): string {
  if (multiplier >= 4) return "Devastating";
  if (multiplier > 1) return "Super effective";
  if (multiplier === 0) return "No effect";
  if (multiplier < 1) return "Not very effective";
  return "Normal hit";
}

// ---------------------------------------------------------------- progression

/** XP needed to advance *from* `level` to the next one. */
export function xpToNext(level: number): number {
  return 80 + 40 * (level - 1);
}

/** Inverse of `xpToNext`: total lifetime XP -> level + progress within it. */
export function levelFromXp(totalXp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return { level, intoLevel: remaining, needed: xpToNext(level) };
}

// ------------------------------------------------------------------- the pool

/** Kanto at Trainer Level 1. */
export const BASE_POOL = 151;
export const MAX_POOL = 1002;
/** Species unlocked per Trainer Level. */
export const POOL_PER_LEVEL = 8;

export function poolCap(level: number): number {
  return Math.min(MAX_POOL, BASE_POOL + Math.max(0, level - 1) * POOL_PER_LEVEL);
}

export type UnlockInfo = {
  currentCap: number;
  nextCap: number;
  levelNeeded: number;
  nextSpeciesName: string | null;
};

export function unlockInfo(level: number, nameFor: (id: number) => string | null): UnlockInfo {
  const currentCap = poolCap(level);
  const nextCap = poolCap(level + 1);
  const levelNeeded = currentCap >= MAX_POOL ? level : level + 1;
  return {
    currentCap,
    nextCap: Math.min(nextCap, MAX_POOL),
    levelNeeded,
    nextSpeciesName: currentCap >= MAX_POOL ? null : nameFor(currentCap + 1),
  };
}

// ---------------------------------------------------------------- ball tiers

export type BallTier = {
  id: BallId;
  label: string;
  /** 1-in-N odds of a shiny. */
  shinyOdds: number;
  xpMultiplier: number;
  coinMultiplier: number;
  /** Coins to buy one. Poké Balls come from the passive timer and dailies. */
  buyCost: number;
  /** Top of the shop listing, below the free tier. */
  tagline: string;
};

export const BALL_TIERS: Record<BallId, BallTier> = {
  poke: {
    id: "poke",
    label: "Poké Ball",
    shinyOdds: 48,
    xpMultiplier: 1,
    coinMultiplier: 1,
    buyCost: 0,
    tagline: "Free · refills on its own",
  },
  great: {
    id: "great",
    label: "Great Ball",
    shinyOdds: 24,
    xpMultiplier: 1.15,
    coinMultiplier: 1.4,
    buyCost: 60,
    tagline: "Twice the shiny odds",
  },
  ultra: {
    id: "ultra",
    label: "Ultra Ball",
    shinyOdds: 10,
    xpMultiplier: 1.35,
    coinMultiplier: 2,
    buyCost: 180,
    tagline: "Best chance at a shiny",
  },
};

export const BALL_ORDER: BallId[] = ["poke", "great", "ultra"];

/** A Poké Ball every `BALL_REGEN_MS`, up to `BALL_REGEN_CAP`. */
export const BALL_REGEN_MS = 20 * 60 * 1000;
export const BALL_REGEN_CAP = 10;

// ------------------------------------------------------------------- rewards

export function catchRewards(opts: {
  pokemonId: number;
  tier: BallTier;
  shiny: boolean;
  isDuplicate: boolean;
}): { xp: number; coins: number } {
  const baseXp = 18 + Math.round(opts.pokemonId / 12);
  const baseCoins = 6 + Math.round(opts.pokemonId / 40);
  const dupFactor = opts.isDuplicate ? 0.75 : 1;
  return {
    xp: Math.round(baseXp * opts.tier.xpMultiplier * (opts.shiny ? 2 : 1) * dupFactor),
    coins: Math.round(
      baseCoins * opts.tier.coinMultiplier * (opts.shiny ? 4 : 1) * dupFactor,
    ),
  };
}

// ------------------------------------------------------------------ day cycle

/** UTC day key, e.g. "2026-10-15". All daily resets are pinned to UTC. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Whole days between two day keys. `daysAgo(a, b)` is positive when b is later. */
export function daysBetween(a: string, b: string): number {
  const parsedA = Date.parse(`${a}T00:00:00.000Z`);
  const parsedB = Date.parse(`${b}T00:00:00.000Z`);
  if (Number.isNaN(parsedA) || Number.isNaN(parsedB)) return 0;
  return Math.round((parsedB - parsedA) / 86_400_000);
}

/** Countdown to the next UTC midnight, for the "daily resets in" label. */
export function msUntilNextDay(now: number): number {
  const next = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate() + 1,
  );
  return next - now;
}

export type DailyReward = { balls: number; coins: number; streakDay: number };

/** Day N of a streak pays better than day N-1, and caps out at a week. */
export function dailyRewardFor(streakDay: number): DailyReward {
  const capped = Math.min(streakDay, 7);
  return {
    balls: Math.min(5, 1 + Math.floor(capped / 2)),
    coins: 8 * capped,
    streakDay: capped,
  };
}

// -------------------------------------------------------------------- battles

/** Coins are only paid out for this many wins per UTC day. */
export const DAILY_BATTLE_REWARD_CAP = 15;

export const BATTLE_REWARDS = {
  win: { xp: 40, coins: 25 },
  loss: { xp: 8, coins: 0 },
} as const;

// ----------------------------------------------------------------- pokemon art

export const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export function frontSprite(pokemonId: number, shiny: boolean): string {
  return `${SPRITE_BASE}/${pokemonId}${shiny ? "/shiny" : ""}.png`;
}

/** The artwork used on dex cells — home render, which reads best at small sizes. */
export function homeSprite(pokemonId: number, shiny: boolean): string {
  return `${SPRITE_BASE}/other/home/${pokemonId}${shiny ? "/shiny" : ""}.png`;
}

export function titleCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ------------------------------------------------------------- shared shapes

export type BallId = "poke" | "great" | "ultra";
export type BallCounts = { poke: number; great: number; ultra: number };

/** Enough of a species to render a card without a second lookup. */
export type PokemonRef = {
  id: number;
  name: string;
  displayName: string;
  types: string[];
};

export type SpeciesMeta = { pokemonId: number; name: string; types: string[] };

/** The trainer's counters, plus everything the client would otherwise derive. */
export type TrainerProfile = {
  level: number;
  xp: number;
  intoLevel: number;
  needed: number;
  coins: number;
  balls: BallCounts;
  /** Countdown to the next free Poké Ball, or null once the timer is capped. */
  msToNextBall: number | null;
  streak: number;
  claimedToday: boolean;
  /** True while a streak is still alive but will lapse at the next midnight. */
  streakAtRisk: boolean;
  totalCatches: number;
  totalShinies: number;
  speciesCount: number;
  battlesWon: number;
  battlesLost: number;
  poolCap: number;
  poolMaxed: boolean;
  poolNextCap: number;
  poolLevelNeeded: number;
};

/** A quest reward as it travels back to the client for the toast stack. */
export type QuestPayout = { title: string; coins: number; balls?: number };

export type CatchResult = {
  pokemon: PokemonRef;
  shiny: boolean;
  /** First time this species has entered the dex. */
  isNew: boolean;
  xp: number;
  coins: number;
  levelsGained: number;
  /** How many extra species became pullable as a result of the level-up. */
  poolUnlocked: number;
  quests: QuestPayout[];
  profile: TrainerProfile;
};

export type BattleResult = {
  won: boolean;
  coinsAwarded: number;
  /** True when the daily coin cap was already spent, so XP still pays but coins do not. */
  capped: boolean;
  xp: number;
  levelsGained: number;
  quests: QuestPayout[];
  profile: TrainerProfile;
};

/** Battle stats flattened out of PokéAPI's six-stat array. */
export type BattleStats = { hp: number; attack: number; defense: number; speed: number };

/** Everything the battle screen needs about one combatant. */
export type BattlePokemon = {
  pokemonId: number;
  name: string;
  displayName: string;
  types: string[];
  stats: BattleStats;
};
