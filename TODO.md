# Game systems

The app started as a PokéAPI browser. It is now a loop:

> **throw a ball → see what came out → watch the level move → spend it**

Everything below is implemented and server-authoritative. `convex/lib/gameLogic.ts`
holds the pure rules (XP curve, pool size, type chart, ball odds) and is imported by
both the backend and the app, so the client can render the same numbers without a
round trip.

## The loop

| System | Where | Notes |
| --- | --- | --- |
| Poké Ball pulls | `convex/gameActions.ts` → `throwBall` | The roll (species + shiny) happens server-side; the client learns the outcome only after the write lands |
| Trainer levels | `convex/game.ts` → `grantRewards` | XP needed to advance from L is `80 + 40(L-1)` |
| Species pool | `poolCap(level)` | Kanto at level 1, +8 species per level, all 1002 by level 107. Leveling opens somewhere new rather than gating a feature |
| Ball tiers | `BALL_TIERS` | Poké 1/48 shiny, Great 1/24, Ultra 1/10. Better odds and better XP per tier |
| Passive timer | `settleBalls` | +1 Poké Ball every 20 min, capped at 10. Computed on read, flushed on write |
| Daily reward + streak | `claimDaily` | Escalates over 7 days; a missed day resets the streak. All day boundaries are UTC |
| Quests | `convex/lib/quests.ts` | 3 daily (rotating deterministically by day) + 12 lifetime. **Paid on completion** — there is no claim button |
| Battles | `app/battle.tsx` | Turn-based on the client, outcome reported to Convex |
| Coins + shop | `buyBall` | The only sink, so coins mean something |
| Leaderboard | `getLeaderboard` | Top 100 by XP |

## Tuning knobs

All in `convex/lib/gameLogic.ts` — these are the dials to turn if the loop feels
too fast or too slow:

- `xpToNext` — how fast levels arrive
- `POOL_PER_LEVEL` — how much new content a level opens
- `BALL_TIERS[*].shinyOdds` — how chaseable a shiny is (the main "one more" lever)
- `BALL_REGEN_MS` / `BALL_REGEN_CAP` — how often the app pulls you back
- `dailyRewardFor` — how punishing a missed day is

## Known simplifications

- **Battles resolve on the client.** The fight is simulated from PokéAPI stats and
  only the result is sent to the server, so it is not cheat-proof. Fine for a
  friends-and-family dex; move turn resolution server-side if it ever matters.
- **A determined client can call `commitCatch` directly** with a species of its
  choosing. The shiny roll and ball accounting are still server-side, so this buys
  a chosen Pokémon, not free rewards.
- **`getLeaderboard` reads the top 100 only.** Ranking below that returns `null`
  rather than scanning the whole table.
- **Species metadata warms lazily.** PokéAPI has no bulk "types of the first 151"
  endpoint, so `primeSpeciesMeta` fills the cache a batch at a time in the
  background. Uncaught tiles show a dex number until it lands.

## Not built yet

- Evolution chains — the API calls are straightforward, the interesting part is
  deciding what evolving a species is *worth*
- Team builder — needs a real `party` table and drag-and-drop over reanimated
- Battle abilities and status effects — currently a pure stat + type matchup
- Push notifications for the ball timer, which is the mechanic most in need of it
