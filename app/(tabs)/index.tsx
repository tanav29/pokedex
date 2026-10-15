import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAction, useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { Txt, Label } from "@/components/ui/Txt";
import { Track } from "@/components/game/Track";
import { PokeBall, type BallPhase } from "@/components/game/PokeBall";
import { RevealCard } from "@/components/game/RevealCard";
import { RewardToasts, useToastQueue } from "@/components/game/RewardToasts";
import { TrainerHeader } from "@/components/game/TrainerHeader";
import * as haptics from "@/lib/haptics";
import { formatNumber, formatUntil } from "@/lib/format";
import {
  BALL_ORDER,
  BALL_TIERS,
  msUntilNextDay,
  type BallId,
  type CatchResult,
  type TrainerProfile,
} from "@/convex/lib/gameLogic";

/**
 * The encounter screen — where the loop actually lives.
 *
 * A pull is four beats: the ball shakes while the server decides, it splits, the
 * species lands, and the rewards stack. The shake starts on the tap rather than
 * on the response so the wait reads as anticipation instead of latency, and it
 * always runs for its full duration even when the answer arrives early — cutting
 * it short would make every fast pull feel glitchy.
 */

const SHAKE_MS = 640;
const OPEN_MS = 430;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Encounter() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const profile = useQuery(api.game.getProfile);
  const throwBall = useAction(api.gameActions.throwBall);
  const claimDaily = useMutation(api.game.claimDaily);
  const buyBall = useMutation(api.game.buyBall);

  const [tier, setTier] = useState<BallId>("poke");
  const [phase, setPhase] = useState<BallPhase>("idle");
  const [result, setResult] = useState<CatchResult | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  const busy = useRef(false);
  const { toasts, push } = useToastQueue();

  const data: TrainerProfile | null = profile ?? null;
  const animating = phase === "shaking" || phase === "opening";
  const canPull = !!data && data.balls[tier] > 0 && !animating;

  const pull = useCallback(async () => {
    if (busy.current || !canPull || !data) return;
    busy.current = true;
    setPhase("shaking");
    haptics.tap();

    try {
      const [caught] = await Promise.all([
        throwBall({ tier }),
        sleep(SHAKE_MS),
      ]);

      setPhase("opening");
      await sleep(OPEN_MS);

      setResult(caught);
      setPhase("open");
      if (caught.shiny) {
        setBurstKey((n) => n + 1);
        void haptics.fanfare();
      } else {
        haptics.reward();
      }

      if (caught.xp) push({ icon: "flash", tint: "#E2483F", title: `${caught.pokemon.displayName} caught`, detail: `+${formatNumber(caught.xp)} XP` });
      if (caught.coins) push({ icon: "flash", tint: "#E9B23C", title: "Coins earned", detail: `+${formatNumber(caught.coins)}` });
      for (const quest of caught.quests) {
        push({ icon: "trophy", tint: "#5FD3C4", title: quest.title, detail: `+${formatNumber(quest.coins)}` });
      }
      if (caught.levelsGained > 0) {
        push({
          icon: "trending-up",
          tint: "#5FD3C4",
          title: `Trainer Level ${caught.profile.level}`,
          detail: caught.poolUnlocked > 0 ? `+${caught.poolUnlocked} species` : undefined,
        });
        void haptics.levelUp();
      }
    } catch (error) {
      setPhase("idle");
      haptics.warn();
      push({
        icon: "alert-circle",
        tint: "#E2483F",
        title: error instanceof Error ? error.message : "That pull did not go through",
      });
    } finally {
      busy.current = false;
    }
  }, [canPull, data, push, throwBall, tier]);

  const dismiss = useCallback(() => {
    setResult(null);
    setPhase("idle");
  }, []);

  const purchase = useCallback(
    async (id: BallId) => {
      try {
        await buyBall({ tier: id });
        haptics.press();
        setTier(id);
      } catch (error) {
        haptics.warn();
        push({
          icon: "alert-circle",
          tint: "#E2483F",
          title: error instanceof Error ? error.message : "Purchase failed",
        });
      }
    },
    [buyBall, push],
  );

  const collectDaily = useCallback(async () => {
    try {
      const outcome = await claimDaily({});
      haptics.reward();
      if (outcome.alreadyClaimed) {
        push({ icon: "checkmark-circle", tint: "#8B8FA6", title: "Already collected today" });
        return;
      }
      push({
        icon: "flame",
        tint: "#E2483F",
        title: `Day ${outcome.streak} streak`,
        detail: `+${outcome.reward?.balls ?? 0} balls`,
      });
    } catch (error) {
      push({
        icon: "alert-circle",
        tint: "#E2483F",
        title: error instanceof Error ? error.message : "Could not collect",
      });
    }
  }, [claimDaily, push]);

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Txt color="#5D6178">Loading your field kit…</Txt>
      </View>
    );
  }

  const stageSize = Math.min(width - 96, 190);
  const revealed = phase === "open" && result;

  return (
    <View className="flex-1 bg-ink">
      <View style={{ paddingTop: insets.top + 8 }}>
        <TrainerHeader profile={data} />
        <DailyStrip profile={data} onCollect={collectDaily} />
      </View>

      <View className="flex-1 items-center justify-center">
        {revealed && result ? (
          <RevealCard
            result={result}
            onDismiss={dismiss}
            burstKey={burstKey}
            width={width}
          />
        ) : (
          <Pressable
            onPress={pull}
            disabled={!canPull}
            accessibilityRole="button"
            accessibilityLabel={
              canPull ? `Throw a ${BALL_TIERS[tier].label}` : "No balls available"
            }
            style={{ opacity: canPull ? 1 : 0.45 }}
          >
            <View style={{ width: stageSize, height: stageSize, alignItems: "center", justifyContent: "center" }}>
              <PokeBall tier={tier} phase={phase} size={stageSize} />
              {phase === "idle" ? (
                <Txt
                  w="semibold"
                  color="#8B8FA6"
                  style={{ fontSize: 12, marginTop: 14 }}
                >
                  {canPull ? "Tap to throw" : `No ${BALL_TIERS[tier].label}s left`}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        )}
      </View>

      {!revealed ? (
        <View style={{ paddingBottom: insets.bottom + 12 }}>
          <TierRow
            profile={data}
            selected={tier}
            onSelect={setTier}
            onBuy={purchase}
          />
          <BallTimer profile={data} />
        </View>
      ) : null}

      <RewardToasts toasts={toasts} bottom={insets.bottom + 118} />
    </View>
  );
}

/** Streak state, and the only button on screen that pays out on a timer. */
function DailyStrip({
  profile,
  onCollect,
}: {
  profile: TrainerProfile;
  onCollect: () => void;
}) {
  const claimed = profile.claimedToday;
  // Held in state and advanced on a timer rather than read with Date.now() during
  // render, so the countdown stays live without breaking render purity.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View className="flex-row items-center gap-3 px-4 py-2.5 border-b border-ink-line-soft">
      <Ionicons name="flame" size={16} color={claimed ? "#5D6178" : "#E2483F"} />
      <View className="flex-1">
        <Txt w="semibold" color="#EDEAE0" style={{ fontSize: 13 }}>
          {profile.streak > 0 ? `${profile.streak}-day streak` : "Start a daily streak"}
        </Txt>
        <Txt color="#5D6178" style={{ fontSize: 11 }}>
          {claimed
            ? `Next reward in ${formatUntil(msUntilNextDay(now))}`
            : profile.streakAtRisk
              ? "Claim now or the streak lapses"
              : "Claim today's reward"}
        </Txt>
      </View>

      {!claimed ? (
        <Pressable
          onPress={onCollect}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 8,
            backgroundColor: "#E2483F",
          }}
        >
          <Txt w="bold" color="#141620" style={{ fontSize: 13 }}>
            Collect
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

function TierRow({
  profile,
  selected,
  onSelect,
  onBuy,
}: {
  profile: TrainerProfile;
  selected: BallId;
  onSelect: (id: BallId) => void;
  onBuy: (id: BallId) => void;
}) {
  return (
    <View className="flex-row gap-2 px-4">
      {BALL_ORDER.map((id) => {
        const tier = BALL_TIERS[id];
        const count = profile.balls[id];
        const active = selected === id;
        const empty = count === 0 && tier.buyCost > 0;

        return (
          <Pressable
            key={id}
            onPress={() => (empty ? onBuy(id) : onSelect(id))}
            disabled={!empty && active}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: active ? "#E2483F" : "#222638",
              backgroundColor: active ? "rgba(226,72,63,0.08)" : "#141620",
              alignItems: "center",
              gap: 3,
            }}
          >
            <PokeBall tier={id} phase="idle" size={26} />
            <Txt w="semibold" color={active ? "#EDEAE0" : "#8B8FA6"} style={{ fontSize: 11 }}>
              {tier.label.replace(" Ball", "")}
            </Txt>
            {empty ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="flash" size={10} color="#E9B23C" />
                <Txt mono w="bold" color="#E9B23C" style={{ fontSize: 11 }}>
                  {tier.buyCost}
                </Txt>
              </View>
            ) : (
              <>
                <Txt mono w="bold" color={count > 0 ? "#EDEAE0" : "#5D6178"} style={{ fontSize: 13 }}>
                  {count}
                </Txt>
                <Txt mono color="#5D6178" style={{ fontSize: 9 }}>
                  1/{tier.shinyOdds}
                </Txt>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The passive Poké Ball timer. It is the app's main reason to come back, so it is
 * given a real countdown rather than a vague "coming soon" — the bar fills as the
 * next ball approaches.
 */
function BallTimer({ profile }: { profile: TrainerProfile }) {
  const [, forceTick] = useState(0);
  const capped = profile.msToNextBall === null;

  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = profile.msToNextBall;
  const elapsedRatio = capped ? 1 : 1 - (remaining ?? 0) / (20 * 60 * 1000);

  return (
    <View className="px-4 pt-3 gap-1.5">
      <View className="flex-row items-center justify-between">
        <Label color="#5D6178">
          {capped ? "BALL TIMER FULL" : "NEXT FREE POKé BALL"}
        </Label>
        <Txt mono color="#8B8FA6" style={{ fontSize: 11 }}>
          {capped ? "Capped at 10" : formatUntil(remaining ?? 0)}
        </Txt>
      </View>
      <Track value={elapsedRatio} color={capped ? "#E9B23C" : "#2C3044"} height={3} />
    </View>
  );
}
