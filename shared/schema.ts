import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const presets = pgTable("presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  effectBlocks: json("effect_blocks").notNull(),
  snapshots: json("snapshots").notNull(),
  footswitches: json("footswitches").notNull(),
  hlxData: json("hlx_data").notNull(),
  userId: varchar("user_id").references(() => users.id),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPresetSchema = createInsertSchema(presets).pick({
  name: true,
  effectBlocks: true,
  snapshots: true,
  footswitches: true,
  hlxData: true,
  userId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type Preset = typeof presets.$inferSelect;

// Effect Block Schema. `params` preserves model-specific parameter values
// (Tone, Mix, Time, Sustain, ...) verbatim from imported files.
export const effectBlockSchema = z.object({
  enabled: z.boolean(),
  effect: z.string(),
  position: z.number(),
  params: z.record(z.any()).optional(),
});

export type EffectBlock = z.infer<typeof effectBlockSchema>;

// Snapshot Schema. Each snapshot stores per-block bypass states so the four
// snapshots can have independent footswitch/effect configurations. `rawCommands`
// and `rawControllers` preserve unknown structures from imported files.
export const snapshotSchema = z.object({
  name: z.string(),
  active: z.boolean(),
  ledcolor: z.number().optional(),
  tempo: z.number().optional(),
  blockBypass: z.array(z.boolean()).optional(),
  rawCommands: z.any().optional(),
  rawControllers: z.any().optional(),
});

export type Snapshot = z.infer<typeof snapshotSchema>;

// MIDI parameters used by midi-pc / midi-cc footswitch actions.
export const midiParamsSchema = z.object({
  channel: z.union([z.literal('base'), z.number().int().min(1).max(16)]),
  program: z.number().int().min(0).max(127).optional(),
  cc: z.number().int().min(0).max(127).optional(),
  ccValue: z.number().int().min(0).max(127).optional(),
});

export type MidiParams = z.infer<typeof midiParamsSchema>;

// "Instant Command" — additional MIDI message attached to a footswitch that
// fires alongside its local action. HX Effects' Command Center concept.
export const instantCommandSchema = z.object({
  type: z.enum(['pc', 'cc']),
  channel: z.union([z.literal('base'), z.number().int().min(1).max(16)]),
  program: z.number().int().min(0).max(127).optional(),
  cc: z.number().int().min(0).max(127).optional(),
  ccValue: z.number().int().min(0).max(127).optional(),
});

export type InstantCommand = z.infer<typeof instantCommandSchema>;

// Footswitch Schema.
//   - assignment: the primary action emitted as the FS's `@command`.
//       off | snapshot | effect | midi-pc | midi-cc
//   - midi: parameters used when assignment is midi-pc or midi-cc.
//   - instantCommands: optional extra MIDI messages that fire alongside the
//       primary action ("Command Center" instant commands).
export const footswitchSchema = z.object({
  assignment: z.enum(['off', 'snapshot', 'effect', 'midi-pc', 'midi-cc']),
  value: z.string(),
  midi: midiParamsSchema.optional(),
  instantCommands: z.array(instantCommandSchema).optional(),
});

export type Footswitch = z.infer<typeof footswitchSchema>;

// Global MIDI / tempo settings.
// Only `tempo` is actually written into the preset file (preset `global.@tempo`).
// The other fields are device-level globals on the HX hardware and are kept
// in the UI for completeness but are not part of `.hlx` preset payloads.
export const globalMidiSchema = z.object({
  baseChannel: z.number().int().min(1).max(16),
  midiThru: z.boolean(),
  usbMidi: z.boolean(),
  pcRx: z.enum(['off', 'midi', 'usb', 'both']),
  pcTx: z.enum(['off', 'midi', 'usb', 'both']),
  snapshotCcSend: z.boolean(),
  txClock: z.enum(['off', 'midi', 'usb', 'both']),
  rxClock: z.enum(['off', 'midi', 'usb', 'auto']),
  tempo: z.number(),
});

export type GlobalMidiSettings = z.infer<typeof globalMidiSchema>;

// Effect Mapping Schema
export const effectMappingSchema = z.object({
  friendly: z.string(),
  internal: z.string(),
});

export type EffectMapping = z.infer<typeof effectMappingSchema>;
