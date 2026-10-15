import { View } from "react-native";
import { TYPE_COLORS } from "@/convex/lib/gameLogic";
import { Txt } from "@/components/ui/Txt";

type Props = {
  type: string;
  size?: "sm" | "md";
  /** Dims the chip for species the player has not caught yet. */
  muted?: boolean;
};

/**
 * Type chips carry the game's only categorical colour coding, so they always
 * render the type's own hue. The label is the anchor — colour alone never carries
 * the meaning, which keeps it readable for colour-blind players.
 */
export function TypeChip({ type, size = "md", muted = false }: Props) {
  const hue = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  const small = size === "sm";

  return (
    <View
      style={{
        paddingHorizontal: small ? 6 : 8,
        paddingVertical: small ? 1 : 3,
        borderRadius: 4,
        backgroundColor: muted ? "transparent" : hue,
        borderWidth: muted ? 1 : 0,
        borderColor: "#2C3044",
        opacity: muted ? 0.55 : 1,
      }}
    >
      <Txt
        w={small ? "semibold" : "bold"}
        color={muted ? "#8B8FA6" : "#141620"}
        style={{ fontSize: small ? 10 : 11, textTransform: "lowercase" }}
      >
        {type}
      </Txt>
    </View>
  );
}
