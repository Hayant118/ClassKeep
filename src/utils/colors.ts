// src/utils/colors.ts
// Curated color palette and auto-assignment helpers for ClassKeep.

/**
 * Curated palette of 16 distinct, accessible colors used for students and classes.
 * Chosen to work well as small dots/swatches in both light and dark UI contexts.
 */
export const CURATED_PALETTE: readonly string[] = [
  '#6366f1', // indigo
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#e11d48', // rose
  '#64748b', // slate
  '#d946ef', // fuchsia
];

/**
 * Default fallback color used when no color can be assigned.
 */
export const DEFAULT_COLOR = '#6366f1';

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert a 3 or 6 digit hex color to HSL.
 */
export function hexToHsl(hex: string): Hsl {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: clamp(Math.round(s * 100), 0, 100),
    l: clamp(Math.round(l * 100), 0, 100),
  };
}

/**
 * Convert HSL values to a 6 digit hex color.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = clamp(s, 0, 100) / 100;
  const lNorm = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Normalize any hex-like input to a 6 digit lower-case hex color.
 * Returns undefined if the input is not a valid hex color.
 */
export function normalizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const hex = color.trim().toLowerCase();
  if (!/^#?[0-9a-f]{3}([0-9a-f]{3})?$/.test(hex)) return undefined;
  return hex.startsWith('#') ? hex : `#${hex}`;
}

/**
 * Pick the least-used color from the curated palette.
 * Falls back to the palette default if existingColors is empty/invalid.
 */
export function assignColor(existingColors: (string | undefined)[]): string {
  const normalized = existingColors
    .map((c) => normalizeColor(c))
    .filter((c): c is string => Boolean(c));

  if (normalized.length === 0) return CURATED_PALETTE[0];

  const usage = new Map<string, number>();
  for (const color of CURATED_PALETTE) {
    usage.set(color, 0);
  }
  for (const color of normalized) {
    const known = usage.has(color) ? color : undefined;
    if (known) usage.set(known, (usage.get(known) ?? 0) + 1);
  }

  let bestColor = CURATED_PALETTE[0];
  let bestCount = Infinity;
  for (const color of CURATED_PALETTE) {
    const count = usage.get(color) ?? 0;
    if (count < bestCount) {
      bestCount = count;
      bestColor = color;
    }
  }

  return bestColor;
}

/**
 * Generate lighter/darker shades of the same hue for family grouping.
 * Produces `count` distinct shades centered around the base color's lightness.
 */
export function generateFamilyShades(baseColor: string, count: number): string[] {
  const targetCount = Math.max(1, Math.floor(count));
  const hsl = hexToHsl(baseColor);

  if (targetCount === 1) {
    return [hslToHex(hsl.h, hsl.s, clamp(hsl.l, 35, 65))];
  }

  // Spread lightness between 30% and 70% to keep shades readable.
  const minL = 30;
  const maxL = 70;
  const step = (maxL - minL) / (targetCount - 1);

  const shades: string[] = [];
  for (let i = 0; i < targetCount; i++) {
    const l = minL + step * i;
    // Slightly reduce saturation for very light shades so they don't look washed out.
    const s = l > 60 ? clamp(hsl.s - (l - 60) * 1.5, 40, 100) : hsl.s;
    shades.push(hslToHex(hsl.h, s, l));
  }

  return shades;
}

/**
 * Choose the next family shade that is not already used by a sibling.
 */
export function assignFamilyShade(baseColor: string, existingShades: (string | undefined)[]): string {
  const normalized = existingShades
    .map((c) => normalizeColor(c))
    .filter((c): c is string => Boolean(c));

  const count = normalized.length + 1;
  const shades = generateFamilyShades(baseColor, count);

  for (const shade of shades) {
    if (!normalized.includes(shade)) return shade;
  }

  return shades[shades.length - 1] ?? DEFAULT_COLOR;
}
