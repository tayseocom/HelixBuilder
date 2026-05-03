import { Snapshot, EffectBlock } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { effectsMapping } from "@/lib/effects-mapping";

interface SnapshotSlotProps {
  snapshot: Snapshot;
  index: number;
  effectBlocks: EffectBlock[];
  onChange: (snapshot: Snapshot) => void;
}

const LED_COLORS = [
  { value: 1, name: "White", className: "bg-white" },
  { value: 2, name: "Red", className: "bg-red-500" },
  { value: 3, name: "Orange", className: "bg-orange-500" },
  { value: 4, name: "Yellow", className: "bg-yellow-400" },
  { value: 5, name: "Green", className: "bg-green-500" },
  { value: 6, name: "Cyan", className: "bg-cyan-400" },
  { value: 7, name: "Blue", className: "bg-blue-500" },
  { value: 8, name: "Purple", className: "bg-purple-500" },
  { value: 9, name: "Pink", className: "bg-pink-500" },
];

export default function SnapshotSlot({
  snapshot,
  index,
  effectBlocks,
  onChange,
}: SnapshotSlotProps) {
  const handleNameChange = (name: string) => {
    onChange({
      ...snapshot,
      name,
      active: name.trim() !== "",
    });
  };

  const handleColorChange = (ledcolor: number) => {
    onChange({ ...snapshot, ledcolor });
  };

  const handleTempoChange = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    onChange({ ...snapshot, tempo: Math.max(40, Math.min(240, n)) });
  };

  const handleBypassToggle = (blockIndex: number) => {
    const current = snapshot.blockBypass ?? Array.from({ length: 9 }, () => false);
    const next = [...current];
    next[blockIndex] = !next[blockIndex];
    onChange({ ...snapshot, blockBypass: next });
  };

  const isActive = snapshot.name.trim() !== "";
  const ledcolor = snapshot.ledcolor ?? index + 1;
  const tempo = snapshot.tempo ?? 140;
  const activeBlocks = effectBlocks
    .map((b, i) => ({ block: b, index: i }))
    .filter(({ block }) => !!block.effect);

  return (
    <div className="bg-studio-800 rounded-lg p-4 border border-studio-700 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-studio-300">
          Snapshot {index + 1}
        </label>
        <span
          className={`text-xs ${isActive ? "text-green-400" : "text-studio-400"}`}
          data-testid={`snapshot-status-${index}`}
        >
          {isActive ? "Active" : "Unused"}
        </span>
      </div>

      <Input
        value={snapshot.name}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder={`Snapshot ${index + 1} name`}
        className="bg-studio-700 border-studio-600 text-white placeholder-studio-400 focus:border-blue-500"
        data-testid={`input-snapshot-name-${index}`}
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-xs text-studio-400">LED</span>
          <div className="flex gap-1 flex-wrap">
            {LED_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleColorChange(c.value)}
                title={c.name}
                aria-label={`Set color ${c.name}`}
                className={`w-4 h-4 rounded-full ${c.className} border ${
                  ledcolor === c.value
                    ? "border-white ring-1 ring-blue-400"
                    : "border-studio-600"
                }`}
                data-testid={`button-snapshot-color-${index}-${c.value}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-studio-400">BPM</span>
          <Input
            type="number"
            min={40}
            max={240}
            value={tempo}
            onChange={(e) => handleTempoChange(e.target.value)}
            className="w-16 h-7 px-2 bg-studio-700 border-studio-600 text-white text-xs"
            data-testid={`input-snapshot-tempo-${index}`}
          />
        </div>
      </div>

      <div>
        <div className="text-xs text-studio-400 mb-1.5">Block bypass</div>
        {activeBlocks.length === 0 ? (
          <div className="text-xs text-studio-500 italic">
            Add an effect block to configure its state for this snapshot.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {activeBlocks.map(({ block, index: bIdx }) => {
              const enabledHere =
                snapshot.blockBypass?.[bIdx] ?? block.enabled;
              const friendly =
                effectsMapping.find((e) => e.internal === block.effect)
                  ?.friendly ?? block.effect;
              return (
                <button
                  key={bIdx}
                  type="button"
                  onClick={() => handleBypassToggle(bIdx)}
                  title={friendly}
                  className={`text-[10px] px-1.5 py-1 rounded border truncate ${
                    enabledHere
                      ? "bg-green-700 border-green-500 text-white"
                      : "bg-studio-700 border-studio-600 text-studio-400"
                  }`}
                  data-testid={`button-snapshot-${index}-block-${bIdx}`}
                >
                  B{bIdx}: {friendly}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
