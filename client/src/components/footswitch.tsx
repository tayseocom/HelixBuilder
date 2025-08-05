import { Footswitch, EffectBlock, Snapshot } from "@shared/schema";
import { effectsMapping } from "@/lib/effects-mapping";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Power } from "lucide-react";

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
  onChange 
}: FootswitchProps) {
  
  const activeEffectBlocks = effectBlocks.filter(block => block.enabled && block.effect);
  const activeSnapshots = snapshots.filter(snapshot => snapshot.name.trim() !== '');

  const handleAssignmentChange = (assignment: 'off' | 'snapshot' | 'effect') => {
    onChange({
      assignment,
      value: ''
    });
  };

  const handleValueChange = (value: string) => {
    onChange({
      ...footswitch,
      value
    });
  };

  const getEffectName = (internalRef: string) => {
    const effect = effectsMapping.find(e => e.internal === internalRef);
    return effect ? effect.friendly : 'Unknown Effect';
  };

  const getPedalColor = () => {
    if (footswitch.assignment === 'off') return 'border-studio-600 bg-gradient-to-b from-studio-700 to-studio-800';
    if (footswitch.assignment === 'snapshot' && footswitch.value) return 'border-green-500 bg-gradient-to-b from-green-700 to-green-800';
    if (footswitch.assignment === 'effect' && footswitch.value) return 'border-orange-500 bg-gradient-to-b from-orange-700 to-orange-800';
    return 'border-blue-500 bg-gradient-to-b from-blue-700 to-blue-800';
  };

  const getStatusText = () => {
    if (footswitch.assignment === 'off') return 'Unassigned';
    if (footswitch.assignment === 'snapshot' && footswitch.value !== '') {
      const snapshotIndex = parseInt(footswitch.value);
      return `→ ${snapshots[snapshotIndex]?.name}`;
    }
    if (footswitch.assignment === 'effect' && footswitch.value !== '') {
      const blockIndex = parseInt(footswitch.value);
      return `→ Block ${blockIndex}`;
    }
    return 'Incomplete';
  };

  const getStatusColor = () => {
    if (footswitch.assignment === 'off') return 'text-studio-400';
    if (footswitch.assignment === 'snapshot' && footswitch.value !== '') return 'text-green-400';
    if (footswitch.assignment === 'effect' && footswitch.value !== '') return 'text-orange-400';
    return 'text-yellow-400';
  };

  return (
    <div className="bg-studio-800 rounded-xl p-6 border-2 border-studio-700 hover:border-studio-600 transition-colors">
      <div className="text-center mb-4">
        {/* Pedal Visual */}
        <div 
          className={`w-20 h-20 mx-auto rounded-full border-4 shadow-lg flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors ${getPedalColor()}`}
        >
          <Power className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm font-medium text-studio-300 mt-2">FS {index + 1}</div>
      </div>
      
      {/* Assignment Controls */}
      <div className="space-y-3">
        <Select
          value={footswitch.assignment}
          onValueChange={handleAssignmentChange}
        >
          <SelectTrigger className="w-full bg-studio-700 border-studio-600 text-white text-sm focus:border-blue-500">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-studio-700 border-studio-600">
            <SelectItem value="off" className="text-white hover:bg-studio-600">Off</SelectItem>
            <SelectItem value="snapshot" className="text-white hover:bg-studio-600">Snapshot</SelectItem>
            <SelectItem value="effect" className="text-white hover:bg-studio-600">Effect</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Snapshot Selection */}
        {footswitch.assignment === 'snapshot' && (
          <Select
            value={footswitch.value}
            onValueChange={handleValueChange}
          >
            <SelectTrigger className="w-full bg-studio-700 border-studio-600 text-white text-sm focus:border-blue-500">
              <SelectValue placeholder="Select Snapshot" />
            </SelectTrigger>
            <SelectContent className="bg-studio-700 border-studio-600">
              {activeSnapshots.map((snapshot, snapIndex) => (
                <SelectItem 
                  key={snapIndex} 
                  value={snapIndex.toString()}
                  className="text-white hover:bg-studio-600"
                >
                  {snapshot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Effect Selection */}
        {footswitch.assignment === 'effect' && (
          <Select
            value={footswitch.value}
            onValueChange={handleValueChange}
          >
            <SelectTrigger className="w-full bg-studio-700 border-studio-600 text-white text-sm focus:border-blue-500">
              <SelectValue placeholder="Select Effect" />
            </SelectTrigger>
            <SelectContent className="bg-studio-700 border-studio-600">
              {activeEffectBlocks.map((block, blockIndex) => (
                <SelectItem 
                  key={blockIndex} 
                  value={blockIndex.toString()}
                  className="text-white hover:bg-studio-600"
                >
                  Block {blockIndex}: {getEffectName(block.effect)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Assignment Status */}
      <div className="mt-3 text-xs text-center">
        <span className={getStatusColor()}>{getStatusText()}</span>
      </div>
    </div>
  );
}
