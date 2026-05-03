import {
  EffectBlock,
  Snapshot,
  Footswitch,
  GlobalMidiSettings,
} from "@shared/schema";
import { baseHlxTemplate } from "./hlx-template";
import { effectsMapping } from "./effects-mapping";

export interface PresetData {
  name: string;
  effectBlocks: EffectBlock[];
  snapshots: Snapshot[];
  footswitches: Footswitch[];
  globalMidi: GlobalMidiSettings;
  rawHlx?: any;
}

const NUM_BLOCKS = 9;
const NUM_SNAPSHOTS = 4;
const NUM_FOOTSWITCHES = 6;

const COMMAND_HX_SNAPSHOT = 15;
const COMMAND_BLOCK_BYPASS = 4; // best-effort; HX Edit may relabel

const DEFAULT_FS_LEDCOLOR = 462860;

function emptyBlocks(): EffectBlock[] {
  return Array.from({ length: NUM_BLOCKS }, (_, i) => ({
    enabled: false,
    effect: "",
    position: i,
  }));
}

function emptySnapshots(): Snapshot[] {
  return Array.from({ length: NUM_SNAPSHOTS }, (_, i) => ({
    name: "",
    active: false,
    ledcolor: i + 1,
    tempo: 140,
    blockBypass: Array.from({ length: NUM_BLOCKS }, () => false),
  }));
}

function emptyFootswitches(): Footswitch[] {
  return Array.from({ length: NUM_FOOTSWITCHES }, () => ({
    assignment: "off" as const,
    value: "",
  }));
}

export function emptyGlobalMidi(): GlobalMidiSettings {
  return { tempo: 140 };
}

/**
 * Build an HLX preset object from the editor state.
 *
 * Strategy: clone the originally-imported file (or a built-in template) and
 * overlay only the fields the editor manages. Unknown fields — block
 * parameter values, controllers, dsp1, etc. — survive untouched so a
 * round-trip through the editor is non-destructive.
 */
export const generateHlxPreset = (data: PresetData): any => {
  const source = data.rawHlx ?? baseHlxTemplate;
  const preset = JSON.parse(JSON.stringify(source));

  if (!preset.data) preset.data = {};
  if (!preset.data.meta) preset.data.meta = {};
  if (!preset.data.tone) preset.data.tone = {};
  if (!preset.data.tone.dsp0) preset.data.tone.dsp0 = {};
  if (!preset.data.tone.global) preset.data.tone.global = {};

  preset.data.meta.name = data.name;
  preset.data.meta.modifieddate = Math.floor(Date.now() / 1000);

  // Preset tempo — the only global field the .hlx format actually carries.
  preset.data.tone.global["@tempo"] = data.globalMidi.tempo;

  // ---- Effect blocks ----
  const dsp0 = preset.data.tone.dsp0;
  for (let i = 0; i < NUM_BLOCKS; i++) {
    const blockKey = `block${i}`;
    const block = data.effectBlocks[i];
    if (!block || !block.effect) {
      delete dsp0[blockKey];
      continue;
    }
    const existed = !!(dsp0[blockKey] && typeof dsp0[blockKey] === "object");
    const existing: Record<string, any> = existed ? dsp0[blockKey] : {};
    const merged: Record<string, any> = {
      ...existing,
      ...(block.params || {}),
      "@model": block.effect,
      "@enabled": block.enabled,
      "@position": i + 1,
    };
    // Only synthesize HX-internal defaults for *new* blocks; for blocks that
    // already existed in the source, preserve the original key set exactly.
    if (!existed) {
      merged["@no_snapshot_bypass"] = false;
      merged["@path"] = 0;
      merged["@type"] = 0;
      merged["@stereo"] = false;
    }
    dsp0[blockKey] = merged;
  }

  // ---- Snapshots ----
  for (let i = 0; i < NUM_SNAPSHOTS; i++) {
    delete preset.data.tone[`snapshot${i}`];
  }

  data.snapshots.forEach((snapshot, index) => {
    if (!snapshot.name.trim()) return;
    const blockStates: Record<string, boolean> = {};
    data.effectBlocks.forEach((b, bIdx) => {
      if (!b.effect) return;
      const bypass = snapshot.blockBypass?.[bIdx];
      blockStates[`block${bIdx}`] = bypass ?? b.enabled;
    });

    // Only carry per-snapshot commands/controllers forward when the source
    // file supplied them. We don't fabricate stubs (their meaning isn't
    // documented well enough to invent values safely).
    const snap: Record<string, any> = {
      "@name": snapshot.name,
      "@tempo": snapshot.tempo ?? 140,
      "@valid": true,
      "@custom_name": true,
      "@ledcolor": snapshot.ledcolor ?? index + 1,
      "@pedalstate": 0,
      blocks: { dsp0: blockStates },
    };
    if (snapshot.rawCommands && typeof snapshot.rawCommands === "object") {
      snap.commands = JSON.parse(JSON.stringify(snapshot.rawCommands));
    }
    if (snapshot.rawControllers && typeof snapshot.rawControllers === "object") {
      snap.controllers = JSON.parse(JSON.stringify(snapshot.rawControllers));
    }
    preset.data.tone[`snapshot${index}`] = snap;
  });

  // ---- Footswitches ----
  // Preserve any original commandFSn payloads that still match the user's
  // current assignment for that footswitch, so untouched imports round-trip
  // verbatim. Otherwise rebuild.
  const originalFs: Record<string, any> = {};
  for (let i = 1; i <= NUM_FOOTSWITCHES; i++) {
    const key = `commandFS${i}`;
    if (preset.data.tone[key]) originalFs[key] = preset.data.tone[key];
    delete preset.data.tone[key];
  }
  data.footswitches.forEach((fs, idx) => {
    const fsKey = `commandFS${idx + 1}`;
    const original = originalFs[fsKey];
    if (original && footswitchMatchesOriginal(fs, original)) {
      preset.data.tone[fsKey] = original;
      return;
    }
    const cmd = buildFootswitchCommand(fs, idx, data);
    if (cmd) preset.data.tone[fsKey] = cmd;
  });

  return preset;
};

