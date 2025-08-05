import { EffectBlock, Snapshot, Footswitch } from "@shared/schema";
import { baseHlxTemplate } from "./hlx-template";

export interface PresetData {
  name: string;
  effectBlocks: EffectBlock[];
  snapshots: Snapshot[];
  footswitches: Footswitch[];
}

export const generateHlxPreset = (presetData: PresetData) => {
  const preset = JSON.parse(JSON.stringify(baseHlxTemplate));
  
  // Set preset name and timestamp
  preset.data.meta.name = presetData.name;
  preset.data.meta.modifieddate = Math.floor(Date.now() / 1000);

  // Add effect blocks to dsp0
  presetData.effectBlocks.forEach((block, index) => {
    if (block.enabled && block.effect) {
      const blockKey = `block${index}`;
      preset.data.tone.dsp0[blockKey] = {
        "@model": block.effect,
        "@position": index + 1,
        "@no_snapshot_bypass": false,
        "@enabled": true,
        "@path": 0,
        "@type": 0,
        "@stereo": false
      };
    }
  });

  // Add snapshots
  const activeSnapshots = presetData.snapshots.filter(s => s.name.trim() !== '');
  activeSnapshots.forEach((snapshot, index) => {
    const snapshotKey = `snapshot${index}`;
    preset.data.tone[snapshotKey] = {
      "@name": snapshot.name,
      "@tempo": 140,
      "@valid": true,
      "@custom_name": true,
      "@ledcolor": index + 1,
      "blocks": {
        "dsp0": {}
      },
      "commands": {},
      "controllers": {},
      "@pedalstate": 0
    };

    // Set block states for this snapshot
    presetData.effectBlocks.forEach((block, blockIndex) => {
      preset.data.tone[snapshotKey].blocks.dsp0[`block${blockIndex}`] = block.enabled;
    });
  });

  // Add footswitch commands
  presetData.footswitches.forEach((fs, index) => {
    if (fs.assignment !== 'off' && fs.value !== '') {
      const fsKey = `commandFS${index + 1}`;
      preset.data.tone[fsKey] = {
        "@command": 15,
        "@press": index + 3,
        "@fs_primary": true,
        "@relhold": 0,
        "@behavior": 0,
        "@fs_enabled": true,
        "@fs_ledcolor": 462860,
        "@fs_label": fs.assignment === 'snapshot' ? 'Snapshot' : 'Effect',
        "@fs_momentary": true
      };
    }
  });

  return preset;
};

export const exportPresetAsFile = (presetData: PresetData) => {
  const hlxData = generateHlxPreset(presetData);
  const jsonString = JSON.stringify(hlxData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/hlx' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${presetData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.hlx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

export const parseHlxFile = async (file: File): Promise<Partial<PresetData>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const preset = JSON.parse(e.target?.result as string);
        
        // Extract preset name
        const name = preset.data?.meta?.name || 'Imported Preset';
        
        // Parse effect blocks
        const effectBlocks: EffectBlock[] = Array.from({ length: 9 }, (_, i) => ({
          enabled: false,
          effect: '',
          position: i
        }));

        // Extract blocks from dsp0
        const dsp0 = preset.data?.tone?.dsp0 || {};
        Object.keys(dsp0).forEach(key => {
          if (key.startsWith('block')) {
            const blockIndex = parseInt(key.replace('block', ''));
            if (blockIndex >= 0 && blockIndex < 9) {
              effectBlocks[blockIndex] = {
                enabled: dsp0[key]['@enabled'] || false,
                effect: dsp0[key]['@model'] || '',
                position: blockIndex
              };
            }
          }
        });

        // Parse snapshots
        const snapshots: Snapshot[] = Array.from({ length: 4 }, () => ({
          name: '',
          active: false
        }));

        // Extract snapshots
        Object.keys(preset.data?.tone || {}).forEach(key => {
          if (key.startsWith('snapshot')) {
            const snapshotIndex = parseInt(key.replace('snapshot', ''));
            if (snapshotIndex >= 0 && snapshotIndex < 4) {
              const snapshotData = preset.data.tone[key];
              snapshots[snapshotIndex] = {
                name: snapshotData['@name'] || '',
                active: true
              };
            }
          }
        });

        // Parse footswitches (simplified for now)
        const footswitches: Footswitch[] = Array.from({ length: 6 }, () => ({
          assignment: 'off' as const,
          value: ''
        }));

        resolve({
          name,
          effectBlocks,
          snapshots,
          footswitches
        });
      } catch (error) {
        reject(new Error('Failed to parse HLX file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
