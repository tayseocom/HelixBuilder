// Reserved MIDI CC numbers per the HX Effects 3.80 Owner's Manual (MIDI CC table).
// These are wired to global functions on the device and cannot be used as user
// controllers or assigned to footswitches.

export interface ReservedCc {
  cc: number;
  description: string;
}

export const RESERVED_CCS: ReservedCc[] = [
  { cc: 1, description: 'EXP 1 Pedal' },
  { cc: 2, description: 'EXP 2 Pedal' },
  { cc: 49, description: 'FS1 emulation' },
  { cc: 50, description: 'FS2 emulation' },
  { cc: 51, description: 'FS3 emulation' },
  { cc: 52, description: 'FS4 emulation' },
  { cc: 53, description: 'FS5 emulation' },
  { cc: 54, description: 'FS6 emulation' },
  { cc: 60, description: 'Looper Record/Overdub (FS4)' },
  { cc: 61, description: 'Looper Play/Stop (FS5)' },
  { cc: 62, description: 'Looper Play Once (FS6)' },
  { cc: 63, description: 'Looper Undo/Redo (FS1)' },
  { cc: 64, description: 'Tap Tempo' },
  { cc: 65, description: 'Looper Forward/Reverse (FS3)' },
  { cc: 66, description: 'Looper Full/Half Speed (FS2)' },
  { cc: 67, description: 'Looper block on/off' },
  { cc: 68, description: 'Tuner screen on/off' },
  { cc: 69, description: 'Snapshot select' },
  { cc: 70, description: 'All Bypass' },
  { cc: 71, description: 'MODE switch' },
  { cc: 72, description: 'Preset prev/next' },
  { cc: 75, description: 'Parameter Knob 1 (global)' },
  { cc: 76, description: 'Parameter Knob 2 (global)' },
  { cc: 77, description: 'Parameter Knob 3 (global)' },
  { cc: 81, description: 'Page Left/Right' },
  { cc: 128, description: 'Talent Boost' },
];

const RESERVED_CC_MAP = new Map(RESERVED_CCS.map((r) => [r.cc, r.description]));

export function isReservedCc(cc: number): boolean {
  return RESERVED_CC_MAP.has(cc);
}

export function reservedCcDescription(cc: number): string | undefined {
  return RESERVED_CC_MAP.get(cc);
}

export const DEFAULT_GLOBAL_MIDI = {
  baseChannel: 1,
  midiThru: false,
  usbMidi: true,
  pcRx: 'midi' as const,
  pcTx: 'midi' as const,
  snapshotCcSend: false,
  txClock: 'off' as const,
  rxClock: 'auto' as const,
  tempo: 140,
};
