import { GlobalMidiSettings } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";

interface Props {
  value: GlobalMidiSettings;
  onChange: (next: GlobalMidiSettings) => void;
}

const DIRECTION_OPTS = [
  { v: "off", label: "Off" },
  { v: "midi", label: "MIDI" },
  { v: "usb", label: "USB" },
  { v: "both", label: "Both" },
];

const RX_CLOCK_OPTS = [
  { v: "off", label: "Off" },
  { v: "midi", label: "MIDI" },
  { v: "usb", label: "USB" },
  { v: "auto", label: "Auto" },
];

export default function GlobalMidiPanel({ value, onChange }: Props) {
  const set = <K extends keyof GlobalMidiSettings>(
    key: K,
    v: GlobalMidiSettings[K],
  ) => onChange({ ...value, [key]: v });

  const setTempo = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    set("tempo", Math.max(40, Math.min(240, n)));
  };

  return (
    <div className="bg-studio-800 rounded-xl p-6 border border-studio-700 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
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
            Saved to this preset.
          </p>
        </div>

        <div>
          <label className="block text-xs text-studio-400 mb-1">
            Base MIDI Channel
          </label>
          <Select
            value={String(value.baseChannel)}
            onValueChange={(v) => set("baseChannel", parseInt(v, 10))}
          >
            <SelectTrigger
              className="bg-studio-700 border-studio-600 text-white"
              data-testid="select-global-base-channel"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-studio-700 border-studio-600 max-h-60">
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

        <DirectionSelect
          label="MIDI PC Rx"
          value={value.pcRx}
          onChange={(v) => set("pcRx", v as any)}
          opts={DIRECTION_OPTS}
          testId="select-global-pc-rx"
        />

        <DirectionSelect
          label="MIDI PC Tx"
          value={value.pcTx}
          onChange={(v) => set("pcTx", v as any)}
          opts={DIRECTION_OPTS}
          testId="select-global-pc-tx"
        />

        <DirectionSelect
          label="Tx MIDI Clock"
          value={value.txClock}
          onChange={(v) => set("txClock", v as any)}
          opts={DIRECTION_OPTS}
          testId="select-global-tx-clock"
        />

        <DirectionSelect
          label="Rx MIDI Clock"
          value={value.rxClock}
          onChange={(v) => set("rxClock", v as any)}
          opts={RX_CLOCK_OPTS}
          testId="select-global-rx-clock"
        />

        <ToggleRow
          label="MIDI Thru"
          checked={value.midiThru}
          onChange={(v) => set("midiThru", v)}
          testId="switch-global-midi-thru"
        />

        <ToggleRow
          label="USB MIDI"
          checked={value.usbMidi}
          onChange={(v) => set("usbMidi", v)}
          testId="switch-global-usb-midi"
        />

        <ToggleRow
          label="Snapshot CC Send (CC69)"
          checked={value.snapshotCcSend}
          onChange={(v) => set("snapshotCcSend", v)}
          testId="switch-global-snapshot-cc"
        />
      </div>

      <div className="flex items-start gap-2 text-xs text-studio-400 bg-studio-900 border border-studio-700 rounded px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Only Preset Tempo is stored in the .hlx file. The other settings
          live in your HX Effects' Global Settings on the device — these
          fields document what to set there so this preset behaves as
          expected.
        </span>
      </div>
    </div>
  );
}

function DirectionSelect({
  label,
  value,
  onChange,
  opts,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: { v: string; label: string }[];
  testId: string;
}) {
  return (
    <div>
      <label className="block text-xs text-studio-400 mb-1">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="bg-studio-700 border-studio-600 text-white"
          data-testid={testId}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-studio-700 border-studio-600">
          {opts.map((o) => (
            <SelectItem
              key={o.v}
              value={o.v}
              className="text-white hover:bg-studio-600"
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between bg-studio-700 border border-studio-600 rounded px-3 py-2">
      <span className="text-xs text-studio-200">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        data-testid={testId}
      />
    </div>
  );
}
