/**
 * Quest definitions and their evaluators.
 *
 * Every quest is a pure function of a snapshot, so completion can be detected
 * inside the same mutation that caused it and the reward paid out immediately —
 * no claim button, no "unclaimed rewards" inbox to forget about.
 */

export type QuestReward = { coins: number; balls?: number };

export type QuestDefinition = {
  id: string;
  kind: "daily" | "achievement";
  title: string;
  /** Written as the player completes it, e.g. "Catch 10 Pokémon today". */
  detail: string;
  icon: string;
  goal: number;
  reward: QuestReward;
  /** Reads current progress out of the snapshot. */
  progress: (snapshot: QuestSnapshot) => number;
};

/** Everything the evaluators need, gathered by the caller in one pass. */
export type QuestSnapshot = {
  level: number;
  streak: number;
  totalCatches: number;
  totalShinies: number;
  speciesCount: number;
  battlesWon: number;
  // --- today (UTC) ---
  todayCatches: number;
  todayShinies: number;
  todayBattlesWon: number;
  todayTypes: Record<string, number>;
};

const DAILY_POOL: QuestDefinition[] = [
  {
    id: "daily-catch-10",
    kind: "daily",
    title: "Rounds of fieldwork",
    detail: "Catch 10 Pokémon",
    icon: "planet-outline",
    goal: 10,
    reward: { coins: 40, balls: 2 },
    progress: (s) => s.todayCatches,
  },
  {
    id: "daily-catch-25",
    kind: "daily",
    title: "Marathon survey",
    detail: "Catch 25 Pokémon",
    icon: "footsteps-outline",
    goal: 25,
    reward: { coins: 90, balls: 4 },
    progress: (s) => s.todayCatches,
  },
  {
    id: "daily-shiny",
    kind: "daily",
    title: "Find the rare shine",
    detail: "Catch a shiny Pokémon",
    icon: "sparkles-outline",
    goal: 1,
    reward: { coins: 60, balls: 3 },
    progress: (s) => s.todayShinies,
  },
  {
    id: "daily-win-3",
    kind: "daily",
    title: "Hold the line",
    detail: "Win 3 battles",
    icon: "shield-outline",
    goal: 3,
    reward: { coins: 70, balls: 2 },
    progress: (s) => s.todayBattlesWon,
  },
  {
    id: "daily-type-5",
    kind: "daily",
    title: "Specialisation",
    detail: "Catch 5 of one type",
    icon: "flask-outline",
    goal: 5,
    reward: { coins: 55, balls: 2 },
    progress: (s) => Math.max(0, ...Object.values(s.todayTypes)),
  },
  {
    id: "daily-battle-5",
    kind: "daily",
    title: "Non-stop duels",
    detail: "Win 5 battles",
    icon: "flame-outline",
    goal: 5,
    reward: { coins: 120, balls: 3 },
    progress: (s) => s.todayBattlesWon,
  },
];

