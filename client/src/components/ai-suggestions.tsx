import { useState } from "react";
import { Sparkles, Lightbulb, Users, Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EffectBlock, Snapshot } from "@shared/schema";
import { effectsMapping } from "@/lib/effects-mapping";

interface AISuggestion {
  reasoning: string;
  effectChain: Array<{
    position: number;
    effect: string;
    enabled: boolean;
    reasoning: string;
  }>;
  snapshots: Array<{
    name: string;
    description: string;
    effectStates: { [blockIndex: number]: boolean };
  }>;
  tips: string[];
}

interface AISuggestionsProps {
  onApplySuggestion: (effectBlocks: EffectBlock[], snapshots: Snapshot[]) => void;
}

export default function AISuggestions({ onApplySuggestion }: AISuggestionsProps) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("");
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);

  const suggestionMutation = useMutation({
    mutationFn: async (data: { description: string; artist?: string; genre?: string }) => {
      const response = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate suggestions');
      }
      
      return response.json() as Promise<AISuggestion>;
    },
    onSuccess: (data: AISuggestion) => {
      setSuggestion(data);
      toast({
        title: "AI Suggestions Generated",
        description: "Review the suggested effects chain and snapshots below.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Generate Suggestions",
        description: error.message || "Please try again with a different description.",
        variant: "destructive",
      });
    }
  });

  const handleGenerateSuggestions = () => {
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please describe the sound you're trying to achieve.",
        variant: "destructive",
      });
      return;
    }

    suggestionMutation.mutate({
      description: description.trim(),
      artist: artist.trim() || undefined,
      genre: genre.trim() || undefined,
    });
  };

  const handleApplySuggestion = () => {
    if (!suggestion) return;

    // Convert AI suggestions to app format
    const effectBlocks: EffectBlock[] = Array.from({ length: 9 }, (_, i) => ({
      enabled: false,
      effect: '',
      position: i
    }));

    // Apply suggested effects
    suggestion.effectChain.forEach((effectSuggestion) => {
      if (effectSuggestion.position >= 0 && effectSuggestion.position < 9) {
        effectBlocks[effectSuggestion.position] = {
          enabled: effectSuggestion.enabled,
          effect: effectSuggestion.effect,
          position: effectSuggestion.position
        };
      }
    });

    // Convert snapshots
    const snapshots: Snapshot[] = Array.from({ length: 4 }, () => ({
      name: '',
      active: false
    }));

    suggestion.snapshots.slice(0, 4).forEach((snapshotSuggestion, index) => {
      snapshots[index] = {
        name: snapshotSuggestion.name,
        active: true
      };
    });

    onApplySuggestion(effectBlocks, snapshots);
    
    toast({
      title: "Suggestions Applied",
      description: "The AI-suggested effects and snapshots have been applied to your preset.",
    });
  };

  const getEffectName = (internalRef: string) => {
    const effect = effectsMapping.find(e => e.internal === internalRef);
    return effect ? effect.friendly : 'Unknown Effect';
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="bg-studio-800 border-studio-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Sparkles className="text-purple-500 mr-3" />
            AI Effects Suggestions
          </CardTitle>
          <CardDescription className="text-studio-300">
            Describe the sound you want to achieve, and AI will suggest effects chains and snapshots
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-studio-300 mb-2">
              Sound Description *
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the sound you're trying to achieve (e.g., 'warm vintage overdrive for blues solos', 'heavy distortion with ambient reverb for post-rock')"
              className="bg-studio-700 border-studio-600 text-white placeholder-studio-400 focus:border-purple-500 min-h-[80px]"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-studio-300 mb-2">
                Artist/Band (Optional)
              </label>
              <Input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g., David Gilmour, The Edge, Jack White"
                className="bg-studio-700 border-studio-600 text-white placeholder-studio-400 focus:border-purple-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-studio-300 mb-2">
                Genre (Optional)
              </label>
              <Input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g., Blues, Post-Rock, Indie, Metal"
                className="bg-studio-700 border-studio-600 text-white placeholder-studio-400 focus:border-purple-500"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerateSuggestions}
            disabled={suggestionMutation.isPending || !description.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {suggestionMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate AI Suggestions
          </Button>
        </CardContent>
      </Card>

      {/* Suggestions Display */}
      {suggestion && (
        <Card className="bg-studio-800 border-studio-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center">
                <Lightbulb className="text-yellow-500 mr-3" />
                AI Suggestions
              </span>
              <Button
                onClick={handleApplySuggestion}
                className="bg-green-600 hover:bg-green-700"
              >
                Apply to Preset
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reasoning */}
            <div>
              <h4 className="text-white font-medium mb-2">Approach</h4>
              <p className="text-studio-300 text-sm leading-relaxed">{suggestion.reasoning}</p>
            </div>

            <Separator className="bg-studio-600" />

            {/* Effects Chain */}
            <div>
              <h4 className="text-white font-medium mb-3 flex items-center">
                <Music className="text-blue-500 mr-2" />
                Suggested Effects Chain
              </h4>
              <div className="grid gap-3">
                {suggestion.effectChain.map((effect, index) => (
                  <div key={index} className="bg-studio-700 rounded-lg p-3 border border-studio-600">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="text-studio-300 border-studio-500">
                          Block {effect.position}
                        </Badge>
                        <span className="text-white font-medium">
                          {getEffectName(effect.effect)}
                        </span>
                        <Badge 
                          variant={effect.enabled ? "default" : "secondary"}
                          className={effect.enabled ? "bg-green-600" : "bg-studio-600"}
                        >
                          {effect.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-studio-400 text-sm">{effect.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-studio-600" />

            {/* Snapshots */}
            <div>
              <h4 className="text-white font-medium mb-3 flex items-center">
                <Users className="text-orange-500 mr-2" />
                Suggested Snapshots
              </h4>
              <div className="grid gap-3">
                {suggestion.snapshots.map((snapshot, index) => (
                  <div key={index} className="bg-studio-700 rounded-lg p-3 border border-studio-600">
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge variant="outline" className="text-studio-300 border-studio-500">
                        Snapshot {index + 1}
                      </Badge>
                      <span className="text-white font-medium">{snapshot.name}</span>
                    </div>
                    <p className="text-studio-400 text-sm mb-2">{snapshot.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(snapshot.effectStates).map(([blockIndex, enabled]) => (
                        <Badge
                          key={blockIndex}
                          variant="secondary"
                          className={`text-xs ${enabled ? 'bg-green-600 text-white' : 'bg-studio-600 text-studio-300'}`}
                        >
                          Block {blockIndex}: {enabled ? 'On' : 'Off'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            {suggestion.tips && suggestion.tips.length > 0 && (
              <>
                <Separator className="bg-studio-600" />
                <div>
                  <h4 className="text-white font-medium mb-3">Pro Tips</h4>
                  <ul className="space-y-2">
                    {suggestion.tips.map((tip, index) => (
                      <li key={index} className="text-studio-300 text-sm flex items-start">
                        <span className="text-yellow-500 mr-2">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}