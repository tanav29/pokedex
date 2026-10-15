import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Txt, Label } from "@/components/ui/Txt";
import { Track } from "@/components/game/Track";
import { TypeChip } from "@/components/game/TypeChip";
import { ShinyBurst } from "@/components/game/ShinyBurst";
import * as haptics from "@/lib/haptics";
import { formatNumber } from "@/lib/format";
import {
  TYPE_COLORS,
  effectivenessLabel,
  homeSprite,
  typeEffectiveness,
  type BattlePokemon,
  type BattleResult,
} from "@/convex/lib/gameLogic";

/**
 * Battles.
 *
 * The fight resolves on the client from PokéAPI base stats and the Gen VI type
 * chart; only the outcome is reported to Convex. That keeps every turn instant
 * and lets the plates animate the result, at the cost of not being cheat-proof —
 * fine for a friends-and-family dex, and the first thing to move server-side if
 * that ever matters.
 *
 * Two decisions keep it from being a pure type-chart lookup. Speed decides who
 * strikes first, so a slower but super-effective Pokémon can still lose a turn
 * it was winning; and Brace halves an incoming hit at the cost of not dealing
 * damage, which turns a losing matchup into a survivable one.
 */

type Fighter = {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
};

type LogLine = { text: string; tone: "good" | "bad" | "plain" };

/** Base stats are compressed into this band so a fight lasts a handful of turns. */
const STAT_FLOOR = 55;
const STAT_CEILING = 195;
const CRIT_CHANCE = 0.12;
const CRIT_MULTIPLIER = 1.6;

