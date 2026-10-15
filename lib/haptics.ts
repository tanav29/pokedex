import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Haptics, wrapped so screens describe *what happened* rather than which pattern
 * to fire, and so web and unsupported platforms degrade to a no-op instead of
 * throwing.
 */

const supported = Platform.OS === "ios" || Platform.OS === "android";

const notify = (
  run: () => Promise<void>,
  fallback: () => Promise<void>,
) => (supported ? run() : fallback());

/** A pull leaving the hand. */
export const tap = () => notify(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), async () => {});

/** Confirmation of a choice — buying, sending to battle. */
export const press = () =>
  notify(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), async () => {});

/** Something was earned. */
export const reward = () =>
  notify(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), async () => {});

/** A shiny — the one moment that earns a whole pattern. */
export const fanfare = async () => {
  if (!supported) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setTimeout(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, 160);
};

/** Level-up: three rising taps. */
export const levelUp = async () => {
  if (!supported) return;
  for (const delay of [0, 130, 260]) {
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, delay);
  }
};

/** Out of resources, or an action was refused. */
export const warn = () =>
  notify(
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    async () => {},
  );
