import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt, Label } from "@/components/ui/Txt";
import { Track } from "@/components/game/Track";
import { formatNumber } from "@/lib/format";
import type { TrainerProfile } from "@/convex/lib/gameLogic";

/**
 * The persistent trainer strip.
 *
 * Level and XP stay on screen everywhere because the level is the app's main
 * promise — it is what a pull is *for*. Coins and balls sit beside it so the
 * cost of the next pull is never more than a glance away.
 */
export function TrainerHeader({ profile }: { profile: TrainerProfile }) {
  const { level, intoLevel, needed, coins, balls, streak, poolMaxed, poolCap } = profile;
  const totalBalls = balls.poke + balls.great + balls.ultra;

  return (
    <View className="border-b border-ink-line px-4 pt-1 pb-3">
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-baseline gap-2">
          <Txt mono w="bold" color="#E2483F" style={{ fontSize: 22 }}>
            {level}
          </Txt>
          <Label color="#5D6178">LEVEL</Label>
        </View>

        <View className="flex-1 gap-1">
          <Track value={needed === 0 ? 0 : intoLevel / needed} />
          <View className="flex-row justify-between">
            <Txt mono color="#5D6178" style={{ fontSize: 10 }}>
              {formatNumber(intoLevel)} / {formatNumber(needed)} XP
            </Txt>
            <Txt mono color="#5D6178" style={{ fontSize: 10 }}>
              {poolMaxed ? `${poolCap} species` : `${poolCap} in pool`}
            </Txt>
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-4">
        <Stat
          icon="ellipse-outline"
          tint="#EDEAE0"
          value={`${balls.poke}/${balls.great}/${balls.ultra}`}
          caption="balls"
        />
        <Stat icon="flash" tint="#E9B23C" value={formatNumber(coins)} caption="coins" />
        {streak > 0 ? (
          <Stat
            icon="flame"
            tint={profile.streakAtRisk ? "#E2483F" : "#E2483F"}
            value={`${streak}`}
            caption="day streak"
          />
        ) : null}
        <View className="flex-1" />
        <View className="flex-row items-center gap-1">
          <Ionicons name="albums-outline" size={13} color="#5D6178" />
          <Txt mono color="#8B8FA6" style={{ fontSize: 11 }}>
            {profile.speciesCount}
          </Txt>
        </View>
      </View>

      {totalBalls === 0 ? (
        <Txt color="#E2483F" style={{ fontSize: 12 }} className="mt-2">
          Out of balls. A Poké Ball refills in {Math.ceil((profile.msToNextBall ?? 0) / 60000)} min.
        </Txt>
      ) : null}
    </View>
  );
}

function Stat({
  icon,
  tint,
  value,
  caption,
}: {
  icon: string;
  tint: string;
  value: string;
  caption: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon as never} size={13} color={tint} />
      <Txt mono w="bold" color="#EDEAE0" style={{ fontSize: 12 }}>
        {value}
      </Txt>
      <Txt color="#5D6178" style={{ fontSize: 11 }}>
        {caption}
      </Txt>
    </View>
  );
}
