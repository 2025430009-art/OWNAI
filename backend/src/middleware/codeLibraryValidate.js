import { z } from 'zod';

const complexitySchema = z.object({
  time: z.string().max(100).optional().default(''),
  space: z.string().max(100).optional().default(''),
}).optional();

export const createCodeEntrySchema = z.object({
  title: z.string().min(1, 'title is required').max(500),
  description: z.string().max(5000).optional().default(''),
  code: z.string().min(1, 'code is required').max(200000),
  language: z.string().min(1, 'language is required').max(50),
  category: z.string().max(100).optional().default(''),
  tags: z.array(z.string().max(50)).optional().default([]),
  complexity: complexitySchema,
  source: z.string().max(50).optional().default('OWN AI'),
});

export const updateCodeEntrySchema = createCodeEntrySchema.partial();