/** True if the user-facing footswitch state matches what we'd derive from
 * the given raw commandFSn payload. Used to decide whether to preserve the
 * original payload verbatim on export. */
function footswitchMatchesOriginal(fs: Footswitch, original: any): boolean {
  if (!original || typeof original !== "object") return false;

  const cmd = original["@command"];
  const press = original["@press"];

  if (fs.assignment === "snapshot") {
    if (cmd !== COMMAND_HX_SNAPSHOT) return false;
    if (typeof press !== "number") return false;
    if (String(press - 3) !== fs.value) return false;
    return true;
  }
  if (fs.assignment === "effect") {
    if (cmd !== COMMAND_BLOCK_BYPASS) return false;
    if (typeof press !== "number") return false;
    if (String(press) !== fs.value) return false;
    return true;
  }
  // off
  return cmd !== COMMAND_HX_SNAPSHOT && cmd !== COMMAND_BLOCK_BYPASS;
}

function buildFootswitchCommand(
  fs: Footswitch,
  _idx: number,
  data: PresetData,
): any | null {
  const base = {
    "@fs_primary": true,
    "@relhold": 0,
    "@behavior": 0,
    "@fs_enabled": true,
    "@fs_ledcolor": DEFAULT_FS_LEDCOLOR,
    "@fs_momentary": true,
  };

  if (fs.assignment === "snapshot" && fs.value !== "") {
    const snapIdx = Number(fs.value);
    const snapName = data.snapshots[snapIdx]?.name || `Snapshot ${snapIdx + 1}`;
    return {
      ...base,
      "@command": COMMAND_HX_SNAPSHOT,
      "@press": snapIdx + 3,
      "@fs_label": snapName.slice(0, 16),
    };
  }
  if (fs.assignment === "effect" && fs.value !== "") {
    const blockIdx = Number(fs.value);
    const block = data.effectBlocks[blockIdx];
    const effName =
      effectsMapping.find((e) => e.internal === block?.effect)?.friendly ||
      `Block ${blockIdx + 1}`;
    return {
      ...base,
      "@command": COMMAND_BLOCK_BYPASS,
      "@press": blockIdx,
      "@fs_label": effName.slice(0, 16),
    };
  }
  return null;
}

