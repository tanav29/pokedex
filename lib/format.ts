/** Formatting for the readouts. Keeps millisecond maths out of the screens. */

/** `92` -> `1:32`, `3725` -> `1:02:05`. Used for ball timers and streak countdowns. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Compact duration for prose: "in 18 min", "in 4 h 12 m". */
export function formatUntil(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Thousands separators for coin and XP totals. */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function progressRatio(progress: number, goal: number): number {
  if (goal <= 0) return 0;
  return clamp(progress / goal, 0, 1);
}
