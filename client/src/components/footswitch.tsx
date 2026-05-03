import { useMemo } from "react";
import { Footswitch, EffectBlock, Snapshot, MidiCommand } from "@shared/schema";
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

interface FootswitchProps {
  footswitch: Footswitch;
  index: number;
  effectBlocks: EffectBlock[];
  snapshots: Snapshot[];
  onChange: (footswitch: Footswitch) => void;
}

export default function FootswitchComponent({
  footswitch,
  index,
  effectBlocks,
  snapshots,
  onChange,
}: FootswitchProps) {
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

  const midi: MidiCommand = footswitch.midi ?? { type: "none" };

  const handleAssignmentChange = (assignment: "off" | "snapshot" | "effect") => {
    onChange({ ...footswitch, assignment, value: "" });
  };

  const handleValueChange = (value: string) => {
    onChange({ ...footswitch, value });
  };

  const handleMidiTypeChange = (type: "none" | "pc" | "cc") => {
    if (type === "none") {
      onChange({ ...footswitch, midi: { type: "none" } });
      return;
    }
    if (type === "pc") {
      onChange({
        ...footswitch,
        midi: {
          type: "pc",
          channel: midi.channel ?? "base",
          program: midi.program ?? 0,
        },
      });
      return;
    }
    onChange({
      ...footswitch,
      midi: {
        type: "cc",
        channel: midi.channel ?? "base",
        cc: midi.cc ?? 3,
        ccValue: midi.ccValue ?? 127,
      },
    });
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
    onChange({
      ...footswitch,
      midi: { ...midi, [field]: Math.max(0, Math.min(127, n)) },
    });
  };

  const getEffectName = (internalRef: string) => {
    const effect = effectsMapping.find((e) => e.internal === internalRef);
    return effect ? effect.friendly : "Unknown Effect";
  };

  const getPedalColor = () => {
    if (footswitch.assignment === "off" && midi.type === "none")
      return "border-studio-600 bg-gradient-to-b from-studio-700 to-studio-800";
    if (footswitch.assignment === "snapshot" && footswitch.value)
      return "border-green-500 bg-gradient-to-b from-green-700 to-green-800";
    if (footswitch.assignment === "effect" && footswitch.value)
      return "border-orange-500 bg-gradient-to-b from-orange-700 to-orange-800";
    if (midi.type !== "none")
      return "border-purple-500 bg-gradient-to-b from-purple-700 to-purple-800";
    return "border-blue-500 bg-gradient-to-b from-blue-700 to-blue-800";
  };

  const getStatusText = () => {
    const parts: string[] = [];
    if (footswitch.assignment === "snapshot" && footswitch.value !== "") {
      const snapIdx = parseInt(footswitch.value, 10);
      parts.push(`Snap: ${snapshots[snapIdx]?.name || `#${snapIdx + 1}`}`);
    } else if (footswitch.assignment === "effect" && footswitch.value !== "") {
      const blockIdx = parseInt(footswitch.value, 10);
      const eff = effectBlocks[blockIdx];
      parts.push(`Effect: ${eff ? getEffectName(eff.effect) : `Block ${blockIdx}`}`);
    } else if (footswitch.assignment !== "off") {
      parts.push("Incomplete");
    }
    if (midi.type === "pc") parts.push(`PC ${midi.program ?? 0}`);
    if (midi.type === "cc")
      parts.push(`CC ${midi.cc ?? 0}=${midi.ccValue ?? 0}`);
    return parts.length ? parts.join(" · ") : "Unassigned";
  };

  const getStatusColor = () => {
    if (footswitch.assignment === "off" && midi.type === "none")
      return "text-studio-400";
    if (
      (footswitch.assignment === "snapshot" || footswitch.assignment === "effect") &&
      footswitch.value === ""
    )
      return "text-yellow-400";
    return "text-studio-200";
  };

  const ccReserved =
    midi.type === "cc" && midi.cc !== undefined && isReservedCc(midi.cc);

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
            Local action
          </div>
          <Select
            value={footswitch.assignment}
            onValueChange={handleAssignmentChange}
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
                Snapshot
              </SelectItem>
              <SelectItem
                value="effect"
                className="text-white hover:bg-studio-600"
              >
                Effect
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

        <div className="pt-2 border-t border-studio-700">
          <div className="text-[10px] uppercase tracking-wide text-studio-400 mb-1">
            MIDI out
          </div>
          <Select value={midi.type} onValueChange={handleMidiTypeChange}>
            <SelectTrigger
              className="w-full bg-studio-700 border-studio-600 text-white text-sm h-8"
              data-testid={`select-fs-${index}-midi-type`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-studio-700 border-studio-600">
              <SelectItem value="none" className="text-white hover:bg-studio-600">
                No MIDI
              </SelectItem>
              <SelectItem value="pc" className="text-white hover:bg-studio-600">
                Program Change
              </SelectItem>
              <SelectItem value="cc" className="text-white hover:bg-studio-600">
                Continuous Controller
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {midi.type !== "none" && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <div className="flex-1">
                <label className="text-[10px] text-studio-400 block">Ch</label>
                <Select
                  value={String(midi.channel ?? "base")}
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

              {midi.type === "pc" && (
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
              )}

              {midi.type === "cc" && (
                <>
                  <div className="flex-1">
                    <label className="text-[10px] text-studio-400 block">CC#</label>
                    <Input
                      type="number"
                      min={0}
                      max={127}
                      value={midi.cc ?? 0}
                      onChange={(e) => handleNumChange("cc", e.target.value)}
                      className="h-7 text-xs bg-studio-700 border-studio-600 text-white"
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
                  CC {midi.cc} is reserved on HX Effects ({reservedCcDescription(midi.cc!)}). Pick a different CC number.
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
