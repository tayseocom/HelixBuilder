import OpenAI from "openai";
import { effectsMapping } from "../client/src/lib/effects-mapping";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SuggestionRequest {
  description: string;
  artist?: string;
  genre?: string;
}

export interface EffectSuggestion {
  position: number;
  effect: string;
  enabled: boolean;
  reasoning: string;
}

export interface SnapshotSuggestion {
  name: string;
  description: string;
  effectStates: { [blockIndex: number]: boolean };
}

export interface AISuggestion {
  reasoning: string;
  effectChain: EffectSuggestion[];
  snapshots: SnapshotSuggestion[];
  tips: string[];
}

export async function generateEffectsSuggestions(request: SuggestionRequest): Promise<AISuggestion> {
  const availableEffects = effectsMapping.map(e => e.friendly).join(", ");
  
  const prompt = `You are an expert guitar effects specialist with deep knowledge of Line 6 HX Effects and guitar tones across all genres and artists. 

User wants to achieve: "${request.description}"
${request.artist ? `Trying to emulate: ${request.artist}` : ''}
${request.genre ? `Genre: ${request.genre}` : ''}

Available effects: ${availableEffects}

Create a comprehensive effects chain suggestion with up to 9 effect blocks. Consider:
- Signal chain order (compression → overdrive/distortion → modulation → time-based effects → reverb)
- Artist-specific tones and known gear setups
- Genre conventions and sonic characteristics
- Practical snapshot variations for live performance

Respond with JSON in this exact format:
{
  "reasoning": "Brief explanation of the overall approach and why these effects were chosen",
  "effectChain": [
    {
      "position": 0,
      "effect": "Effect Name",
      "enabled": true,
      "reasoning": "Why this effect was chosen for this position"
    }
  ],
  "snapshots": [
    {
      "name": "Snapshot Name",
      "description": "When to use this snapshot",
      "effectStates": {
        "0": true,
        "1": false
      }
    }
  ],
  "tips": [
    "Practical tip for using this preset",
    "Performance or recording advice"
  ]
}

Only suggest effects that exist in the available effects list. Provide 2-4 snapshots representing different song sections or intensity levels.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert guitar effects specialist. Always respond with valid JSON matching the requested format exactly."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and map effect names to internal references
    if (result.effectChain) {
      result.effectChain = result.effectChain.map((effect: any) => {
        const mappedEffect = effectsMapping.find(e => e.friendly === effect.effect);
        if (mappedEffect) {
          return {
            ...effect,
            effect: mappedEffect.internal
          };
        }
        return null;
      }).filter(Boolean);
    }

    return result as AISuggestion;
  } catch (error) {
    console.error('AI suggestion error:', error);
    throw new Error('Failed to generate AI suggestions');
  }
}