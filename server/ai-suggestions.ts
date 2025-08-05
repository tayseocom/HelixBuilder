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
  console.log('🎸 [AI-SUGGESTIONS] Starting generation with request:', {
    description: request.description,
    artist: request.artist,
    genre: request.genre
  });

  const availableEffects = effectsMapping.map(e => e.friendly);
  console.log('🎸 [AI-SUGGESTIONS] Loaded effects mapping:', {
    totalEffects: availableEffects.length,
    firstFew: availableEffects.slice(0, 5),
    lastFew: availableEffects.slice(-5)
  });

  const effectsList = availableEffects.join(", ");
  
  const prompt = `You are an expert guitar effects specialist with deep knowledge of Line 6 HX Effects and guitar tones across all genres and artists. 

User wants to achieve: "${request.description}"
${request.artist ? `Trying to emulate: ${request.artist}` : ''}
${request.genre ? `Genre: ${request.genre}` : ''}

CRITICAL: You must ONLY suggest effects from this exact list. Use the exact names as written:
${effectsList}

EXAMPLES of valid effect names from the list:
- "Red Squeeze" (compressor)
- "Triangle Fuzz" (distortion)
- "Simple Delay" (delay)
- "Hot Springs" (reverb)
- "Chrome" (wah)
- "Gain" (boost)

Create a comprehensive effects chain suggestion with up to 9 effect blocks. Consider:
- Signal chain order (compression → overdrive/distortion → modulation → time-based effects → reverb)
- Artist-specific tones and known gear setups
- Genre conventions and sonic characteristics
- Practical snapshot variations for live performance

IMPORTANT RULES:
1. Only use effect names that appear EXACTLY in the available effects list above
2. Do not suggest any effects not in the list
3. Use the exact spelling and capitalization from the list
4. Verify each effect name matches the list exactly

Respond with JSON in this exact format:
{
  "reasoning": "Brief explanation of the overall approach and why these effects were chosen",
  "effectChain": [
    {
      "position": 0,
      "effect": "Exact Effect Name From List",
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

Provide 2-4 snapshots representing different song sections or intensity levels.`;

  console.log('🎸 [AI-SUGGESTIONS] Checking OpenAI API key availability...');
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ [AI-SUGGESTIONS] OPENAI_API_KEY not found in environment');
    throw new Error('OpenAI API key not configured');
  }
  console.log('✅ [AI-SUGGESTIONS] OpenAI API key found');

  console.log('🎸 [AI-SUGGESTIONS] Sending request to OpenAI...', {
    model: "gpt-4o",
    promptLength: prompt.length,
    temperature: 0.3,
    maxTokens: 2000
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
      temperature: 0.3,
      max_tokens: 2000
    });

    console.log('✅ [AI-SUGGESTIONS] Received response from OpenAI:', {
      usage: response.usage,
      finishReason: response.choices[0]?.finish_reason,
      contentLength: response.choices[0]?.message?.content?.length
    });

    const rawContent = response.choices[0].message.content || '{}';
    console.log('🎸 [AI-SUGGESTIONS] Raw OpenAI response content:', rawContent.substring(0, 500) + '...');

    const result = JSON.parse(rawContent);
    console.log('🎸 [AI-SUGGESTIONS] Parsed JSON result:', {
      hasReasoning: !!result.reasoning,
      effectChainLength: result.effectChain?.length || 0,
      snapshotsLength: result.snapshots?.length || 0,
      tipsLength: result.tips?.length || 0,
      effectChainSample: result.effectChain?.slice(0, 2)
    });
    
    // Validate and map effect names to internal references
    if (result.effectChain) {
      console.log('🎸 [AI-SUGGESTIONS] Validating and mapping effect names...');
      result.effectChain = result.effectChain.map((effect: any, index: number) => {
        console.log(`🎸 [AI-SUGGESTIONS] Processing effect ${index}: "${effect.effect}"`);
        const mappedEffect = effectsMapping.find(e => e.friendly === effect.effect);
        if (mappedEffect) {
          console.log(`✅ [AI-SUGGESTIONS] Successfully mapped "${effect.effect}" to "${mappedEffect.internal}"`);
          return {
            ...effect,
            effect: mappedEffect.internal
          };
        } else {
          console.warn(`❌ [AI-SUGGESTIONS] Invalid effect suggested: "${effect.effect}"`);
          console.warn(`🎸 [AI-SUGGESTIONS] Closest matches:`, 
            availableEffects
              .filter(e => e.toLowerCase().includes(effect.effect.toLowerCase().split(' ')[0]))
              .slice(0, 5)
          );
          return null;
        }
      }).filter(Boolean);
    }

    console.log(`🎸 [AI-SUGGESTIONS] Final effect chain after validation:`, {
      effectCount: result.effectChain?.length || 0,
      effects: result.effectChain?.map((e: any) => e.effect) || []
    });

    // Additional validation to ensure all suggested effects are valid
    const invalidEffects = result.effectChain?.filter((effect: any) => {
      return !effectsMapping.find(e => e.internal === effect.effect);
    });

    if (invalidEffects && invalidEffects.length > 0) {
      console.error('❌ [AI-SUGGESTIONS] Found invalid effects after mapping:', invalidEffects);
      throw new Error(`AI suggested invalid effects: ${invalidEffects.map((e: any) => e.effect).join(', ')}`);
    }

    console.log('✅ [AI-SUGGESTIONS] Successfully generated and validated AI suggestions');
    return result as AISuggestion;
  } catch (error) {
    const err = error as Error;
    console.error('❌ [AI-SUGGESTIONS] Error during generation:', {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5)
    });
    
    if (err.message?.includes('API key')) {
      throw new Error('OpenAI API key is invalid or missing');
    } else if (err.message?.includes('JSON')) {
      throw new Error('Failed to parse AI response - invalid JSON format');
    } else {
      throw new Error(`AI suggestion failed: ${err.message}`);
    }
  }
}