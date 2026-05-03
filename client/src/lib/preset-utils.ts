import {
  EffectBlock,
  Snapshot,
  Footswitch,
  GlobalMidiSettings,
  InstantCommand,
} from "@shared/schema";
import { baseHlxTemplate } from "./hlx-template";
import { effectsMapping } from "./effects-mapping";
import { DEFAULT_GLOBAL_MIDI, isReservedCc } from "./midi-constants";

/** Key under `data.tone.global` where we persist the Global MIDI panel
 * settings. HX firmware stores these as device globals, not in preset
 * files, so we write them under our own namespace where they survive
 * round-trip and document intent. The well-known `@tempo` field is also
 * written to `data.tone.global` for HX compatibility. */
const GLOBAL_MIDI_KEY = "@_hxgen_global_midi";

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
const COMMAND_MIDI_PC = 1;
const COMMAND_MIDI_CC = 2;

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
  return { ...DEFAULT_GLOBAL_MIDI };
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

  // Global / MIDI settings. `@tempo` is a known HX field; the rest are
  // device globals that HX firmware does not read from a preset file, so we
  // also persist the full panel under our own namespaced key for round-trip
  // and as documentation embedded in the preset itself.
  preset.data.tone.global["@tempo"] = data.globalMidi.tempo;
  preset.data.tone.global[GLOBAL_MIDI_KEY] = {
    baseChannel: data.globalMidi.baseChannel,
    midiThru: data.globalMidi.midiThru,
    usbMidi: data.globalMidi.usbMidi,
    pcRx: data.globalMidi.pcRx,
    pcTx: data.globalMidi.pcTx,
    snapshotCcSend: data.globalMidi.snapshotCcSend,
    txClock: data.globalMidi.txClock,
    rxClock: data.globalMidi.rxClock,
    tempo: data.globalMidi.tempo,
  };

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

    // Per-snapshot footswitch command stubs (mirror top-level press values).
    const snapCommands =
      snapshot.rawCommands && typeof snapshot.rawCommands === "object"
        ? JSON.parse(JSON.stringify(snapshot.rawCommands))
        : buildSnapshotCommandStubs(data.footswitches);

    preset.data.tone[`snapshot${index}`] = {
      "@name": snapshot.name,
      "@tempo": snapshot.tempo ?? 140,
      "@valid": true,
      "@custom_name": true,
      "@ledcolor": snapshot.ledcolor ?? index + 1,
      "@pedalstate": 0,
      blocks: { dsp0: blockStates },
      commands: snapCommands,
      controllers: snapshot.rawControllers ?? {},
    };
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
  } else if (fs.assignment === "effect") {
    if (cmd !== COMMAND_BLOCK_BYPASS) return false;
    if (typeof press !== "number") return false;
    if (String(press) !== fs.value) return false;
  } else if (fs.assignment === "midi-pc") {
    if (cmd !== COMMAND_MIDI_PC) return false;
    if (
      !(
        original["@_hxgen_program"] === (fs.midi?.program ?? 0) &&
        original["@_hxgen_channel"] === (fs.midi?.channel ?? "base")
      )
    ) {
      return false;
    }
  } else if (fs.assignment === "midi-cc") {
    if (cmd !== COMMAND_MIDI_CC) return false;
    if (
      !(
        original["@_hxgen_cc"] === (fs.midi?.cc ?? 0) &&
        original["@_hxgen_cc_value"] === (fs.midi?.ccValue ?? 0) &&
        original["@_hxgen_channel"] === (fs.midi?.channel ?? "base")
      )
    ) {
      return false;
    }
  } else if (fs.assignment === "off") {
    if (
      cmd === COMMAND_HX_SNAPSHOT ||
      cmd === COMMAND_BLOCK_BYPASS ||
      cmd === COMMAND_MIDI_PC ||
      cmd === COMMAND_MIDI_CC
    ) {
      return false;
    }
  }
  // Also require instant-command lists to match.
  return instantCommandsEqual(
    fs.instantCommands ?? [],
    Array.isArray(original["@_hxgen_instant_commands"])
      ? original["@_hxgen_instant_commands"]
      : [],
  );
}

function instantCommandsEqual(
  a: InstantCommand[],
  b: any[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!y || typeof y !== "object") return false;
    if (x.type !== y.type) return false;
    if (x.channel !== y.channel) return false;
    if ((x.program ?? 0) !== (y.program ?? 0)) return false;
    if ((x.cc ?? 0) !== (y.cc ?? 0)) return false;
    if ((x.ccValue ?? 0) !== (y.ccValue ?? 0)) return false;
  }
  return true;
}

