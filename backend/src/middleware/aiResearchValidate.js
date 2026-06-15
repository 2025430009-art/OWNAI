import { z } from 'zod';

const algorithmField = z.string().min(1, 'algorithm is required');

const baseSchema = z.object({
  algorithm: algorithmField,
  expression: z.string().max(500).optional(),
  bounds: z.array(z.array(z.number()).length(2)).optional(),
  initial: z.array(z.number()).optional(),
  distances: z.array(z.array(z.number())).optional(),
  data: z.array(z.any()).optional(),
  labels: z.array(z.any()).optional(),
  test: z.array(z.any()).optional(),
  x: z.array(z.number()).optional(),
  y: z.array(z.number()).optional(),
  series: z.array(z.number()).optional(),
  options: z.record(z.any()).optional().default({}),
});

export const optimizeSchema = baseSchema;
export const classifySchema = baseSchema;
export const clusterSchema = baseSchema;
export const predictSchema = baseSchema;
export const reduceDimensionsSchema = baseSchema;
export const searchSchema = baseSchema;
export const nlpSchema = baseSchema;
export const graphSchema = baseSchema;
export const reinforceSchema = baseSchema;
export const statisticsSchema = baseSchema;
export const signalSchema = baseSchema;
export const combinatorialSchema = baseSchema;

export const autoSuggestSchema = z.object({
  problemType: z.string().min(1, 'problemType is required'),
  dataSize: z.number().int().positive().optional().default(100),
  dimensions: z.number().int().positive().optional().default(2),
  labeled: z.boolean().optional().default(false),
  text: z.boolean().optional().default(false),
  graph: z.boolean().optional().default(false),
});

export const listAlgorithmsSchema = z.object({}).optional();
