import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPresetSchema } from "@shared/schema";
import { z } from "zod";
import { generateEffectsSuggestions, type SuggestionRequest } from "./ai-suggestions";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all presets for current user (simplified - no auth for now)
  app.get("/api/presets", async (req, res) => {
    try {
      // For demo purposes, we'll just return all presets
      // In real app, this would be filtered by authenticated user
      const presets = await storage.getPresetsByUser("demo-user");
      res.json(presets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch presets" });
    }
  });

  // Get single preset
  app.get("/api/presets/:id", async (req, res) => {
    try {
      const preset = await storage.getPreset(req.params.id);
      if (!preset) {
        return res.status(404).json({ message: "Preset not found" });
      }
      res.json(preset);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch preset" });
    }
  });

  // Create new preset
  app.post("/api/presets", async (req, res) => {
    try {
      const validatedData = insertPresetSchema.parse({
        ...req.body,
        userId: "demo-user" // Simplified for demo
      });
      
      const preset = await storage.createPreset(validatedData);
      res.status(201).json(preset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid preset data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create preset" });
      }
    }
  });

  // Update preset
  app.put("/api/presets/:id", async (req, res) => {
    try {
      const validatedData = insertPresetSchema.partial().parse(req.body);
      const preset = await storage.updatePreset(req.params.id, validatedData);
      
      if (!preset) {
        return res.status(404).json({ message: "Preset not found" });
      }
      
      res.json(preset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid preset data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update preset" });
      }
    }
  });

  // Delete preset
  app.delete("/api/presets/:id", async (req, res) => {
    try {
      const success = await storage.deletePreset(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Preset not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete preset" });
    }
  });

  // AI Suggestions endpoint
  app.post("/api/ai-suggestions", async (req, res) => {
    console.log('🎸 [API] Received AI suggestions request:', {
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });

    try {
      const suggestionRequestSchema = z.object({
        description: z.string().min(1, "Description is required"),
        artist: z.string().optional(),
        genre: z.string().optional()
      });

      console.log('🎸 [API] Validating request data...');
      const validatedData = suggestionRequestSchema.parse(req.body);
      console.log('✅ [API] Request data validated successfully');

      console.log('🎸 [API] Calling AI suggestions service...');
      const suggestions = await generateEffectsSuggestions(validatedData);
      console.log('✅ [API] AI suggestions generated successfully');
      
      res.json(suggestions);
    } catch (error) {
      const err = error as Error;
      if (error instanceof z.ZodError) {
        console.error('❌ [API] Validation error:', error.errors);
        res.status(400).json({ message: "Invalid request data", errors: error.errors });
      } else {
        console.error('❌ [API] AI suggestions error:', {
          name: err.name,
          message: err.message,
          stack: err.stack?.split('\n').slice(0, 3)
        });
        res.status(500).json({ 
          message: err.message || "Failed to generate AI suggestions",
          error: err.name
        });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