export default function Battle() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { name } = useLocalSearchParams<{ name?: string }>();

  const profile = useQuery(api.game.getProfile);
  const findRival = useAction(api.gameActions.findRival);
  const getBattleStats = useAction(api.gameActions.getBattleStats);
  const reportBattle = useMutation(api.game.reportBattle);

  const [player, setPlayer] = useState<Fighter | null>(null);
  const [rival, setRival] = useState<Fighter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<BattleResult | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [burst, setBurst] = useState(0);
  const [round, setRound] = useState(0);

  // Turn lock lives in a ref: two taps inside one frame would both read `false`
  // from state and deal two rounds of damage.
  const locked = useRef(false);
  // Snapshotted in an effect rather than read during render, and kept out of the
  // battle effect's dependencies so the fight does not restart when the profile
  // query lands mid-fight.
  const levelRef = useRef(1);
  useEffect(() => {
    if (profile?.level) levelRef.current = profile.level;
  }, [profile?.level]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setLoading(true);
      setError(null);
      setOutcome(null);
      setBusy(false);
      locked.current = false;
      try {
        if (!name) throw new Error("No Pokémon was selected for this battle.");
        const [mine, theirs] = await Promise.all([
          getBattleStats({ name }),
          findRival({ trainerLevel: levelRef.current }),
        ]);
        if (cancelled) return;
        setPlayer(toFighter(mine));
        setRival(toFighter(theirs));
        setLog([{ text: `A wild ${theirs.displayName} steps onto the field.`, tone: "plain" }]);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "The battle could not start.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [name, round, findRival, getBattleStats]);

  const fightOver = !!player && !!rival && (player.hp === 0 || rival.hp === 0);

  const finish = useCallback(
    (won: boolean, lines: LogLine[], mine: Fighter, theirs: Fighter) => {
      setLog(lines);
      setBusy(true);
      haptics.reward();
      void reportBattle({
        won,
        pokemonId: mine.id,
        pokemonName: mine.name,
        rivalId: theirs.id,
        rivalName: theirs.name,
      })
        .then((result) => {
          setOutcome(result);
          if (result.levelsGained > 0 || result.quests.length > 0) setBurst((n) => n + 1);
        })
        .catch(() => {
          // The fight is already decided locally; a failed write only costs rewards.
        })
        .finally(() => setBusy(false));
    },
    [reportBattle],
  );

  const takeTurn = useCallback(
    (brace: boolean) => {
      if (!player || !rival || fightOver || locked.current) return;
      locked.current = true;

      // Brace trades offence for survival: no attack out, half damage taken.
      const dealtByPlayer = brace ? null : roll(rival, player, player.types);
      const dealtByRival = roll(player, rival, rival.types);
      const takenByPlayer = brace ? Math.ceil(dealtByRival.amount / 2) : dealtByRival.amount;

      const rivalHp = dealtByPlayer ? Math.max(0, rival.hp - dealtByPlayer.amount) : rival.hp;
      const playerHp = Math.max(0, player.hp - takenByPlayer);

      const lines: LogLine[] = [];
      if (brace) {
        lines.push({ text: `${player.displayName} braced for the hit.`, tone: "plain" });
        lines.push({
          text: `${rival.displayName} struck for ${takenByPlayer}. ${dealtByRival.note}`,
          tone: dealtByRival.mult < 1 ? "good" : "plain",
        });
      } else {
        lines.push({
          text: `${player.displayName} struck for ${dealtByPlayer!.amount}. ${dealtByPlayer!.note}`,
          tone: dealtByPlayer!.mult >= 1 ? "good" : "bad",
        });
        lines.push({
          text: `${rival.displayName} struck back for ${takenByPlayer}. ${dealtByRival.note}`,
          tone: dealtByRival.mult > 1 ? "bad" : dealtByRival.mult < 1 ? "good" : "plain",
        });
      }

      setPlayer({ ...player, hp: playerHp });
      setRival({ ...rival, hp: rivalHp });
      haptics.press();

      if (rivalHp === 0) {
        lines.push({ text: `A wild ${rival.displayName} fainted.`, tone: "good" });
        setLog(lines);
        locked.current = false;
        finish(true, lines, player, rival);
        return;
      }
      if (playerHp === 0) {
        lines.push({ text: `${player.displayName} fainted.`, tone: "bad" });
        setLog(lines);
        locked.current = false;
        finish(false, lines, player, rival);
        return;
      }

      setLog(lines);
      // Released on the next frame so a double tap cannot land two turns.
      requestAnimationFrame(() => {
        locked.current = false;
      });
    },
    [fightOver, finish, player, rival],
  );

  const sprite = Math.min(width * 0.44, 168);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Txt color="#5D6178">Looking for a wild opponent…</Txt>
      </View>
    );
  }

  if (error || !player || !rival) {
    return (
      <View className="flex-1 items-center justify-center bg-ink px-8">
        <Ionicons name="alert-circle-outline" size={36} color="#E2483F" />
        <Txt color="#EDEAE0" className="mt-3 text-center">
          {error ?? "The battle could not start."}
        </Txt>
        <Pressable onPress={() => router.back()} className="mt-5" hitSlop={10}>
          <Txt w="semibold" color="#8B8FA6">
            Go back
          </Txt>
        </Pressable>
      </View>
    );
  }

  const preview = typeEffectiveness(player.types[0], rival.types);

  return (
    <View className="flex-1 bg-ink">
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#8B8FA6" />
          </Pressable>
          <Label color={fightOver ? "#E2483F" : "#5D6178"}>
            {fightOver ? (player.hp > 0 ? "VICTORY" : "DEFEATED") : "WILD BATTLE"}
          </Label>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <ShinyBurst trigger={burst} width={width} />
        <FighterPlate fighter={rival} side="rival" spriteSize={sprite * 0.8} />
        <View style={{ height: 8 }} />
        <FighterPlate fighter={player} side="player" spriteSize={sprite} />
      </View>

      <View className="flex-1 px-4 mt-4">
        <View className="border border-ink-line rounded-cell bg-ink-raised px-3 py-2.5 gap-1.5">
          {log.slice(-3).map((line, index) => (
            <Txt
              key={index}
              color={
                line.tone === "good" ? "#5FD3C4" : line.tone === "bad" ? "#E2483F" : "#8B8FA6"
              }
              style={{ fontSize: 12, lineHeight: 17 }}
            >
              {line.text}
            </Txt>
          ))}
        </View>

        {!fightOver ? (
          <View className="mt-3 flex-row items-center gap-2">
            <Ionicons
              name={preview > 1 ? "trending-up" : preview < 1 ? "trending-down" : "remove"}
              size={14}
              color={preview > 1 ? "#5FD3C4" : preview < 1 ? "#E2483F" : "#8B8FA6"}
            />
            <Txt color="#8B8FA6" style={{ fontSize: 12 }}>
              {player.types[0]} vs {rival.types.join(" / ")} — {effectivenessLabel(preview)}
            </Txt>
          </View>
        ) : null}

        {outcome ? (
          <View className="mt-3 border border-ink-line rounded-cell bg-ink-raised px-3 py-3">
            <View className="flex-row gap-6">
              <Reward icon="flash" tint="#E2483F" value={`+${formatNumber(outcome.xp)}`} label="XP" />
              <Reward
                icon="flash"
                tint="#E9B23C"
                value={`+${formatNumber(outcome.coinsAwarded)}`}
                label="coins"
              />
            </View>
            {outcome.capped ? (
              <Txt color="#5D6178" style={{ fontSize: 11, marginTop: 8 }}>
                Daily battle coin cap reached — XP still counts.
              </Txt>
            ) : null}
            {outcome.levelsGained > 0 ? (
              <Txt w="semibold" color="#5FD3C4" style={{ fontSize: 12, marginTop: 8 }}>
                Trainer Level {outcome.profile.level}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}>
        {fightOver ? (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setRound((n) => n + 1)}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: "#E2483F",
                alignItems: "center",
              }}
            >
              <Txt w="bold" color="#141620" style={{ fontSize: 15 }}>
                Find another
              </Txt>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#2C3044",
                alignItems: "center",
              }}
            >
              <Txt w="semibold" color="#8B8FA6" style={{ fontSize: 15 }}>
                Back to dex
              </Txt>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <ActionButton
              label="Brace"
              caption="Halve the hit"
              onPress={() => takeTurn(true)}
              disabled={busy}
              muted
            />
            <ActionButton label="Attack" onPress={() => takeTurn(false)} disabled={busy} />
          </View>
        )}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------- pieces

