import { Snapshot } from "@shared/schema";
import { Input } from "@/components/ui/input";

interface SnapshotSlotProps {
  snapshot: Snapshot;
  index: number;
  onChange: (snapshot: Snapshot) => void;
}

export default function SnapshotSlot({ snapshot, index, onChange }: SnapshotSlotProps) {
  const handleNameChange = (name: string) => {
    onChange({
      ...snapshot,
      name,
      active: name.trim() !== ''
    });
  };

  return (
    <div className="bg-studio-800 rounded-lg p-4 border border-studio-700">
      <label className="block text-sm font-medium text-studio-300 mb-2">
        Snapshot {index + 1}
      </label>
      <Input
        value={snapshot.name}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder={`Snapshot ${index + 1} name`}
        className="bg-studio-700 border-studio-600 text-white placeholder-studio-400 focus:border-blue-500"
      />
      <div className="mt-3 text-xs text-studio-400">
        {snapshot.active ? "Active" : "Unused"}
      </div>
    </div>
  );
}