const ACHIEVEMENTS: QuestDefinition[] = [
  {
    id: "ach-first-catch",
    kind: "achievement",
    title: "Field apprentice",
    detail: "Catch your first Pokémon",
    icon: "ellipse-outline",
    goal: 1,
    reward: { coins: 50, balls: 3 },
    progress: (s) => s.totalCatches,
  },
  {
    id: "ach-species-25",
    kind: "achievement",
    title: "Getting organised",
    detail: "Register 25 species",
    icon: "albums-outline",
    goal: 25,
    reward: { coins: 150, balls: 5 },
    progress: (s) => s.speciesCount,
  },
  {
    id: "ach-species-100",
    kind: "achievement",
    title: "Serious collector",
    detail: "Register 100 species",
    icon: "albums-outline",
    goal: 100,
    reward: { coins: 400, balls: 8 },
    progress: (s) => s.speciesCount,
  },
  {
    id: "ach-species-250",
    kind: "achievement",
    title: "Living database",
    detail: "Register 250 species",
    icon: "library-outline",
    goal: 250,
    reward: { coins: 1200, balls: 12 },
    progress: (s) => s.speciesCount,
  },
  {
    id: "ach-shiny-1",
    kind: "achievement",
    title: "A different light",
    detail: "Catch your first shiny",
    icon: "sparkles",
    goal: 1,
    reward: { coins: 100, balls: 5 },
    progress: (s) => s.totalShinies,
  },
  {
    id: "ach-shiny-10",
    kind: "achievement",
    title: "Shine hunter",
    detail: "Catch 10 shinies",
    icon: "sparkles",
    goal: 10,
    reward: { coins: 600, balls: 10 },
    progress: (s) => s.totalShinies,
  },
  {
    id: "ach-catches-100",
    kind: "achievement",
    title: "Never leaving the field",
    detail: "Catch 100 Pokémon",
    icon: "footsteps-outline",
    goal: 100,
    reward: { coins: 250, balls: 5 },
    progress: (s) => s.totalCatches,
  },
  {
    id: "ach-catches-500",
    kind: "achievement",
    title: "Obsessed",
    detail: "Catch 500 Pokémon",
    icon: "footsteps-outline",
    goal: 500,
    reward: { coins: 900, balls: 10 },
    progress: (s) => s.totalCatches,
  },
  {
    id: "ach-level-10",
    kind: "achievement",
    title: "Trailblazer",
    detail: "Reach Trainer Level 10",
    icon: "trending-up-outline",
    goal: 10,
    reward: { coins: 200, balls: 4 },
    progress: (s) => s.level,
  },
  {
    id: "ach-level-25",
    kind: "achievement",
    title: "Route veteran",
    detail: "Reach Trainer Level 25",
    icon: "trending-up-outline",
    goal: 25,
    reward: { coins: 700, balls: 8 },
    progress: (s) => s.level,
  },
  {
    id: "ach-battles-10",
    kind: "achievement",
    title: "Battle-tested",
    detail: "Win 10 battles",
    icon: "shield-outline",
    goal: 10,
    reward: { coins: 300, balls: 5 },
    progress: (s) => s.battlesWon,
  },
  {
    id: "ach-streak-7",
    kind: "achievement",
    title: "Seven days running",
    detail: "Reach a 7-day daily streak",
    icon: "flame-outline",
    goal: 7,
    reward: { coins: 350, balls: 8 },
    progress: (s) => s.streak,
  },
];

export function achievementQuests(): QuestDefinition[] {
  return ACHIEVEMENTS;
}

/**
 * Three daily quests, picked deterministically from the pool by the UTC day so
 * every trainer on a given day works toward the same list.
 */
export function dailyQuestsForDay(now: number): QuestDefinition[] {
  const dayNumber = Math.floor(now / 86_400_000);
  const picked: QuestDefinition[] = [];
  const used = new Set<number>();
  for (let i = 0; i < 3; i++) {
    let index = (dayNumber * 7 + i * 3) % DAILY_POOL.length;
    while (used.has(index)) index = (index + 1) % DAILY_POOL.length;
    used.add(index);
    picked.push(DAILY_POOL[index]);
  }
  return picked;
}

/**
 * Quests whose goal the snapshot has just reached and that have not been paid
 * out before. Callers diff this against `profile.claimedQuests`.
 */
export function newlyCompletedQuests(
  snapshot: QuestSnapshot,
  claimed: string[],
  now: number,
): QuestDefinition[] {
  const already = new Set(claimed);
  return [...dailyQuestsForDay(now), ...ACHIEVEMENTS].filter(
    (quest) => !already.has(claimIdFor(quest, now)) && quest.progress(snapshot) >= quest.goal,
  );
}

/**
 * Daily quests rotate, so a quest paid out yesterday can reappear on today's
 * list. Keying the claim log by bare quest id would swallow it again, so daily
 * rewards are keyed by id *and* the day they were earned.
 */
export function claimIdFor(quest: QuestDefinition, now: number): string {
  return quest.kind === "daily" ? `${quest.id}@${new Date(now).toISOString().slice(0, 10)}` : quest.id;
}
