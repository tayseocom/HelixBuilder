import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Undo2,
  Redo2,
  FilePlus2,
} from "lucide-react";
import {
  EffectBlock,
  Snapshot,
  Footswitch,
  GlobalMidiSettings,
} from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useHistoryState } from "@/hooks/use-history-state";
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

const STORAGE_KEY = "hx-preset-generator-v3";

interface EditorState {
  presetName: string;
  effectBlocks: EffectBlock[];
  snapshots: Snapshot[];
  footswitches: Footswitch[];
  globalMidi: GlobalMidiSettings;
}

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

function defaultEditorState(): EditorState {
  return {
    presetName: "New Preset",
    effectBlocks: defaultBlocks(),
    snapshots: defaultSnapshots(),
    footswitches: defaultFootswitches(),
    globalMidi: emptyGlobalMidi(),
  };
}

export default function PresetGenerator() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const history = useHistoryState<EditorState>(defaultEditorState());
  const { state: editor, set: setEditor, reset: resetEditor, undo, redo, canUndo, canRedo } = history;

  const [rawHlx, setRawHlx] = useState<any | null>(null);
  const [diffEntries, setDiffEntries] = useState<DiffEntry[] | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetIncludesRaw, setResetIncludesRaw] = useState(false);
  const hydratedRef = useRef(false);

  // Load from localStorage on mount.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    hydratedRef.current = true;
    if (!saved) return;
    try {
      const state = JSON.parse(saved);
      const next: EditorState = {
        presetName: state.presetName ?? "New Preset",
        effectBlocks: Array.isArray(state.effectBlocks)
          ? mergeBlocks(state.effectBlocks)
          : defaultBlocks(),
        snapshots: Array.isArray(state.snapshots)
          ? mergeSnapshots(state.snapshots)
          : defaultSnapshots(),
        footswitches: Array.isArray(state.footswitches)
          ? mergeFootswitches(state.footswitches)
          : defaultFootswitches(),
        globalMidi: state.globalMidi
          ? { ...emptyGlobalMidi(), ...state.globalMidi }
          : emptyGlobalMidi(),
      };
      resetEditor(next);
      if (state.rawHlx) setRawHlx(state.rawHlx);
    } catch (e) {
      console.error("Failed to load saved state:", e);
    }
  }, [resetEditor]);

  // Persist on change (skip until hydration completes to avoid clobbering).
  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        presetName: editor.presetName,
        effectBlocks: editor.effectBlocks,
        snapshots: editor.snapshots,
        footswitches: editor.footswitches,
        globalMidi: editor.globalMidi,
        rawHlx,
      }),
    );
  }, [editor, rawHlx]);

  const handleEffectBlockChange = (index: number, block: EffectBlock) => {
    setEditor((prev) => {
      const next = [...prev.effectBlocks];
      next[index] = block;
      return { ...prev, effectBlocks: next };
    });
  };

  const handleSnapshotChange = (index: number, snapshot: Snapshot) => {
    const prev = editor.snapshots[index];
    // A "typing" change is one where only the free-text or numeric-input
    // fields differ (snapshot name or tempo); toggles, color picks, and
    // bypass clicks should produce a discrete history entry.
    const onlyTextual =
      prev !== undefined &&
      prev.active === snapshot.active &&
      prev.ledcolor === snapshot.ledcolor &&
      arraysEqual(prev.blockBypass, snapshot.blockBypass) &&
      (prev.name !== snapshot.name || prev.tempo !== snapshot.tempo);
    setEditor(
      (p) => {
        const next = [...p.snapshots];
        next[index] = snapshot;
        return { ...p, snapshots: next };
      },
      { debounce: onlyTextual },
    );
  };

  const handleFootswitchChange = (index: number, footswitch: Footswitch) => {
    setEditor((prev) => {
      const next = [...prev.footswitches];
      next[index] = footswitch;
      return { ...prev, footswitches: next };
    });
  };

  const handlePresetNameChange = (name: string) => {
    setEditor((prev) => ({ ...prev, presetName: name }), { debounce: true });
  };

  const handleGlobalMidiChange = (next: GlobalMidiSettings) => {
    // GlobalMidiSettings currently only contains `tempo`, which is driven
    // by a number input — debounce so a typing burst is one undo step.
    setEditor((prev) => ({ ...prev, globalMidi: next }), { debounce: true });
  };

  const handleExport = () => {
    try {
      exportPresetAsFile({
        name: editor.presetName,
        effectBlocks: editor.effectBlocks,
        snapshots: editor.snapshots,
        footswitches: editor.footswitches,
        globalMidi: editor.globalMidi,
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
      setEditor({
        presetName: state.name,
        effectBlocks: state.effectBlocks,
        snapshots: state.snapshots,
        footswitches: state.footswitches,
        globalMidi: state.globalMidi,
      });
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
      name: editor.presetName,
      effectBlocks: editor.effectBlocks,
      snapshots: editor.snapshots,
      footswitches: editor.footswitches,
      globalMidi: editor.globalMidi,
      rawHlx,
    });
    setDiffEntries(roundTripDiff(rawHlx, regenerated));
  };

  const confirmReset = useCallback(() => {
    resetEditor(defaultEditorState());
    if (resetIncludesRaw) {
      setRawHlx(null);
      setDiffEntries(null);
    }
    setResetOpen(false);
    setResetIncludesRaw(false);
    toast({ title: "Reset", description: "Editor state cleared." });
  }, [resetEditor, resetIncludesRaw, toast]);

  // Keyboard shortcuts: ⌘Z / Ctrl+Z (undo), ⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y (redo).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      // Bail out if a modal/dialog is open — let the dialog own keyboard focus.
      if (typeof document !== "undefined") {
        if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
          return;
        }
        // Let native undo/redo work inside text inputs and contenteditable surfaces.
        const target = e.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
            return;
          }
        }
      }
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const activeBlockCount = useMemo(
    () => editor.effectBlocks.filter((b) => b.enabled && b.effect).length,
    [editor.effectBlocks],
  );

  return (
    <div className="min-h-screen bg-studio-900 text-studio-200">
      <header className="bg-studio-800 border-b border-studio-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-4">
            <Guitar className="text-blue-500 text-2xl" />
            <h1 className="text-xl font-semibold text-white">
              HX Effects Preset Generator
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={undo}
              disabled={!canUndo}
              variant="outline"
              size="icon"
              title="Undo (⌘Z)"
              aria-label="Undo"
              className="bg-studio-700 hover:bg-studio-600 border-studio-600 text-white disabled:opacity-40"
              data-testid="button-undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={redo}
              disabled={!canRedo}
              variant="outline"
              size="icon"
              title="Redo (⌘⇧Z)"
              aria-label="Redo"
              className="bg-studio-700 hover:bg-studio-600 border-studio-600 text-white disabled:opacity-40"
              data-testid="button-redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setResetOpen(true)}
              variant="outline"
              className="bg-studio-700 hover:bg-studio-600 border-studio-600 text-white"
              data-testid="button-reset"
            >
              <FilePlus2 className="w-4 h-4 mr-2" />
              New preset
            </Button>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section>
          <div className="bg-studio-800 rounded-xl p-6 border border-studio-700">
            <label className="block text-sm font-medium text-studio-300 mb-2">
              Preset Name
            </label>
            <Input
              value={editor.presetName}
              onChange={(e) => handlePresetNameChange(e.target.value)}
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
          <GlobalMidiPanel value={editor.globalMidi} onChange={handleGlobalMidiChange} />
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
            {editor.effectBlocks.map((block, index) => (
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
            {editor.snapshots.map((snapshot, index) => (
              <SnapshotSlot
                key={index}
                snapshot={snapshot}
                index={index}
                effectBlocks={editor.effectBlocks}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
            {editor.footswitches.map((footswitch, index) => (
              <FootswitchComponent
                key={index}
                footswitch={footswitch}
                index={index}
                effectBlocks={editor.effectBlocks}
                snapshots={editor.snapshots}
                onChange={(nf) => handleFootswitchChange(index, nf)}
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

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent
          className="bg-studio-800 border-studio-700 text-studio-100"
          data-testid="dialog-reset"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Start a new preset?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-studio-300">
              This clears the preset name, blocks, snapshots, footswitches, and
              global MIDI settings. Undo history will also be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-2 text-sm text-studio-200 cursor-pointer">
            <Checkbox
              checked={resetIncludesRaw}
              onCheckedChange={(v) => setResetIncludesRaw(v === true)}
              disabled={!rawHlx}
              data-testid="checkbox-reset-raw"
              className="mt-0.5"
            />
            <span>
              Also drop the imported .hlx reference
              {!rawHlx && (
                <span className="block text-xs text-studio-500">
                  (no file currently imported)
                </span>
              )}
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-studio-700 border-studio-600 text-white hover:bg-studio-600"
              data-testid="button-reset-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReset}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-reset-confirm"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const validAssignments = new Set(["off", "snapshot", "effect"]);
  saved.slice(0, 6).forEach((f, i) => {
    const assignment: Footswitch["assignment"] = validAssignments.has(
      f?.assignment,
    )
      ? f.assignment
      : "off";
    base[i] = { assignment, value: f?.value ?? "" };
  });
  return base;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function padArray<T>(arr: T[], len: number, fill: T): T[] {
  const out = arr.slice(0, len);
  while (out.length < len) out.push(fill);
  return out;
}
