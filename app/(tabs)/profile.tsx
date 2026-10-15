import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { api } from "@/convex/_generated/api";
import { Txt, Label } from "@/components/ui/Txt";
import { Track } from "@/components/game/Track";
import { PokeBall } from "@/components/game/PokeBall";
import * as haptics from "@/lib/haptics";
import { formatNumber } from "@/lib/format";
import { BALL_ORDER, BALL_TIERS, MAX_POOL, poolCap } from "@/convex/lib/gameLogic";

/**
 * The trainer's account of themselves: how far along they are, what they can buy,
 * and where they rank. It is the only screen that is about the player rather than
 * the Pokémon, so it stays a ledger — hairline rows, no cards.
 */
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthActions();
  const user = useQuery(api.auth.getCurrentUser);
  const profile = useQuery(api.game.getProfile);
  const quests = useQuery(api.game.getQuests);
  const board = useQuery(api.game.getLeaderboard);
  const buyBall = useMutation(api.game.buyBall);

  const [buying, setBuying] = useState<string | null>(null);

  async function purchase(tier: "great" | "ultra") {
    setBuying(tier);
    try {
      await buyBall({ tier });
      haptics.press();
    } catch (error) {
      haptics.warn();
      Alert.alert("Not enough coins", error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  function confirmSignOut() {
    Alert.alert("Sign out", "You will need to sign in again to reach your dex.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          signOut().catch(() => Alert.alert("Error", "Could not sign out."));
        },
      },
    ]);
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Txt color="#5D6178">Loading your trainer card…</Txt>
      </View>
    );
  }

  const achievementsDone = quests?.achievements.filter((q) => q.done).length ?? 0;
  const achievementsTotal = quests?.achievements.length ?? 0;
  const winRate =
    profile.battlesWon + profile.battlesLost === 0
      ? null
      : Math.round((profile.battlesWon / (profile.battlesWon + profile.battlesLost)) * 100);

  return (
    <ScrollView
      className="flex-1 bg-ink"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 40,
      }}
    >
      <View className="flex-row items-center gap-3">
        {user?.image ? (
          <Image
            source={{ uri: user.image }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#1D2030",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person" size={22} color="#5D6178" />
          </View>
        )}
        <View className="flex-1">
          <Txt w="bold" color="#EDEAE0" style={{ fontSize: 18 }} numberOfLines={1}>
            {user?.name ?? "Trainer"}
          </Txt>
          <Txt color="#5D6178" style={{ fontSize: 12 }} numberOfLines={1}>
            {user?.email ?? ""}
          </Txt>
        </View>
        <View className="items-end">
          <Txt mono w="black" color="#E2483F" style={{ fontSize: 24 }}>
            {profile.level}
          </Txt>
          <Label color="#5D6178">LEVEL</Label>
        </View>
      </View>

      <View className="mt-4 gap-1.5">
        <Track value={profile.needed === 0 ? 0 : profile.intoLevel / profile.needed} />
        <Txt mono color="#5D6178" style={{ fontSize: 10 }}>
          {formatNumber(profile.intoLevel)} / {formatNumber(profile.needed)} XP TO NEXT LEVEL
        </Txt>
      </View>

      <Section title="PROGRESS">
        <Row
          icon="albums-outline"
          tint="#5FD3C4"
          label="Species registered"
          value={`${profile.speciesCount} / ${profile.poolCap}`}
        />
        <Row
          icon="sparkles"
          tint="#5FD3C4"
          label="Shinies"
          value={formatNumber(profile.totalShinies)}
        />
        <Row
          icon="ellipse-outline"
          tint="#EDEAE0"
          label="Total pulls"
          value={formatNumber(profile.totalCatches)}
        />
        <Row
          icon="trophy-outline"
          tint="#E9B23C"
          label="Achievements"
          value={`${achievementsDone} / ${achievementsTotal}`}
        />
        <Row
          icon="shield-outline"
          tint="#E9B23C"
          label="Battles"
          value={
            winRate === null
              ? "None yet"
              : `${profile.battlesWon} won · ${winRate}% win rate`
          }
          last
        />
      </Section>

      <Section
        title="UNLOCKS"
        hint={
          profile.poolMaxed
            ? "Complete"
            : `Lv ${profile.poolLevelNeeded} → ${profile.poolNextCap} species`
        }
      >
        <View className="py-3 gap-2">
          <Txt color="#8B8FA6" style={{ fontSize: 13 }}>
            {profile.poolMaxed
              ? "Every species is unlocked. The whole dex is yours to hunt."
              : `Reach Trainer Level ${profile.poolLevelNeeded} to open the pool past #${profile.poolCap}.`}
          </Txt>
          <View className="flex-row items-center gap-2">
            <View style={{ flex: 1 }}>
              <Track value={profile.poolCap / MAX_POOL} color="#E9B23C" height={4} />
            </View>
            <Txt mono color="#5D6178" style={{ fontSize: 11 }}>
              {profile.poolCap}/{MAX_POOL}
            </Txt>
          </View>
          {!profile.poolMaxed && profile.nextSpecies ? (
            <Txt color="#5D6178" style={{ fontSize: 12 }}>
              Next to register: #{profile.poolCap + 1} {profile.nextSpecies}
            </Txt>
          ) : null}
        </View>
      </Section>

      <Section title="BALL SHOP" hint={`${formatNumber(profile.coins)} coins`}>
        {BALL_ORDER.map((id, index) => {
          const tier = BALL_TIERS[id];
          const owned = profile.balls[id];
          const affordable = profile.coins >= tier.buyCost;

          return (
            <View
              key={id}
              className="flex-row items-center gap-3 py-3"
              style={index === BALL_ORDER.length - 1 ? undefined : { borderBottomWidth: 1, borderBottomColor: "#222638" }}
            >
              <PokeBall tier={id} phase="idle" size={34} />
              <View className="flex-1">
                <View className="flex-row items-baseline gap-2">
                  <Txt w="semibold" color="#EDEAE0" style={{ fontSize: 14 }}>
                    {tier.label}
                  </Txt>
                  <Txt mono color="#5D6178" style={{ fontSize: 11 }}>
                    ×{owned}
                  </Txt>
                </View>
                <Txt color="#5D6178" style={{ fontSize: 11 }}>
                  {tier.buyCost > 0
                    ? `${tier.tagline} · 1 in ${tier.shinyOdds}`
                    : `${tier.tagline} · 1 in ${tier.shinyOdds}`}
                </Txt>
              </View>

              {tier.buyCost > 0 ? (
                <Pressable
                  onPress={() => purchase(id as "great" | "ultra")}
                  disabled={!affordable || buying === id}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: affordable ? "#1D2030" : "#141620",
                    borderWidth: 1,
                    borderColor: affordable ? "#E9B23C" : "#222638",
                    opacity: buying === id ? 0.5 : 1,
                  }}
                >
                  <Txt mono w="bold" color={affordable ? "#E9B23C" : "#5D6178"} style={{ fontSize: 12 }}>
                    {tier.buyCost}
                  </Txt>
                </Pressable>
              ) : (
                <Txt mono color="#5D6178" style={{ fontSize: 11 }}>
                  free
                </Txt>
              )}
            </View>
          );
        })}
      </Section>

      <Section
        title="LEADERBOARD"
        hint={board?.myRank ? `You are #${board.myRank}` : undefined}
      >
        {(board?.rows.length ?? 0) === 0 ? (
          <View className="py-4">
            <Txt color="#5D6178" style={{ fontSize: 13 }}>
              No trainers ranked yet.
            </Txt>
          </View>
        ) : (
          board?.rows.slice(0, 10).map((row) => (
            <View
              key={row.rank}
              className="flex-row items-center gap-3 py-2.5"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#222638",
                backgroundColor: row.isMe ? "rgba(226,72,63,0.08)" : "transparent",
              }}
            >
              <Txt mono w="bold" color={row.rank <= 3 ? "#E9B23C" : "#5D6178"} style={{ fontSize: 12, width: 22 }}>
                {row.rank}
              </Txt>
              <View className="flex-1">
                <Txt w="semibold" color={row.isMe ? "#EDEAE0" : "#8B8FA6"} style={{ fontSize: 13 }}>
                  Level {row.level}
                </Txt>
                <Txt color="#5D6178" style={{ fontSize: 10 }}>
                  {row.species} species
                  {row.shinies > 0 ? ` · ${row.shinies} shiny` : ""}
                </Txt>
              </View>
              <Txt mono color="#8B8FA6" style={{ fontSize: 12 }}>
                {formatNumber(row.xp)}
              </Txt>
            </View>
          ))
        )}
        {board && !board.myRank ? (
          <View className="pt-3">
            <Txt color="#5D6178" style={{ fontSize: 11 }}>
              Keep catching to climb into the top {board.depth}.
            </Txt>
          </View>
        ) : null}
      </Section>

      <Link href="/favorites" asChild>
        <Pressable
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 13,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#2C3044",
            marginBottom: 10,
          }}
        >
          <Ionicons name="heart-outline" size={16} color="#8B8FA6" />
          <Txt w="semibold" color="#EDEAE0" style={{ fontSize: 14 }} className="flex-1">
            Favourites
          </Txt>
          <Ionicons name="chevron-forward" size={15} color="#5D6178" />
        </Pressable>
      </Link>

      <Pressable
        onPress={confirmSignOut}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#8E2F2A",
        }}
      >
        <Ionicons name="log-out-outline" size={16} color="#E2483F" />
        <Txt w="semibold" color="#E2483F" style={{ fontSize: 14 }}>
          Sign out
        </Txt>
      </Pressable>

      <Txt color="#3A3F55" style={{ fontSize: 11, marginTop: 16, textAlign: "center" }}>
        Next unlock at Level {poolCap(profile.level + 1) >= MAX_POOL ? MAX_POOL : poolCap(profile.level + 1)} species
      </Txt>
    </ScrollView>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6">
      <View className="flex-row items-baseline justify-between mb-2">
        <Label color="#5D6178">{title}</Label>
        {hint ? (
          <Txt color="#5D6178" style={{ fontSize: 11 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <View className="border border-ink-line rounded-cell bg-ink-raised px-3">{children}</View>
    </View>
  );
}

function Row({
  icon,
  tint,
  label,
  value,
  last,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className="flex-row items-center gap-3 py-3"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: "#222638" }}
    >
      <Ionicons name={icon as never} size={15} color={tint} />
      <Txt color="#EDEAE0" style={{ fontSize: 13 }} className="flex-1">
        {label}
      </Txt>
      <Txt mono w="bold" color="#EDEAE0" style={{ fontSize: 12 }}>
        {value}
      </Txt>
    </View>
  );
}
