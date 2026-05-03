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

// Footswitch Schema. Each footswitch has one canonical action that maps to
// `commandFSn.@command` in the .hlx file:
//   - off:      no command emitted
//   - snapshot: recall snapshot identified by `value`
//   - effect:   bypass-toggle the block at index `value`
export const footswitchSchema = z.object({
  assignment: z.enum(['off', 'snapshot', 'effect']),
  value: z.string(),
});

export type Footswitch = z.infer<typeof footswitchSchema>;

// Preset-scoped settings actually written into the .hlx file.
// (Device-global MIDI settings live on the hardware, not in preset files,
// so they are intentionally not modeled here.)
export const globalMidiSchema = z.object({
  tempo: z.number(),
});

export type GlobalMidiSettings = z.infer<typeof globalMidiSchema>;

// Effect Mapping Schema
export const effectMappingSchema = z.object({
  friendly: z.string(),
  internal: z.string(),
});

export type EffectMapping = z.infer<typeof effectMappingSchema>;
