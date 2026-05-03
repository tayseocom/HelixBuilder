import { useState, useEffect, useRef, useMemo } from "react";
import {
  Guitar,
  Upload,
  Download,
  Camera,
  Layers,
  Grid3X3,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  EffectBlock,
  Snapshot,
  Footswitch,
  GlobalMidiSettings,
} from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import EffectBlockComponent from "@/components/effect-block";
import SnapshotSlot from "@/components/snapshot-slot";
import FootswitchComponent from "@/components/footswitch";
import GlobalMidiPanel from "@/components/global-midi-panel";
import {
  exportPresetAsFile,
  parseHlxFile,
  generateHlxPreset,
  deriveStateFromHlx,
  roundTripDiff,
  emptyGlobalMidi,
  DiffEntry,
} from "@/lib/preset-utils";

const STORAGE_KEY = "hx-preset-generator-v2";

function defaultBlocks(): EffectBlock[] {
  return Array.from({ length: 9 }, (_, i) => ({
    enabled: false,
    effect: "",
    position: i,
  }));
}

function defaultSnapshots(): Snapshot[] {
  return Array.from({ length: 4 }, (_, i) => ({
    name: "",
    active: false,
    ledcolor: i + 1,
    tempo: 140,
    blockBypass: Array.from({ length: 9 }, () => false),
  }));
}

function defaultFootswitches(): Footswitch[] {
  return Array.from({ length: 6 }, () => ({
    assignment: "off" as const,
    value: "",
  }));
}