export const exportPresetAsFile = (data: PresetData) => {
  const hlxData = generateHlxPreset(data);
  const jsonString = JSON.stringify(hlxData, null, 2);
  const blob = new Blob([jsonString], { type: "application/hlx" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${data.name.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "preset"}.hlx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/** Pull editor-modeled fields out of a `.hlx` JSON document. */
export function deriveStateFromHlx(preset: any): {
  name: string;
  effectBlocks: EffectBlock[];
  snapshots: Snapshot[];
  footswitches: Footswitch[];
  globalMidi: GlobalMidiSettings;
} {
  const tone = preset?.data?.tone ?? {};
  const meta = preset?.data?.meta ?? {};

  const name = meta.name || "Imported Preset";

  const effectBlocks = emptyBlocks();
  const dsp0 = tone.dsp0 ?? {};
  for (let i = 0; i < NUM_BLOCKS; i++) {
    const blockKey = `block${i}`;
    const raw = dsp0[blockKey];
    if (!raw || typeof raw !== "object") continue;
    const params: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!k.startsWith("@")) params[k] = v;
    }
    effectBlocks[i] = {
      enabled: raw["@enabled"] ?? false,
      effect: raw["@model"] || "",
      position: i,
      params,
    };
  }

  const snapshots = emptySnapshots();
  for (let i = 0; i < NUM_SNAPSHOTS; i++) {
    const raw = tone[`snapshot${i}`];
    if (!raw || typeof raw !== "object") continue;

    const blockBypass = Array.from({ length: NUM_BLOCKS }, (_, b) => {
      const v = raw?.blocks?.dsp0?.[`block${b}`];
      if (typeof v === "boolean") return v;
      return effectBlocks[b]?.enabled ?? false;
    });

    snapshots[i] = {
      name: raw["@name"] || "",
      active: !!(raw["@name"] && raw["@name"].trim()),
      ledcolor: typeof raw["@ledcolor"] === "number" ? raw["@ledcolor"] : i + 1,
      tempo: typeof raw["@tempo"] === "number" ? raw["@tempo"] : 140,
      blockBypass,
      rawCommands: raw.commands,
      rawControllers: raw.controllers,
    };
  }

  const footswitches = emptyFootswitches();
  for (let i = 0; i < NUM_FOOTSWITCHES; i++) {
    const raw = tone[`commandFS${i + 1}`];
    if (!raw || typeof raw !== "object") continue;

    const cmd = raw["@command"];
    if (cmd === COMMAND_HX_SNAPSHOT) {
      const press = typeof raw["@press"] === "number" ? raw["@press"] : 3;
      const snapIdx = Math.max(0, Math.min(NUM_SNAPSHOTS - 1, press - 3));
      footswitches[i] = { assignment: "snapshot", value: String(snapIdx) };
    } else if (cmd === COMMAND_BLOCK_BYPASS) {
      const press = typeof raw["@press"] === "number" ? raw["@press"] : 0;
      footswitches[i] = { assignment: "effect", value: String(press) };
    }
  }

  const tempo =
    typeof tone?.global?.["@tempo"] === "number"
      ? tone.global["@tempo"]
      : 140;
  const globalMidi: GlobalMidiSettings = { tempo };

  return { name, effectBlocks, snapshots, footswitches, globalMidi };
}

export const parseHlxFile = async (
  file: File,
): Promise<{ state: ReturnType<typeof deriveStateFromHlx>; raw: any }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const preset = JSON.parse(e.target?.result as string);
        resolve({ state: deriveStateFromHlx(preset), raw: preset });
      } catch (error) {
        reject(new Error("Failed to parse HLX file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

// ---------- Round-trip diff (for the dev validation panel) ----------

export interface DiffEntry {
  path: string;
  expected: any;
  actual: any;
}

const IGNORE_KEYS = new Set(["modifieddate"]);

function isObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function diffJson(
  expected: any,
  actual: any,
  path: string,
  out: DiffEntry[],
): void {
  if (out.length >= 50) return;

  if (typeof expected === "number" && typeof actual === "number") {
    if (Math.abs(expected - actual) > 1e-6) {
      out.push({ path, expected, actual });
    }
    return;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      out.push({
        path,
        expected: `array(len=${expected.length})`,
        actual: `array(len=${actual.length})`,
      });
      return;
    }
    for (let i = 0; i < expected.length; i++) {
      diffJson(expected[i], actual[i], `${path}[${i}]`, out);
    }
    return;
  }

  if (isObject(expected) && isObject(actual)) {
    const keys = Array.from(
      new Set<string>([...Object.keys(expected), ...Object.keys(actual)]),
    );
    for (const k of keys) {
      if (IGNORE_KEYS.has(k)) continue;
      const sub = path ? `${path}.${k}` : k;
      if (!(k in expected)) {
        out.push({ path: sub, expected: "(missing)", actual: actual[k] });
        continue;
      }
      if (!(k in actual)) {
        out.push({ path: sub, expected: expected[k], actual: "(missing)" });
        continue;
      }
      diffJson(expected[k], actual[k], sub, out);
    }
    return;
  }

  if (expected !== actual) {
    out.push({ path, expected, actual });
  }
}

export function roundTripDiff(original: any, regenerated: any): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  diffJson(original, regenerated, "", diffs);
  return diffs;
}
