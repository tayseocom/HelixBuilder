import { EffectBlock } from "@shared/schema";
import { effectsMapping } from "@/lib/effects-mapping";
import { getParamDef, sortParamKeys, ParamControl } from "@/lib/param-metadata";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EffectBlockProps {
  block: EffectBlock;
  index: number;
  onChange: (block: EffectBlock) => void;
}

export default function EffectBlockComponent({ block, index, onChange }: EffectBlockProps) {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({ ...block, enabled });
  };

  const handleEffectChange = (effect: string) => {
    // Switching to a different model invalidates the previous model's
    // parameter values — drop them so we don't write nonsensical keys
    // into the exported `.hlx`.
    if (effect !== block.effect) {
      onChange({ ...block, effect, params: undefined });
    } else {
      onChange({ ...block, effect });
    }
  };

  const handleParamChange = (key: string, value: any) => {
    onChange({
      ...block,
      params: { ...(block.params || {}), [key]: value },
    });
  };

  const params = block.params || {};
  const paramKeys = sortParamKeys(Object.keys(params));

  return (
    <div className="bg-studio-800 rounded-lg p-4 border border-studio-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-studio-300">Block {index}</span>
        <Switch
          checked={block.enabled}
          onCheckedChange={handleEnabledChange}
          data-testid={`switch-block-enabled-${index}`}
        />
      </div>
      <Select
        value={block.effect}
        onValueChange={handleEffectChange}
        disabled={!block.enabled}
      >
        <SelectTrigger
          className="w-full bg-studio-700 border-studio-600 text-white text-sm focus:border-blue-500 disabled:opacity-50"
          data-testid={`select-block-effect-${index}`}
        >
          <SelectValue placeholder="Select Effect" />
        </SelectTrigger>
        <SelectContent className="bg-studio-700 border-studio-600">
          {effectsMapping.map((effect) => (
            <SelectItem
              key={effect.internal}
              value={effect.internal}
              className="text-white hover:bg-studio-600"
            >
              {effect.friendly}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {paramKeys.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-studio-700 pt-3">
          {paramKeys.map((key) => (
            <ParamControlRow
              key={key}
              blockIndex={index}
              paramKey={key}
              value={params[key]}
              model={block.effect}
              disabled={!block.enabled}
              onChange={(v) => handleParamChange(key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ParamRowProps {
  blockIndex: number;
  paramKey: string;
  value: any;
  model: string;
  disabled: boolean;
  onChange: (value: any) => void;
}

function ParamControlRow({ blockIndex, paramKey, value, model, disabled, onChange }: ParamRowProps) {
  const def = getParamDef(model, paramKey, value);
  const c = def.control;
  const testIdBase = `param-${blockIndex}-${paramKey.replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-studio-300">{def.label}</Label>
        <ParamValueLabel control={c} value={value} />
      </div>
      <ParamInput
        control={c}
        value={value}
        disabled={disabled}
        testId={testIdBase}
        onChange={onChange}
      />
    </div>
  );
}

function ParamValueLabel({ control, value }: { control: ParamControl; value: any }) {
  if (control.kind === "boolean") return null;
  if (control.kind === "text") return null;
  if (control.kind === "enum") {
    const opt = control.options.find((o) => o.value === value);
    return <span className="text-xs text-studio-400 tabular-nums">{opt ? opt.label : String(value)}</span>;
  }
  if (control.kind === "slider") {
    const num = typeof value === "number" ? value : 0;
    const text = control.format ? control.format(num) : num.toFixed(2);
    return <span className="text-xs text-studio-400 tabular-nums">{text}</span>;
  }
  // number
  return <span className="text-xs text-studio-400 tabular-nums">{String(value)}</span>;
}

function ParamInput({
  control,
  value,
  disabled,
  testId,
  onChange,
}: {
  control: ParamControl;
  value: any;
  disabled: boolean;
  testId: string;
  onChange: (value: any) => void;
}) {
  if (control.kind === "boolean") {
    return (
      <Switch
        checked={!!value}
        onCheckedChange={(v) => onChange(!!v)}
        disabled={disabled}
        data-testid={testId}
      />
    );
  }

  if (control.kind === "enum") {
    const current = value;
    return (
      <Select
        value={String(current)}
        onValueChange={(v) => {
          const opt = control.options.find((o) => String(o.value) === v);
          onChange(opt ? opt.value : v);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          className="w-full bg-studio-700 border-studio-600 text-white text-xs h-8"
          data-testid={testId}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-studio-700 border-studio-600">
          {control.options.map((o) => (
            <SelectItem
              key={String(o.value)}
              value={String(o.value)}
              className="text-white hover:bg-studio-600 text-xs"
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (control.kind === "slider") {
    const num = typeof value === "number" ? value : control.min;
    const clamped = Math.max(control.min, Math.min(control.max, num));
    return (
      <Slider
        value={[clamped]}
        min={control.min}
        max={control.max}
        step={control.step}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
        data-testid={testId}
      />
    );
  }

  if (control.kind === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "number" ? value : ""}
        min={control.min}
        max={control.max}
        step={control.step ?? 1}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return;
          const n = Number(v);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="bg-studio-700 border-studio-600 text-white text-xs h-8"
        data-testid={testId}
      />
    );
  }

  // text
  return (
    <Input
      type="text"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="bg-studio-700 border-studio-600 text-white text-xs h-8"
      data-testid={testId}
    />
  );
}