export default function PresetGenerator() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [presetName, setPresetName] = useState("New Preset");
  const [effectBlocks, setEffectBlocks] = useState<EffectBlock[]>(defaultBlocks());
  const [snapshots, setSnapshots] = useState<Snapshot[]>(defaultSnapshots());
  const [footswitches, setFootswitches] = useState<Footswitch[]>(
    defaultFootswitches(),
  );
  const [globalMidi, setGlobalMidi] = useState<GlobalMidiSettings>(
    emptyGlobalMidi(),
  );
  // The last imported HLX file (raw JSON). Used to preserve unknown fields
  // (block parameters, controllers, dsp1, etc.) on export.
  const [rawHlx, setRawHlx] = useState<any | null>(null);
  const [diffEntries, setDiffEntries] = useState<DiffEntry[] | null>(null);

  // Load from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const state = JSON.parse(saved);
      if (state.presetName) setPresetName(state.presetName);
      if (Array.isArray(state.effectBlocks))
        setEffectBlocks(mergeBlocks(state.effectBlocks));
      if (Array.isArray(state.snapshots))
        setSnapshots(mergeSnapshots(state.snapshots));
      if (Array.isArray(state.footswitches))
        setFootswitches(mergeFootswitches(state.footswitches));
      if (state.globalMidi)
        setGlobalMidi({ ...emptyGlobalMidi(), ...state.globalMidi });
      if (state.rawHlx) setRawHlx(state.rawHlx);
    } catch (e) {
      console.error("Failed to load saved state:", e);
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        presetName,
        effectBlocks,
        snapshots,
        footswitches,
        globalMidi,
        rawHlx,
      }),
    );
  }, [presetName, effectBlocks, snapshots, footswitches, globalMidi, rawHlx]);

  const handleEffectBlockChange = (index: number, block: EffectBlock) => {
    setEffectBlocks((prev) => {
      const next = [...prev];
      next[index] = block;
      return next;
    });
  };

  const handleSnapshotChange = (index: number, snapshot: Snapshot) => {
    setSnapshots((prev) => {
      const next = [...prev];
      next[index] = snapshot;
      return next;
    });
  };

  const handleFootswitchChange = (index: number, footswitch: Footswitch) => {
    setFootswitches((prev) => {
      const next = [...prev];
      next[index] = footswitch;
      return next;
    });
  };

  const handleExport = () => {
    try {
      exportPresetAsFile({
        name: presetName,
        effectBlocks,
        snapshots,
        footswitches,
        globalMidi,
        rawHlx: rawHlx ?? undefined,
      });
      toast({ title: "Exported", description: "Preset saved to your downloads." });
    } catch (err) {
      console.error(err);
      toast({
        title: "Export failed",
        description: "Couldn't generate the .hlx file.",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => fileInputRef.current?.click();

  const handleFileImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { state, raw } = await parseHlxFile(file);
      setPresetName(state.name);
      setEffectBlocks(state.effectBlocks);
      setSnapshots(state.snapshots);
      setFootswitches(state.footswitches);
      setGlobalMidi(state.globalMidi);
      setRawHlx(raw);
      setDiffEntries(null);
      toast({
        title: "Imported",
        description: `Loaded "${state.name}" from .hlx.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Import failed",
        description: "That file isn't a recognizable .hlx preset.",
        variant: "destructive",
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleValidateRoundTrip = () => {
    if (!rawHlx) {
      toast({
        title: "Nothing to validate",
        description: "Import an .hlx file first.",
      });
      return;
    }
    const regenerated = generateHlxPreset({
      name: presetName,
      effectBlocks,
      snapshots,
      footswitches,
      globalMidi,
      rawHlx,
    });
    setDiffEntries(roundTripDiff(rawHlx, regenerated));
  };

  const activeBlockCount = useMemo(
    () => effectBlocks.filter((b) => b.enabled && b.effect).length,
    [effectBlocks],
  );

  return (
    <div className="min-h-screen bg-studio-900 text-studio-200">
      <header className="bg-studio-800 border-b border-studio-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Guitar className="text-blue-500 text-2xl" />
            <h1 className="text-xl font-semibold text-white">
              HX Effects Preset Generator
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleImport}
              variant="outline"
              className="bg-studio-700 hover:bg-studio-600 border-studio-600 text-white"
              data-testid="button-import"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import .hlx
            </Button>
            <Button
              onClick={handleExport}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-export"
            >
              <Download className="w-4 h-4 mr-2" />
              Export .hlx
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".hlx,application/json"
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <div className="bg-studio-800 rounded-xl p-6 border border-studio-700">
            <label className="block text-sm font-medium text-studio-300 mb-2">
              Preset Name
            </label>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter preset name..."
              className="bg-studio-700 border-studio-600 text-white placeholder-studio-400 focus:border-blue-500"
              data-testid="input-preset-name"
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Sliders className="text-purple-400 mr-3" />
            Global / MIDI Settings
          </h2>
          <GlobalMidiPanel value={globalMidi} onChange={setGlobalMidi} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
            <span className="flex items-center">
              <Layers className="text-green-500 mr-3" />
              Effect Blocks
            </span>
            <span className="text-xs text-studio-400 font-normal">
              {activeBlockCount} / 9 active
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {effectBlocks.map((block, index) => (
              <EffectBlockComponent
                key={index}
                block={block}
                index={index}
                onChange={(newBlock) => handleEffectBlockChange(index, newBlock)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Camera className="text-orange-500 mr-3" />
            Snapshots
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {snapshots.map((snapshot, index) => (
              <SnapshotSlot
                key={index}
                snapshot={snapshot}
                index={index}
                effectBlocks={effectBlocks}
                onChange={(newSnapshot) =>
                  handleSnapshotChange(index, newSnapshot)
                }
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Grid3X3 className="text-blue-500 mr-3" />
            Footswitch Assignments
          </h2>

          <div className="grid grid-cols-3 gap-6 mb-6">
            {footswitches.slice(0, 3).map((footswitch, index) => (
              <FootswitchComponent
                key={index}
                footswitch={footswitch}
                index={index}
                effectBlocks={effectBlocks}
                snapshots={snapshots}
                onChange={(nf) => handleFootswitchChange(index, nf)}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {footswitches.slice(3, 6).map((footswitch, index) => (
              <FootswitchComponent
                key={index + 3}
                footswitch={footswitch}
                index={index + 3}
                effectBlocks={effectBlocks}
                snapshots={snapshots}
                onChange={(nf) => handleFootswitchChange(index + 3, nf)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="bg-studio-800 rounded-xl p-6 border border-studio-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">
                Round-trip validation
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={handleValidateRoundTrip}
                className="bg-studio-700 border-studio-600 text-white"
                data-testid="button-validate-round-trip"
              >
                Run check
              </Button>
            </div>
            <p className="text-xs text-studio-400 mb-3">
              Imports the last loaded .hlx file, regenerates it from the editor
              state, and lists any field that drifted. A clean run (zero
              entries) means a save/load cycle is non-destructive.
            </p>
            {!rawHlx && (
              <div className="text-xs text-studio-500 italic">
                Import an .hlx file to enable validation.
              </div>
            )}
            {diffEntries !== null && diffEntries.length === 0 && (
              <div
                className="flex items-center gap-2 text-sm text-green-400"
                data-testid="text-roundtrip-clean"
              >
                <CheckCircle2 className="w-4 h-4" />
                Clean — no drift detected.
              </div>
            )}
            {diffEntries !== null && diffEntries.length > 0 && (
              <div
                className="text-xs space-y-1 max-h-64 overflow-auto bg-studio-900 border border-studio-700 rounded p-2 font-mono"
                data-testid="list-roundtrip-diffs"
              >
                <div className="flex items-center gap-2 text-yellow-400 mb-2 font-sans">
                  <AlertCircle className="w-4 h-4" />
                  {diffEntries.length} field{diffEntries.length === 1 ? "" : "s"} drifted
                </div>
                {diffEntries.slice(0, 30).map((d, i) => (
                  <div key={i} className="text-studio-300">
                    <span className="text-studio-100">{d.path || "(root)"}</span>
                    : <span className="text-red-400">{stringifyShort(d.expected)}</span>
                    {" → "}
                    <span className="text-green-400">{stringifyShort(d.actual)}</span>
                  </div>
                ))}
                {diffEntries.length > 30 && (
                  <div className="text-studio-500">
                    …and {diffEntries.length - 30} more
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function stringifyShort(v: any): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "..." : s;
  }
  return String(v);
}

// ---------- Migrations for legacy localStorage shapes ----------

function mergeBlocks(saved: any[]): EffectBlock[] {
  const base = defaultBlocks();
  saved.slice(0, 9).forEach((b, i) => {
    base[i] = {
      enabled: !!b?.enabled,
      effect: b?.effect ?? "",
      position: typeof b?.position === "number" ? b.position : i,
      params: b?.params,
    };
  });
  return base;
}

function mergeSnapshots(saved: any[]): Snapshot[] {
  const base = defaultSnapshots();
  saved.slice(0, 4).forEach((s, i) => {
    base[i] = {
      name: s?.name ?? "",
      active: !!s?.active,
      ledcolor: typeof s?.ledcolor === "number" ? s.ledcolor : i + 1,
      tempo: typeof s?.tempo === "number" ? s.tempo : 140,
      blockBypass: Array.isArray(s?.blockBypass)
        ? padArray(s.blockBypass, 9, false)
        : Array.from({ length: 9 }, () => false),
      rawCommands: s?.rawCommands,
      rawControllers: s?.rawControllers,
    };
  });
  return base;
}

function mergeFootswitches(saved: any[]): Footswitch[] {
  const base = defaultFootswitches();
  const validAssignments = new Set([
    "off",
    "snapshot",
    "effect",
    "midi-pc",
    "midi-cc",
  ]);
  saved.slice(0, 6).forEach((f, i) => {
    let assignment: Footswitch["assignment"] = validAssignments.has(f?.assignment)
      ? f.assignment
      : "off";
    let midi = f?.midi;
    // Migrate legacy { type: 'none' | 'pc' | 'cc' } shape.
    if (midi && typeof midi === "object" && "type" in midi) {
      if (midi.type === "pc") {
        assignment = "midi-pc";
        midi = { channel: midi.channel ?? "base", program: midi.program ?? 0 };
      } else if (midi.type === "cc") {
        assignment = "midi-cc";
        midi = {
          channel: midi.channel ?? "base",
          cc: midi.cc ?? 0,
          ccValue: midi.ccValue ?? 0,
        };
      } else {
        midi = undefined;
      }
    }
    base[i] = {
      assignment,
      value: f?.value ?? "",
      ...(midi ? { midi } : {}),
    };
  });
  return base;
}

function padArray<T>(arr: T[], len: number, fill: T): T[] {
  const out = arr.slice(0, len);
  while (out.length < len) out.push(fill);
  return out;
}
