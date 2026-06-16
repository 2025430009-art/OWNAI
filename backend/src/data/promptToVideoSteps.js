/** Text-to-Video — 6-step OWNAI pipeline */
export const VIDEO_GENERATION_STEPS = [
  { id: 1, key: 'script', name: 'Claude AI — Script', icon: '📝', duration: '~15 sec' },
  { id: 2, key: 'images', name: 'Stability AI — Scene Images', icon: '🎨', duration: '~2 min' },
  { id: 3, key: 'voiceover', name: 'ElevenLabs — Voiceover', icon: '🎙️', duration: '~1 min' },
  { id: 4, key: 'combine', name: 'FFmpeg — Combine Video', icon: '⚡', duration: '~2 min' },
  { id: 5, key: 'export', name: 'Export MP4', icon: '🎬', duration: '~30 sec' },
  { id: 6, key: 'deliver', name: 'Deliver to User', icon: '✅', duration: 'instant' },
];

export const EXAMPLE_PROMPTS = [
  'Create a 5 minute video about Hanuman crossing the ocean to Lanka',
  '5 minute documentary about the solar system',
  'Motivational video about success and perseverance',
  'Educational video about ancient Indian mathematics',
];
