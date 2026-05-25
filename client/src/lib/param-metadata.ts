// Metadata for HX effect block parameters.
//
// Imported `.hlx` files store model parameter values verbatim on each
// effect block (e.g. `Mix`, `Tone`, `Time`, `Feedback`, ...). The values
// come in a few shapes:
//   - normalized floats in [0, 1]   (Mix, Level, Tone, Sustain, ...)
//   - frequencies in Hz             (LowCut, HighCut)
//   - semitone offsets              (Heel, Toe)
//   - booleans                      (TempoSync1, B Polarity, bypass)
//   - small integer enums           (SyncSelect1: tempo-sync note slot)
//
// We don't have an authoritative spec for every model+parameter, so this
// file encodes the common ones and we fall back to a value-shape heuristic
// for the rest. The editor only renders controls for parameters that
// already exist on the block (i.e. were preserved from import) — we do
// not invent parameters for newly added blocks.

export type ParamControl =
  | { kind: "slider"; min: number; max: number; step: number; unit?: string; format?: (v: number) => string }
  | { kind: "number"; min?: number; max?: number; step?: number; unit?: string }
  | { kind: "boolean" }
  | { kind: "enum"; options: { value: number | string; label: string }[] }
  | { kind: "text" };

export interface ParamDef {
  label: string;
  control: ParamControl;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const ms = (v: number) => `${Math.round(v * 2000)} ms`; // Time slider 0..1 ≈ 0..2000 ms
const semis = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)} st`;
const dB = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`);

const NORMALIZED_0_1: ParamControl = { kind: "slider", min: 0, max: 1, step: 0.01, format: pct };
const TIME_0_1: ParamControl = { kind: "slider", min: 0, max: 1, step: 0.001, format: ms };
const SEMITONE: ParamControl = { kind: "slider", min: -24, max: 24, step: 1, format: semis };
const DB_GAIN: ParamControl = { kind: "slider", min: -12, max: 12, step: 0.1, format: dB };
const LOWCUT_HZ: ParamControl = { kind: "slider", min: 20, max: 2000, step: 1, format: hz };
const HIGHCUT_HZ: ParamControl = { kind: "slider", min: 1000, max: 20000, step: 10, format: hz };

// Common tempo-sync note divisions used across HX delay/mod blocks.
// (The exact integer encoding may vary by model; this covers the
// standard set seen in HX Edit.)
const TEMPO_SYNC_SLOTS: ParamControl = {
  kind: "enum",
  options: [
    { value: 0, label: "Whole" },
    { value: 1, label: "Dotted Half" },
    { value: 2, label: "Half" },
    { value: 3, label: "Half Triplet" },
    { value: 4, label: "Dotted Quarter" },
    { value: 5, label: "Quarter" },
    { value: 6, label: "Quarter Triplet" },
    { value: 7, label: "Dotted Eighth" },
    { value: 8, label: "Eighth" },
    { value: 9, label: "Eighth Triplet" },
    { value: 10, label: "Dotted Sixteenth" },
    { value: 11, label: "Sixteenth" },
    { value: 12, label: "Sixteenth Triplet" },
    { value: 13, label: "Dotted Thirty-Second" },
    { value: 14, label: "Thirty-Second" },
    { value: 15, label: "Thirty-Second Triplet" },
  ],
};

// Parameter metadata keyed by parameter name. These names come straight
// from the `.hlx` JSON keys (case + spaces preserved).
const COMMON_PARAMS: Record<string, ParamDef> = {
  Mix: { label: "Mix", control: NORMALIZED_0_1 },
  Level: { label: "Level", control: { kind: "slider", min: -60, max: 12, step: 0.1, format: dB } },
  Tone: { label: "Tone", control: NORMALIZED_0_1 },
  Sustain: { label: "Sustain", control: NORMALIZED_0_1 },
  Sensitivity: { label: "Sensitivity", control: NORMALIZED_0_1 },
  Decay: { label: "Decay", control: NORMALIZED_0_1 },
  Predelay: { label: "Pre-Delay", control: { kind: "slider", min: 0, max: 0.5, step: 0.001, format: (v) => `${Math.round(v * 1000)} ms` } },
  Feedback: { label: "Feedback", control: NORMALIZED_0_1 },
  Scale: { label: "Scale", control: NORMALIZED_0_1 },
  Time: { label: "Time", control: TIME_0_1 },
  TempoSync1: { label: "Tempo Sync", control: { kind: "boolean" } },
  TempoSync2: { label: "Tempo Sync 2", control: { kind: "boolean" } },
  SyncSelect1: { label: "Note", control: TEMPO_SYNC_SLOTS },
  SyncSelect2: { label: "Note 2", control: TEMPO_SYNC_SLOTS },
  LowCut: { label: "Low Cut", control: LOWCUT_HZ },
  HighCut: { label: "High Cut", control: HIGHCUT_HZ },
  Gain: { label: "Gain", control: DB_GAIN },
  Heel: { label: "Heel", control: SEMITONE },
  Toe: { label: "Toe", control: SEMITONE },
  Pedal: { label: "Pedal", control: NORMALIZED_0_1 },
  BalanceA: { label: "Balance A", control: NORMALIZED_0_1 },
  BalanceB: { label: "Balance B", control: NORMALIZED_0_1 },
  "A Pan": { label: "A Pan", control: NORMALIZED_0_1 },
  "B Pan": { label: "B Pan", control: NORMALIZED_0_1 },
  "A Level": { label: "A Level", control: DB_GAIN },
  "B Level": { label: "B Level", control: DB_GAIN },
  "B Polarity": { label: "B Polarity Invert", control: { kind: "boolean" } },
  bypass: { label: "Bypass", control: { kind: "boolean" } },
};

/** Resolve a parameter definition for a given model + key + current value.
 * Falls back to a value-shape heuristic when no entry is registered. */
export function getParamDef(_model: string, key: string, value: unknown): ParamDef {
  const direct = COMMON_PARAMS[key];
  if (direct) return direct;

  if (typeof value === "boolean") {
    return { label: key, control: { kind: "boolean" } };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { label: key, control: { kind: "number", step: 1 } };
    }
    if (value >= 0 && value <= 1) {
      return { label: key, control: NORMALIZED_0_1 };
    }
    return { label: key, control: { kind: "number", step: 0.01 } };
  }
  return { label: key, control: { kind: "text" } };
}

/** Stable display order — registered params first (in declared order),
 * then any unrecognized params alphabetically. */
export function sortParamKeys(keys: string[]): string[] {
  const known = Object.keys(COMMON_PARAMS);
  const knownSet = new Set(known);
  const inOrder = known.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !knownSet.has(k)).sort();
  return [...inOrder, ...rest];
}
