import { useMemo } from "react";
import { Footswitch, EffectBlock, Snapshot, MidiParams } from "@shared/schema";
import { effectsMapping } from "@/lib/effects-mapping";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Power, AlertTriangle } from "lucide-react";
import { isReservedCc, reservedCcDescription } from "@/lib/midi-constants";
import { useToast } from "@/hooks/use-toast";

type Assignment = Footswitch["assignment"];

interface FootswitchProps {
  footswitch: Footswitch;
  index: number;
  effectBlocks: EffectBlock[];
  snapshots: Snapshot[];
  onChange: (footswitch: Footswitch) => void;
}

function nextNonReservedCc(start: number, dir: 1 | -1 = 1): number {
  let n = start;
  for (let i = 0; i < 200; i++) {
    if (n < 0) n = 0;
    if (n > 127) n = 127;
    if (!isReservedCc(n)) return n;
    n += dir;
    if (n < 0 || n > 127) {
      n = start;
      dir = (dir === 1 ? -1 : 1) as 1 | -1;
    }
  }
  return 3;
}

export default function FootswitchComponent({
  footswitch,
  index,
  effectBlocks,
  snapshots,
  onChange,
}: FootswitchProps) {
  const { toast } = useToast();

  const activeEffectBlocks = useMemo(
    () =>
      effectBlocks
        .map((block, idx) => ({ block, idx }))
        .filter(({ block }) => block.enabled && block.effect),
    [effectBlocks],
  );
  const activeSnapshots = useMemo(
    () =>
      snapshots
        .map((snapshot, idx) => ({ snapshot, idx }))
        .filter(({ snapshot }) => snapshot.name.trim() !== ""),
    [snapshots],
  );

  const midi: MidiParams = footswitch.midi ?? { channel: "base" };

  const handleAssignmentChange = (assignment: Assignment) => {
    if (assignment === "off" || assignment === "snapshot" || assignment === "effect") {
      onChange({ assignment, value: "" });
      return;
    }
    if (assignment === "midi-pc") {
      onChange({
        assignment,
        value: "",
        midi: {
          channel: midi.channel,
          program: midi.program ?? 0,
        },
      });
      return;
    }
    // midi-cc
    const startCc = midi.cc ?? 3;
    const safeCc = isReservedCc(startCc) ? nextNonReservedCc(startCc) : startCc;
    onChange({
      assignment,
      value: "",
      midi: {
        channel: midi.channel,
        cc: safeCc,
        ccValue: midi.ccValue ?? 127,
      },
    });
  };

  const handleValueChange = (value: string) => {
    onChange({ ...footswitch, value });
  };

  const handleChannelChange = (raw: string) => {
    const ch: number | "base" =
      raw === "base" ? "base" : Math.max(1, Math.min(16, parseInt(raw, 10)));
    onChange({ ...footswitch, midi: { ...midi, channel: ch } });
  };

  const handleNumChange = (
    field: "program" | "cc" | "ccValue",
    raw: string,
  ) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(0, Math.min(127, n));

    if (field === "cc" && isReservedCc(clamped)) {
      toast({
        title: "Reserved MIDI CC",
        description: `CC ${clamped} is reserved on HX Effects (${reservedCcDescription(
          clamped,
        )}). Choose a different CC number.`,
        variant: "destructive",
      });
      return;
    }
    onChange({ ...footswitch, midi: { ...midi, [field]: clamped } });
  };

  const getEffectName = (internalRef: string) => {
    const effect = effectsMapping.find((e) => e.internal === internalRef);
    return effect ? effect.friendly : "Unknown Effect";
  };

  const getPedalColor = () => {
    switch (footswitch.assignment) {
      case "off":
        return "border-studio-600 bg-gradient-to-b from-studio-700 to-studio-800";
      case "snapshot":
        return footswitch.value
          ? "border-green-500 bg-gradient-to-b from-green-700 to-green-800"
          : "border-yellow-500 bg-gradient-to-b from-yellow-700 to-yellow-800";
      case "effect":
        return footswitch.value
          ? "border-orange-500 bg-gradient-to-b from-orange-700 to-orange-800"
          : "border-yellow-500 bg-gradient-to-b from-yellow-700 to-yellow-800";
      case "midi-pc":
      case "midi-cc":
        return "border-purple-500 bg-gradient-to-b from-purple-700 to-purple-800";
    }
  };

  const getStatusText = () => {
    switch (footswitch.assignment) {
      case "off":
        return "Unassigned";
      case "snapshot": {
        if (footswitch.value === "") return "Pick a snapshot";
        const i = parseInt(footswitch.value, 10);
        return `Snap: ${snapshots[i]?.name || `#${i + 1}`}`;
      }
      case "effect": {
        if (footswitch.value === "") return "Pick a block";
        const i = parseInt(footswitch.value, 10);
        const eff = effectBlocks[i];
        return `Effect: ${eff ? getEffectName(eff.effect) : `Block ${i}`}`;
      }
      case "midi-pc":
        return `PC ${midi.program ?? 0} · ch ${midi.channel}`;
      case "midi-cc":
        return `CC ${midi.cc ?? 0}=${midi.ccValue ?? 0} · ch ${midi.channel}`;
    }
  };

  const getStatusColor = () => {
    if (footswitch.assignment === "off") return "text-studio-400";
    if (
      (footswitch.assignment === "snapshot" || footswitch.assignment === "effect") &&
      footswitch.value === ""
    )
      return "text-yellow-400";
    return "text-studio-200";
  };

  const ccReserved =
    footswitch.assignment === "midi-cc" &&
    midi.cc !== undefined &&
    isReservedCc(midi.cc);

  return (
    <div className="bg-studio-800 rounded-xl p-5 border-2 border-studio-700 hover:border-studio-600 transition-colors">
      <div className="text-center mb-4">
        <div
          className={`w-16 h-16 mx-auto rounded-full border-4 shadow-lg flex items-center justify-center transition-colors ${getPedalColor()}`}
        >
          <Power className="w-5 h-5 text-white" />
        </div>
        <div className="text-sm font-medium text-studio-300 mt-2">
          FS {index + 1}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-studio-400 mb-1">
            Action
          </div>
          <Select
            value={footswitch.assignment}
            onValueChange={(v) => handleAssignmentChange(v as Assignment)}
          >
            <SelectTrigger
              className="w-full bg-studio-700 border-studio-600 text-white text-sm focus:border-blue-500 h-8"
              data-testid={`select-fs-${index}-assignment`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-studio-700 border-studio-600">
              <SelectItem value="off" className="text-white hover:bg-studio-600">
                Off
              </SelectItem>
              <SelectItem
                value="snapshot"
                className="text-white hover:bg-studio-600"
              >
                Recall Snapshot
              </SelectItem>
              <SelectItem
                value="effect"
                className="text-white hover:bg-studio-600"
              >
                Toggle Effect
              </SelectItem>
              <SelectItem
                value="midi-pc"
                className="text-white hover:bg-studio-600"
              >
                MIDI Program Change
              </SelectItem>
              <SelectItem
                value="midi-cc"
                className="text-white hover:bg-studio-600"
              >
                MIDI CC
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {footswitch.assignment === "snapshot" && (
          <Select value={footswitch.value} onValueChange={handleValueChange}>
            <SelectTrigger
              className="w-full bg-studio-700 border-studio-600 text-white text-sm h-8"
              data-testid={`select-fs-${index}-snapshot`}
            >
              <SelectValue placeholder="Select snapshot" />
            </SelectTrigger>
            <SelectContent className="bg-studio-700 border-studio-600">
              {activeSnapshots.length === 0 && (
                <div className="px-2 py-1 text-xs text-studio-400">
                  Name a snapshot first
                </div>
              )}
              {activeSnapshots.map(({ snapshot, idx }) => (
                <SelectItem
                  key={idx}
                  value={String(idx)}
                  className="text-white hover:bg-studio-600"
                >
                  {snapshot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {footswitch.assignment === "effect" && (
          <Select value={footswitch.value} onValueChange={handleValueChange}>
            <SelectTrigger
              className="w-full bg-studio-700 border-studio-600 text-white text-sm h-8"
              data-testid={`select-fs-${index}-effect`}
            >
              <SelectValue placeholder="Select effect" />
            </SelectTrigger>
            <SelectContent className="bg-studio-700 border-studio-600">
              {activeEffectBlocks.length === 0 && (
                <div className="px-2 py-1 text-xs text-studio-400">
                  Enable an effect block first
                </div>
              )}
              {activeEffectBlocks.map(({ block, idx }) => (
                <SelectItem
                  key={idx}
                  value={String(idx)}
                  className="text-white hover:bg-studio-600"
                >
                  Block {idx}: {getEffectName(block.effect)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(footswitch.assignment === "midi-pc" ||
          footswitch.assignment === "midi-cc") && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <div className="flex-1">
                <label className="text-[10px] text-studio-400 block">Ch</label>
                <Select
                  value={String(midi.channel)}
                  onValueChange={handleChannelChange}
                >
                  <SelectTrigger
                    className="w-full bg-studio-700 border-studio-600 text-white text-xs h-7"
                    data-testid={`select-fs-${index}-midi-channel`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-studio-700 border-studio-600 max-h-60">
                    <SelectItem
                      value="base"
                      className="text-white hover:bg-studio-600"
                    >
                      Base
                    </SelectItem>
                    {Array.from({ length: 16 }, (_, n) => (
                      <SelectItem
                        key={n + 1}
                        value={String(n + 1)}
                        className="text-white hover:bg-studio-600"
                      >
                        {n + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {footswitch.assignment === "midi-pc" ? (
                <div className="flex-1">
                  <label className="text-[10px] text-studio-400 block">PC#</label>
                  <Input
                    type="number"
                    min={0}
                    max={127}
                    value={midi.program ?? 0}
                    onChange={(e) => handleNumChange("program", e.target.value)}
                    className="h-7 text-xs bg-studio-700 border-studio-600 text-white"
                    data-testid={`input-fs-${index}-midi-pc`}
                  />
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <label className="text-[10px] text-studio-400 block">CC#</label>
                    <Input
                      type="number"
                      min={0}
                      max={127}
                      value={midi.cc ?? 0}
                      onChange={(e) => handleNumChange("cc", e.target.value)}
                      className={`h-7 text-xs bg-studio-700 border-studio-600 text-white ${
                        ccReserved ? "border-red-500" : ""
                      }`}
                      data-testid={`input-fs-${index}-midi-cc`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-studio-400 block">Val</label>
                    <Input
                      type="number"
                      min={0}
                      max={127}
                      value={midi.ccValue ?? 0}
                      onChange={(e) => handleNumChange("ccValue", e.target.value)}
                      className="h-7 text-xs bg-studio-700 border-studio-600 text-white"
                      data-testid={`input-fs-${index}-midi-cc-value`}
                    />
                  </div>
                </>
              )}
            </div>

            {ccReserved && (
              <div
                className="flex items-start gap-1.5 text-[10px] text-yellow-300 bg-yellow-950/40 border border-yellow-700 rounded px-1.5 py-1"
                data-testid={`warning-fs-${index}-reserved-cc`}
              >
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  CC {midi.cc} is reserved on HX Effects (
                  {reservedCcDescription(midi.cc!)}). Pick a different CC number.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-center">
        <span className={getStatusColor()} data-testid={`text-fs-${index}-status`}>
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}