function buildInstantCommandsPayload(
  fs: Footswitch,
): InstantCommand[] | undefined {
  if (!fs.instantCommands || fs.instantCommands.length === 0) return undefined;
  // Filter out any reserved-CC instant commands defensively.
  const safe = fs.instantCommands.filter(
    (c) => !(c.type === "cc" && c.cc !== undefined && isReservedCc(c.cc)),
  );
  return safe.length > 0 ? safe : undefined;
}

function buildSnapshotCommandStubs(
  footswitches: Footswitch[],
): Record<string, any> {
  const out: Record<string, any> = {};
  footswitches.forEach((fs, idx) => {
    if (fs.assignment === "off") return;
    out[`commandFS${idx + 1}`] = {
      "@relhold": 0,
      "@press": idx + 3,
      "@fs_enabled": false,
      "@behavior": 0,
    };
  });
  return out;
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

  let payload: Record<string, any> | null = null;

  if (fs.assignment === "snapshot" && fs.value !== "") {
    const snapIdx = Number(fs.value);
    const snapName = data.snapshots[snapIdx]?.name || `Snapshot ${snapIdx + 1}`;
    payload = {
      ...base,
      "@command": COMMAND_HX_SNAPSHOT,
      "@press": snapIdx + 3,
      "@fs_label": snapName.slice(0, 16),
      "@_hxgen_kind": "snapshot",
      "@_hxgen_index": snapIdx,
    };
  } else if (fs.assignment === "effect" && fs.value !== "") {
    const blockIdx = Number(fs.value);
    const block = data.effectBlocks[blockIdx];
    const effName =
      effectsMapping.find((e) => e.internal === block?.effect)?.friendly ||
      `Block ${blockIdx + 1}`;
    payload = {
      ...base,
      "@command": COMMAND_BLOCK_BYPASS,
      "@press": blockIdx,
      "@fs_label": effName.slice(0, 16),
      "@_hxgen_kind": "effect",
      "@_hxgen_index": blockIdx,
    };
  } else if (fs.assignment === "midi-pc") {
    const program = fs.midi?.program ?? 0;
    const channel = fs.midi?.channel ?? "base";
    payload = {
      ...base,
      "@command": COMMAND_MIDI_PC,
      "@press": program,
      "@midi_channel": channel,
      "@fs_label": `PC ${program}`,
      "@_hxgen_kind": "midi-pc",
      "@_hxgen_program": program,
      "@_hxgen_channel": channel,
    };
  } else if (fs.assignment === "midi-cc") {
    const cc = fs.midi?.cc ?? 0;
    const ccValue = fs.midi?.ccValue ?? 0;
    const channel = fs.midi?.channel ?? "base";
    if (isReservedCc(cc)) {
      payload = null; // Defensive: refuse to export reserved CCs.
    } else {
      payload = {
        ...base,
        "@command": COMMAND_MIDI_CC,
        "@press": ccValue,
        "@midi_channel": channel,
        "@midi_cc": cc,
        "@fs_label": `CC ${cc}`,
        "@_hxgen_kind": "midi-cc",
        "@_hxgen_cc": cc,
        "@_hxgen_cc_value": ccValue,
        "@_hxgen_channel": channel,
      };
    }
  }

  // Attach optional Instant Commands list (Command Center extras) to the
  // payload, or — if there's no primary action but there are instant
  // commands — emit a "container" payload that just carries the list.
  const instants = buildInstantCommandsPayload(fs);
  if (payload && instants) {
    payload["@_hxgen_instant_commands"] = instants;
  } else if (!payload && instants) {
    payload = {
      ...base,
      "@_hxgen_kind": "instant-only",
      "@_hxgen_instant_commands": instants,
    };
  }

  return payload;
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
      // Keep only model-specific (non-`@`) parameters in `params`.
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
      // Fall back to the master enabled state for the block.
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

    // Recover any saved Instant Commands list.
    const rawInstants = raw["@_hxgen_instant_commands"];
    const instantCommands: InstantCommand[] | undefined = Array.isArray(
      rawInstants,
    )
      ? (rawInstants
          .map((c: any) => {
            if (!c || typeof c !== "object") return null;
            if (c.type !== "pc" && c.type !== "cc") return null;
            return {
              type: c.type,
              channel: c.channel ?? "base",
              program: c.program,
              cc: c.cc,
              ccValue: c.ccValue,
            } as InstantCommand;
          })
          .filter((c): c is InstantCommand => c !== null))
      : undefined;
    const withInstants = (
      fs: Omit<Footswitch, "instantCommands">,
    ): Footswitch =>
      instantCommands && instantCommands.length > 0
        ? { ...fs, instantCommands }
        : fs;

    // Prefer our hidden round-trip hints if present.
    const kind = raw["@_hxgen_kind"];
    if (kind === "snapshot") {
      footswitches[i] = withInstants({
        assignment: "snapshot",
        value: String(raw["@_hxgen_index"] ?? ""),
      });
      continue;
    }
    if (kind === "effect") {
      footswitches[i] = withInstants({
        assignment: "effect",
        value: String(raw["@_hxgen_index"] ?? ""),
      });
      continue;
    }
    if (kind === "midi-pc") {
      footswitches[i] = withInstants({
        assignment: "midi-pc",
        value: "",
        midi: {
          channel: raw["@_hxgen_channel"] ?? "base",
          program: raw["@_hxgen_program"] ?? 0,
        },
      });
      continue;
    }
    if (kind === "midi-cc") {
      footswitches[i] = withInstants({
        assignment: "midi-cc",
        value: "",
        midi: {
          channel: raw["@_hxgen_channel"] ?? "base",
          cc: raw["@_hxgen_cc"] ?? 0,
          ccValue: raw["@_hxgen_cc_value"] ?? 0,
        },
      });
      continue;
    }
    if (kind === "instant-only") {
      footswitches[i] = withInstants({ assignment: "off", value: "" });
      continue;
    }

    // No hint — best-effort guess based on @command.
    const cmd = raw["@command"];
    if (cmd === COMMAND_HX_SNAPSHOT) {
      const press = typeof raw["@press"] === "number" ? raw["@press"] : 3;
      const snapIdx = Math.max(0, Math.min(NUM_SNAPSHOTS - 1, press - 3));
      footswitches[i] = withInstants({
        assignment: "snapshot",
        value: String(snapIdx),
      });
    } else if (cmd === COMMAND_BLOCK_BYPASS) {
      const press = typeof raw["@press"] === "number" ? raw["@press"] : 0;
      footswitches[i] = withInstants({
        assignment: "effect",
        value: String(press),
      });
    } else if (cmd === COMMAND_MIDI_PC) {
      footswitches[i] = withInstants({
        assignment: "midi-pc",
        value: "",
        midi: {
          channel: raw["@midi_channel"] ?? "base",
          program: typeof raw["@press"] === "number" ? raw["@press"] : 0,
        },
      });
    } else if (cmd === COMMAND_MIDI_CC) {
      footswitches[i] = withInstants({
        assignment: "midi-cc",
        value: "",
        midi: {
          channel: raw["@midi_channel"] ?? "base",
          cc: typeof raw["@midi_cc"] === "number" ? raw["@midi_cc"] : 0,
          ccValue: typeof raw["@press"] === "number" ? raw["@press"] : 0,
        },
      });
    } else if (instantCommands && instantCommands.length > 0) {
      footswitches[i] = withInstants({ assignment: "off", value: "" });
    }
  }

  // Global MIDI: prefer our persisted bag, then `@tempo`, then defaults.
  const persistedGlobal = tone?.global?.[GLOBAL_MIDI_KEY];
  const globalMidi: GlobalMidiSettings = {
    ...DEFAULT_GLOBAL_MIDI,
    ...(persistedGlobal && typeof persistedGlobal === "object"
      ? persistedGlobal
      : {}),
    tempo:
      (persistedGlobal && typeof persistedGlobal.tempo === "number"
        ? persistedGlobal.tempo
        : undefined) ??
      (typeof tone?.global?.["@tempo"] === "number"
        ? tone.global["@tempo"]
        : DEFAULT_GLOBAL_MIDI.tempo),
  };

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

const IGNORE_KEYS = new Set([
  "modifieddate",
  // Hidden round-trip hints / namespaced keys we add on export but
  // the source file won't have.
  "@_hxgen_kind",
  "@_hxgen_index",
  "@_hxgen_local",
  "@_hxgen_program",
  "@_hxgen_cc",
  "@_hxgen_cc_value",
  "@_hxgen_channel",
  "@_hxgen_instant_commands",
  GLOBAL_MIDI_KEY,
]);

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
    // Tolerate float drift from JSON.parse round-trip.
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
