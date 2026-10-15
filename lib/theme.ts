/**
 * Design tokens.
 *
 * The app is styled as a trainer's field terminal: a blue-shifted near-black
 * ground, hairline rules, and two accents in tension — Poké Ball red for anything
 * you act on, a cool foil teal for anything rare. Warm off-white carries all the
 * type so the sprites read as the only saturated imagery on screen.
 *
 * These are mirrored into `tailwind.config.js` so they are usable as ordinary
 * utility classes (`bg-ink-raised`, `text-paper-dim`). Import from here when a
 * value is needed in JS (animations, SVG fills, native styles).
 */

export const ink = {
  /** Page ground. Blue-shifted so it never reads as a flat black rectangle. */
  ground: "#141620",
  raised: "#1D2030",
  sunken: "#0E1017",
  /** Hairline rules and borders. */
  line: "#2C3044",
  lineSoft: "#222638",
} as const;

export const paper = {
  DEFAULT: "#EDEAE0",
  dim: "#8B8FA6",
  faint: "#5D6178",
} as const;

export const accent = {
  /** Anything the player can act on. */
  ball: "#E2483F",
  ballDim: "#8E2F2A",
  /** Shinies, rare drops, anything the player does not already own. */
  foil: "#5FD3C4",
  /** Coins and achievements. */
  gold: "#E9B23C",
} as const;

/** Single hairline, used everywhere instead of shadows. */
export const HAIRLINE = 1;

export const radius = {
  cell: 14,
  stamp: 6,
  chip: 4,
  pill: 999,
} as const;

/**
 * Hard offset shadows read as screenprint rather than as floating material, which
 * suits the field-guide framing. Used only for stamped elements.
 */
export const stampShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.45,
  shadowRadius: 0,
  elevation: 3,
} as const;

export const typeColor = {
  DEFAULT: "#9FA3B0",
} as const;
