import { GlobalMidiSettings } from "@shared/schema";
import { Input } from "@/components/ui/input";

interface Props {
  value: GlobalMidiSettings;
  onChange: (next: GlobalMidiSettings) => void;
}

export default function GlobalMidiPanel({ value, onChange }: Props) {
  const setTempo = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    onChange({ ...value, tempo: Math.max(40, Math.min(240, n)) });
  };

  return (
    <div className="bg-studio-800 rounded-xl p-6 border border-studio-700">
      <div className="max-w-xs">
        <label className="block text-xs text-studio-400 mb-1">
          Preset Tempo (BPM)
        </label>
        <Input
          type="number"
          min={40}
          max={240}
          value={value.tempo}
          onChange={(e) => setTempo(e.target.value)}
          className="bg-studio-700 border-studio-600 text-white"
          data-testid="input-global-tempo"
        />
        <p className="text-[10px] text-studio-500 mt-1">
          Saved to this preset (writes to the standard HX <code>@tempo</code>{" "}
          field).
        </p>
      </div>
    </div>
  );
}
