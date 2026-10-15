import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt } from "@/components/ui/Txt";

/**
 * Rewards are stacked and auto-dismissed rather than shown one at a time, so a
 * lucky pull that lands four things at once (XP, coins, a quest, a level) never
 * makes the player wait through three separate interruptions.
 */

export type Toast = {
  id: number;
  icon: string;
  /** Left-hand colour. Rewards are gold, progress is red, rare is foil teal. */
  tint: string;
  title: string;
  detail?: string;
};

const VISIBLE_MS = 2200;

export function RewardToasts({ toasts, bottom }: { toasts: Toast[]; bottom: number }) {
  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom, gap: 8 }}
    >
      {toasts.slice(-3).map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

function ToastRow({ toast }: { toast: Toast }) {
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(enter, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      Animated.delay(VISIBLE_MS),
      Animated.timing(enter, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [enter]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: "#1D2030",
          borderWidth: 1,
          borderColor: "#2C3044",
        }}
      >
        <Ionicons name={toast.icon as never} size={15} color={toast.tint} />
        <Txt w="semibold" color="#EDEAE0" style={{ fontSize: 13 }} className="flex-1">
          {toast.title}
        </Txt>
        {toast.detail ? (
          <Txt mono w="bold" color={toast.tint} style={{ fontSize: 12 }}>
            {toast.detail}
          </Txt>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** Adds toasts with unique ids and retires them on a timer. */
export function useToastQueue() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  function push(toast: Omit<Toast, "id">) {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...toast, id }]);
    const timer = setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
      timers.current = timers.current.filter((t) => t !== timer);
    }, VISIBLE_MS + 600);
    timers.current.push(timer);
  }

  return { toasts, push };
}
