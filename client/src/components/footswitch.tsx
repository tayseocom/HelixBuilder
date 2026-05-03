import { useMemo } from "react";
import { Footswitch, EffectBlock, Snapshot } from "@shared/schema";
import { effectsMapping } from "@/lib/effects-mapping";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Power } from "lucide-react";

type Assignment = Footswitch["assignment"];

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

  const handleAssignmentChange = (assignment: Assignment) => {
    onChange({ assignment, value: "" });
  };

  const handleValueChange = (value: string) => {
    onChange({ ...footswitch, value });
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
    }
  };

  const getStatusColor = () => {
    if (footswitch.assignment === "off") return "text-studio-400";
    if (footswitch.value === "") return "text-yellow-400";
    return "text-studio-200";
  };

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
      </div>

      <div className="mt-3 text-xs text-center">
        <span className={getStatusColor()} data-testid={`text-fs-${index}-status`}>
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}
