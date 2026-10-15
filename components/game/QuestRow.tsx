import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt, Label } from "@/components/ui/Txt";
import { Track } from "@/components/game/Track";
import { formatNumber } from "@/lib/format";

export type QuestView = {
  id: string;
  kind: "daily" | "achievement";
  title: string;
  detail: string;
  icon: string;
  goal: number;
  progress: number;
  done: boolean;
  reward: { coins: number; balls?: number };
};

const TINT = {
  done: "#5FD3C4",
  active: "#E2483F",
  locked: "#3A3F55",
};

/**
 * Quests are rows, not cards. A list of twenty achievements should read as one
 * ledger you scan down, and hairline dividers do that better than twenty rounded
 * rectangles would.
 *
 * There is no claim button — rewards land the instant a quest completes — so a
 * finished quest shows a check and gets out of the way.
 */
export function QuestRow({ quest, last }: { quest: QuestView; last?: boolean }) {
  const tint = quest.done ? TINT.done : TINT.active;

  return (
    <View
      className="flex-row items-center gap-3 py-3"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: "#222638" }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: quest.done ? "rgba(95,211,196,0.12)" : "#1D2030",
          borderWidth: 1,
          borderColor: quest.done ? "#2E6B66" : "#2C3044",
        }}
      >
        <Ionicons
          name={(quest.done ? "checkmark" : quest.icon) as never}
          size={17}
          color={quest.done ? TINT.done : "#8B8FA6"}
        />
      </View>

      <View className="flex-1 gap-1.5">
        <Txt w="semibold" color={quest.done ? "#EDEAE0" : "#EDEAE0"} style={{ fontSize: 14 }}>
          {quest.detail}
        </Txt>
        <Track value={quest.goal === 0 ? 0 : quest.progress / quest.goal} color={tint} height={4} />
        <View className="flex-row items-center gap-2">
          <Txt mono color="#5D6178" style={{ fontSize: 10 }}>
            {formatNumber(quest.progress)}/{formatNumber(quest.goal)}
          </Txt>
          {quest.done ? (
            <Txt color="#5FD3C4" style={{ fontSize: 11 }} className="w-1">
              Paid
            </Txt>
          ) : null}
        </View>
      </View>

      <View className="items-end gap-1">
        <View className="flex-row items-center gap-1">
          <Ionicons name="flash" size={11} color="#E9B23C" />
          <Txt mono w="bold" color="#E9B23C" style={{ fontSize: 12 }}>
            {quest.reward.coins}
          </Txt>
        </View>
        {quest.reward.balls ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="ellipse-outline" size={11} color="#8B8FA6" />
            <Txt mono w="bold" color="#8B8FA6" style={{ fontSize: 12 }}>
              {quest.reward.balls}
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function QuestSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <View className="flex-row items-baseline justify-between mb-1">
        <Label color="#5D6178">{title}</Label>
        {hint ? (
          <Txt color="#5D6178" style={{ fontSize: 11 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <View className="border border-ink-line rounded-cell bg-ink-raised px-3">
        {children}
      </View>
    </View>
  );
}
