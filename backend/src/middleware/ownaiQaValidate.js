import { z } from 'zod';

export const createQaSchema = z.object({
  question: z.string().min(1, 'question is required').max(32000),
  answer: z.string().min(1, 'answer is required').max(100000),
  topic: z.string().max(200).optional().default(''),
  source: z.string().max(50).optional().default('OWN AI'),
});

export const listQaSchema = z.object({
  q: z.string().max(500).optional(),
  topic: z.string().max(200).optional(),
});
