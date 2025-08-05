import { type User, type InsertUser, type Preset, type InsertPreset } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getPreset(id: string): Promise<Preset | undefined>;
  getPresetsByUser(userId: string): Promise<Preset[]>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  updatePreset(id: string, preset: Partial<InsertPreset>): Promise<Preset | undefined>;
  deletePreset(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private presets: Map<string, Preset>;

  constructor() {
    this.users = new Map();
    this.presets = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPreset(id: string): Promise<Preset | undefined> {
    return this.presets.get(id);
  }

  async getPresetsByUser(userId: string): Promise<Preset[]> {
    return Array.from(this.presets.values()).filter(
      (preset) => preset.userId === userId,
    );
  }

  async createPreset(insertPreset: InsertPreset): Promise<Preset> {
    const id = randomUUID();
    const preset: Preset = { ...insertPreset, id };
    this.presets.set(id, preset);
    return preset;
  }

  async updatePreset(id: string, updateData: Partial<InsertPreset>): Promise<Preset | undefined> {
    const existing = this.presets.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.presets.set(id, updated);
    return updated;
  }

  async deletePreset(id: string): Promise<boolean> {
    return this.presets.delete(id);
  }
}

export const storage = new MemStorage();
