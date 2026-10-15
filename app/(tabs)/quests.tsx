import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { Txt, Label } from "@/components/ui/Txt";
import { QuestRow, QuestSection } from "@/components/game/QuestRow";
import { formatNumber, formatUntil } from "@/lib/format";
import { msUntilNextDay } from "@/convex/lib/gameLogic";

/**
 * The daily list.
 *
 * Rewards are paid automatically the moment a quest completes, so this screen is
 * a read-only ledger — there is deliberately nothing to tap. That removes the
 * "did I remember to claim this?" chore that most quest systems quietly impose,
 * while the completed ticks still give the satisfaction of a checked-off list.
 */
export default function Quests() {
  const insets = useSafeAreaInsets();
  const quests = useQuery(api.game.getQuests);
  const now = useNow();

  if (!quests) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Txt color="#5D6178">Checking today&rsquo;s list…</Txt>
      </View>
    );
  }

  const dailyDone = quests.daily.filter((q) => q.done).length;
  const achievementsDone = quests.achievements.filter((q) => q.done).length;

  return (
    <ScrollView
      className="flex-1 bg-ink"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
    >
      <Label color="#5D6178">QUESTS</Label>
      <Txt w="black" color="#EDEAE0" style={{ fontSize: 26 }}>
        Today
      </Txt>
      <Txt color="#5D6178" style={{ fontSize: 12, marginTop: 2 }}>
        {dailyDone} of {quests.daily.length} done · resets in{" "}
        {formatUntil(msUntilNextDay(now))}
      </Txt>

      <View className="mt-5">
        <QuestSection title="DAILY">
          {quests.daily.map((quest, index) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              last={index === quests.daily.length - 1}
            />
          ))}
        </QuestSection>

        <QuestSection
          title="LIFETIME"
          hint={`${achievementsDone}/${quests.achievements.length}`}
        >
          {quests.achievements.map((quest, index) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              last={index === quests.achievements.length - 1}
            />
          ))}
        </QuestSection>

        <View className="border border-ink-line rounded-cell bg-ink-raised p-4">
          <Label color="#5D6178">TALLY</Label>
          <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-3">
            <Tally icon="albums-outline" tint="#5FD3C4" label="species" value={formatNumber(quests.totals.species)} />
            <Tally icon="sparkles" tint="#5FD3C4" label="shinies" value={formatNumber(quests.totals.shinies)} />
            <Tally icon="ellipse-outline" tint="#EDEAE0" label="pulls" value={formatNumber(quests.totals.pulls)} />
            <Tally icon="shield-outline" tint="#E9B23C" label="wins" value={formatNumber(quests.totals.battlesWon)} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Tally({
  icon,
  tint,
  label,
  value,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={icon as never} size={14} color={tint} />
      <Txt mono w="bold" color={tint} style={{ fontSize: 15 }}>
        {value}
      </Txt>
      <Txt color="#8B8FA6" style={{ fontSize: 12 }}>
        {label}
      </Txt>
    </View>
  );
}

/** Ticks once a minute purely so the reset countdown stays honest. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
