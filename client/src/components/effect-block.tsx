import { EffectBlock } from "@shared/schema";
import { effectsMapping } from "@/lib/effects-mapping";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EffectBlockProps {
  block: EffectBlock;
  index: number;
  onChange: (block: EffectBlock) => void;
}

export default function EffectBlockComponent({ block, index, onChange }: EffectBlockProps) {
  const handleEnabledChange = (enabled: boolean) => {
    onChange({
      ...block,
      enabled
    });
  };

  const handleEffectChange = (effect: string) => {
    onChange({
      ...block,
      effect
    });
  };

  return (
    <div className="bg-studio-800 rounded-lg p-4 border border-studio-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-studio-300">Block {index}</span>
        <Switch
          checked={block.enabled}
          onCheckedChange={handleEnabledChange}
        />
      </div>
      <Select
        value={block.effect}
        onValueChange={handleEffectChange}
        disabled={!block.enabled}
      >
        <SelectTrigger className="w-full bg-studio-700 border-studio-600 text-white text-sm focus:border-blue-500 disabled:opacity-50">
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
    </div>
  );
}
