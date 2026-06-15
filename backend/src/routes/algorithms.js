import { Router } from 'express';
import { listAlgorithms, listAIEngines, applyAlgorithm } from '../services/algorithmService.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    algorithms: listAlgorithms().map((a) => ({
      id: a.id,
      name: a.name,
      tagline: a.tagline,
      description: a.description,
      version: a.version,
      default: a.default,
      temperature: a.temperature,
      intents: a.intents,
    })),
  });
});

router.get('/engines', (_req, res) => {
  res.json({ success: true, engines: listAIEngines() });
});

router.post('/preview', (req, res) => {
  const { prompt, algorithm_id: algorithmId } = req.body || {};
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const result = applyAlgorithm(algorithmId || null, prompt);
  res.json({
    success: true,
    meta: result.meta,
    shaped_prompt: result.prompt,
  });
});

export default router;
