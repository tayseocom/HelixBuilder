import { useState, useEffect, useRef } from "react";
import { Guitar, Upload, Download, CheckCircle, AlertTriangle, Camera, Layers, Grid3X3, Sparkles } from "lucide-react";
import { EffectBlock, Snapshot, Footswitch } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import EffectBlockComponent from "@/components/effect-block";
import SnapshotSlot from "@/components/snapshot-slot";
import FootswitchComponent from "@/components/footswitch";
import AISuggestions from "@/components/ai-suggestions";
import { exportPresetAsFile, parseHlxFile } from "@/lib/preset-utils";

export default function PresetGenerator() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core state
  const [presetName, setPresetName] = useState("New Preset");
  const [effectBlocks, setEffectBlocks] = useState<EffectBlock[]>(
    Array.from({ length: 9 }, (_, i) => ({
      enabled: false,
      effect: '',
      position: i
    }))
  );
  const [snapshots, setSnapshots] = useState<Snapshot[]>(
    Array.from({ length: 4 }, () => ({
      name: '',
      active: false
    }))
  );
  const [footswitches, setFootswitches] = useState<Footswitch[]>(
    Array.from({ length: 6 }, () => ({
      assignment: 'off' as const,
      value: ''
    }))
  );

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('hx-preset-generator');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setPresetName(state.presetName || 'New Preset');
        setEffectBlocks(state.effectBlocks || effectBlocks);
        setSnapshots(state.snapshots || snapshots);
        setFootswitches(state.footswitches || footswitches);
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    const state = {
      presetName,
      effectBlocks,
      snapshots,
      footswitches
    };
    localStorage.setItem('hx-preset-generator', JSON.stringify(state));
  }, [presetName, effectBlocks, snapshots, footswitches]);

  const handleEffectBlockChange = (index: number, block: EffectBlock) => {
    const newBlocks = [...effectBlocks];
    newBlocks[index] = block;
    setEffectBlocks(newBlocks);
  };

  const handleSnapshotChange = (index: number, snapshot: Snapshot) => {
    const newSnapshots = [...snapshots];
    newSnapshots[index] = snapshot;
    setSnapshots(newSnapshots);
  };

  const handleFootswitchChange = (index: number, footswitch: Footswitch) => {
    const newFootswitches = [...footswitches];
    newFootswitches[index] = footswitch;
    setFootswitches(newFootswitches);
  };

  const handleApplyAISuggestion = (newEffectBlocks: EffectBlock[], newSnapshots: Snapshot[]) => {
    setEffectBlocks(newEffectBlocks);
    setSnapshots(newSnapshots);
  };

  const handleExport = () => {
    try {
      exportPresetAsFile({
        name: presetName,
        effectBlocks,
        snapshots,
        footswitches
      });
      toast({
        title: "Success",
        description: "Preset exported successfully!",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export preset. Please check your configuration.",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedData = await parseHlxFile(file);
      
      if (parsedData.name) setPresetName(parsedData.name);
      if (parsedData.effectBlocks) setEffectBlocks(parsedData.effectBlocks);
      if (parsedData.snapshots) setSnapshots(parsedData.snapshots);
      if (parsedData.footswitches) setFootswitches(parsedData.footswitches);

      toast({
        title: "Success",
        description: "Preset imported successfully!",
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import preset. Please check file format.",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-studio-900 text-studio-200">
      {/* Header */}
      <header className="bg-studio-800 border-b border-studio-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Guitar className="text-blue-500 text-2xl" />
            <h1 className="text-xl font-semibold text-white">HX Effects Preset Generator</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleImport}
              variant="outline"
              className="bg-studio-700 hover:bg-studio-600 border-studio-600 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import .hlx
            </Button>
            <Button
              onClick={handleExport}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export .hlx
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".hlx"
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Preset Name Section */}
        <section className="mb-8">
          <div className="bg-studio-800 rounded-xl p-6 border border-studio-700">
            <label className="block text-sm font-medium text-studio-300 mb-2">
              Preset Name
            </label>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter preset name..."
              className="bg-studio-700 border-studio-600 text-white placeholder-studio-400 focus:border-blue-500"
            />
          </div>
        </section>

        {/* Main Tabs */}
        <Tabs defaultValue="manual" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 bg-studio-800 border border-studio-700">
            <TabsTrigger value="manual" className="data-[state=active]:bg-studio-700 text-white">
              Manual Configuration
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-studio-700 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Suggestions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-8">
            {/* Effect Blocks Section */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Layers className="text-green-500 mr-3" />
                Effect Blocks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {effectBlocks.map((block, index) => (
                  <EffectBlockComponent
                    key={index}
                    block={block}
                    index={index}
                    onChange={(newBlock) => handleEffectBlockChange(index, newBlock)}
                  />
                ))}
              </div>
            </section>

            {/* Snapshots Section */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Camera className="text-orange-500 mr-3" />
                Snapshots
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {snapshots.map((snapshot, index) => (
                  <SnapshotSlot
                    key={index}
                    snapshot={snapshot}
                    index={index}
                    onChange={(newSnapshot) => handleSnapshotChange(index, newSnapshot)}
                  />
                ))}
              </div>
            </section>

            {/* Footswitches Section */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Grid3X3 className="text-blue-500 mr-3" />
                Footswitch Assignments
              </h2>
              
              {/* Top Row */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                {footswitches.slice(0, 3).map((footswitch, index) => (
                  <FootswitchComponent
                    key={index}
                    footswitch={footswitch}
                    index={index}
                    effectBlocks={effectBlocks}
                    snapshots={snapshots}
                    onChange={(newFootswitch) => handleFootswitchChange(index, newFootswitch)}
                  />
                ))}
              </div>
              
              {/* Bottom Row */}
              <div className="grid grid-cols-3 gap-6">
                {footswitches.slice(3, 6).map((footswitch, index) => (
                  <FootswitchComponent
                    key={index + 3}
                    footswitch={footswitch}
                    index={index + 3}
                    effectBlocks={effectBlocks}
                    snapshots={snapshots}
                    onChange={(newFootswitch) => handleFootswitchChange(index + 3, newFootswitch)}
                  />
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="ai">
            <AISuggestions onApplySuggestion={handleApplyAISuggestion} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
