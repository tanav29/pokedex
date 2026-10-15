# Pokédex

An Expo app that turns a PokéAPI browser into a collecting game: throw Poké Balls,
catch Pokémon, level up your trainer, work the daily quest list, and spend your
coins on better balls.

Built with Expo Router, NativeWind, Convex (auth + game state) and TanStack Query.

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://docs.expo.dev/go), a limited sandbox for trying out app development with Expo

## How the game works

The loop is **throw a ball → see what came out → watch the level move → spend it**.
Species, shiny rolls, XP and currency are all decided on the server, so the app
never shows a Pokémon the backend did not award.

- **Balls** refill passively (one every 20 minutes, capped at 10) and the countdown
  is on the main screen — that timer is the app's main reason to be reopened.
- **Levels** widen the species pool instead of gating a feature, so progress always
  opens somewhere new.
- **Quests** pay out the instant they complete. There is no claim button.
- **Daily streaks** escalate over a week and lapse if you miss a day.

`TODO.md` documents every system, where it lives, and which constants to turn if the
pace feels wrong. `docs/design-preview.html` renders the screens with the real
tokens and fonts.

## Project layout

```
app/                 routes — (tabs) holds encounter / dex / quests / trainer
components/game/     PokeBall, RevealCard, DexCell, QuestRow, TrainerHeader, …
components/ui/       Txt — the two-family type system every screen goes through
convex/game.ts       queries + mutations (profile, catches, quests, battles)
convex/gameActions.ts actions that need the network (pull roll, rival, cache warm)
convex/lib/          pure rules shared with the client — no convex imports
lib/                 design tokens, haptics, formatting
```

## Learn more

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into
  advanced topics with our [guides](https://docs.expo.dev/guides).
- [Convex documentation](https://docs.convex.dev/)

## Notes for future changes

- Game rules live in `convex/lib/gameLogic.ts` and import nothing from `convex/*`.
  That is what lets the app render the same numbers without a round trip.
- Actions that call `internal.*` must not live in the same module as the functions
  they call. The generated `api.d.ts` folds every module into one `fullApi`, so the
  reference cycles back through the caller and TypeScript never terminates
  inference. See `convex/gameActions.ts` for the note.
