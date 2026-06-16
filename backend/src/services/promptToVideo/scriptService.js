import { callAnthropicMessages, isAnthropicAvailable } from '../anthropicService.js';
import { logger } from '../../utils/logger.js';

export function buildScriptPrompt(userPrompt) {
  return `You are a professional video script writer.
Generate a complete 5 minute video script for this topic: ${userPrompt}

Rules:
- Exactly 10 scenes
- Each scene exactly 30 seconds
- Make it visually stunning and engaging
- Professional narrator voice tone

Return ONLY this JSON structure (no markdown, no commentary):
{
  "title": "video title",
  "mood": "epic/calm/dramatic/inspiring",
  "colorPalette": "warm/cool/vibrant/dark",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 30,
      "visualDescription": "detailed visual description for image generation",
      "narratorText": "exact words narrator will speak",
      "cameraAngle": "wide shot/close up/aerial/pan left",
      "mood": "calm/dramatic/exciting",
      "transition": "fade/cut/dissolve"
    }
  ],
  "subtitleStyle": "white/yellow/gradient",
  "musicStyle": "orchestral/ambient/dramatic"
}`;
}

function extractJson(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Script response did not contain JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function buildDemoScript(userPrompt) {
  const topic = userPrompt.slice(0, 80) || 'Your story';
  const moods = ['dramatic', 'calm', 'exciting', 'inspiring'];
  const scenes = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return {
      sceneNumber: n,
      duration: 30,
      visualDescription: `Cinematic wide shot for scene ${n}: ${topic}. Epic lighting, 16:9 film frame, rich detail, atmospheric depth.`,
      narratorText: `Scene ${n}. ${topic}. The journey continues with wonder and purpose, unfolding across land and sky.`,
      cameraAngle: n % 2 === 0 ? 'aerial' : 'wide shot',
      mood: moods[i % moods.length],
      transition: i === 9 ? 'fade' : 'dissolve',
    };
  });

  return {
    title: topic.slice(0, 60),
    mood: 'epic',
    colorPalette: 'warm',
    scenes,
    subtitleStyle: 'white',
    musicStyle: 'orchestral',
    _demo: true,
  };
}

export async function generateScript(userPrompt) {
  if (!isAnthropicAvailable()) {
    logger.info('PromptToVideo: using demo script (Anthropic key not set)');
    return buildDemoScript(userPrompt);
  }

  const { text } = await callAnthropicMessages({
    system: 'You write structured JSON video scripts only. Never wrap JSON in markdown.',
    messages: [{ role: 'user', content: buildScriptPrompt(userPrompt) }],
    maxTokens: 8192,
    temperature: 0.6,
    enableThinking: false,
  });

  const script = extractJson(text);
  if (!Array.isArray(script.scenes) || script.scenes.length !== 10) {
    throw new Error('Script must contain exactly 10 scenes');
  }
  return script;
}