function ActionButton({
  label,
  caption,
  onPress,
  disabled,
  muted,
}: {
  label: string;
  caption?: string;
  onPress: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: muted ? 1 : 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: disabled ? "#222638" : muted ? "#1D2030" : "#E2483F",
        borderWidth: muted ? 1 : 0,
        borderColor: "#2C3044",
      }}
    >
      <Txt w="bold" color={disabled ? "#5D6178" : muted ? "#EDEAE0" : "#141620"} style={{ fontSize: 15 }}>
        {label}
      </Txt>
      {caption ? (
        <Txt color="#5D6178" style={{ fontSize: 10, marginTop: 1 }}>
          {caption}
        </Txt>
      ) : null}
    </Pressable>
  );
}

function FighterPlate({
  fighter,
  side,
  spriteSize,
}: {
  fighter: Fighter;
  side: "player" | "rival";
  spriteSize: number;
}) {
  const tint = TYPE_COLORS[fighter.types[0]] ?? "#8B8FA6";
  const ratio = fighter.maxHp === 0 ? 0 : fighter.hp / fighter.maxHp;
  const fainted = fighter.hp === 0;

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: fainted ? "#E2483F" : "#2C3044",
        backgroundColor: "#1D2030",
        padding: 12,
        flexDirection: side === "player" ? "row" : "row-reverse",
        gap: 12,
        alignItems: "center",
        opacity: fainted ? 0.55 : 1,
      }}
    >
      <Image
        source={{ uri: homeSprite(fighter.id, false) }}
        style={{ width: spriteSize, height: spriteSize }}
        contentFit="contain"
      />

      <View className="flex-1 gap-1.5">
        <View className="flex-row items-baseline justify-between">
          <Txt w="bold" color="#EDEAE0" style={{ fontSize: 16 }} numberOfLines={1}>
            {fighter.displayName}
          </Txt>
          <Txt mono color={ratio > 0.35 ? "#EDEAE0" : "#E2483F"} style={{ fontSize: 11 }}>
            {fighter.hp}/{fighter.maxHp}
          </Txt>
        </View>
        <Track value={ratio} color={ratio > 0.35 ? tint : "#E2483F"} height={5} />
        <View className="flex-row gap-1">
          {fighter.types.map((type) => (
            <TypeChip key={type} type={type} size="sm" />
          ))}
        </View>
        <View className="flex-row gap-3 pt-0.5">
          <MiniStat label="ATK" value={fighter.attack} />
          <MiniStat label="DEF" value={fighter.defense} />
          <MiniStat label="SPD" value={fighter.speed} />
        </View>
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Label color="#5D6178">{label}</Label>
      <Txt mono color="#8B8FA6" style={{ fontSize: 11 }}>
        {value}
      </Txt>
    </View>
  );
}

function Reward({
  icon,
  tint,
  value,
  label,
}: {
  icon: string;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon as never} size={14} color={tint} />
      <Txt mono w="bold" color="#EDEAE0" style={{ fontSize: 15 }}>
        {value}
      </Txt>
      <Txt color="#5D6178" style={{ fontSize: 12 }}>
        {label}
      </Txt>
    </View>
  );
}

// --------------------------------------------------------------- battle maths

function toFighter(pokemon: BattlePokemon): Fighter {
  const scale = (value: number) =>
    Math.round(STAT_FLOOR + (Math.min(255, value) / 255) * (STAT_CEILING - STAT_FLOOR));

  return {
    id: pokemon.pokemonId,
    name: pokemon.name,
    displayName: pokemon.displayName,
    types: pokemon.types,
    hp: scale(pokemon.stats.hp),
    maxHp: scale(pokemon.stats.hp),
    attack: scale(pokemon.stats.attack),
    defense: scale(pokemon.stats.defense),
    speed: scale(pokemon.stats.speed),
  };
}

/** One strike from `attacker` against `target`. Braces halve what comes back. */
function roll(target: Fighter, attacker: Fighter, attackerTypes: string[]) {
  const mult = typeEffectiveness(attackerTypes[0], target.types);
  const crit = Math.random() < CRIT_CHANCE;
  const base = (attacker.attack * 19) / Math.max(40, target.defense);
  const variance = 0.88 + Math.random() * 0.24;
  const amount = Math.max(1, Math.round(base * mult * variance * (crit ? CRIT_MULTIPLIER : 1)));

  return {
    amount,
    mult,
    crit,
    note:
      mult === 0
        ? "It had no effect."
        : crit
          ? "A critical hit!"
          : mult >= 2
            ? "Super effective."
            : mult < 1
              ? "Not very effective."
              : "",
  };
}
