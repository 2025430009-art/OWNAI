import { z } from 'zod';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(16000),
});

export const generateSchema = z.object({
  prompt: z.string().min(1, 'prompt is required').max(32000),
  messages: z.array(messageSchema).max(20).optional(),
  max_tokens: z.number().int().min(1).max(8192).optional().default(1024),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  model_key: z.string().optional(),
  model_src: z.string().optional(),
  algorithm_id: z.string().optional(),
  stream: z.boolean().optional().default(true),
  use_rag: z.boolean().optional().default(true),
  reasoning_mode: z.enum([
    'auto',
    'direct',
    'chain_of_thought',
    'tree_of_thoughts',
    'react',
    'self_refine',
    'human_think',
    'extended',
    'socratic',
    'debate',
  ]).optional().default('auto'),
  enable_thinking: z.boolean().optional().default(true),
});

const thinkingModeValues = [
  'auto',
  'direct',
  'chain_of_thought',
  'tree_of_thoughts',
  'react',
  'self_refine',
  'human_think',
  'extended',
  'socratic',
  'debate',
];

const thinkContextSchema = z.object({
  score_confidence: z.boolean().optional(),
  working_memory: z.array(messageSchema).max(10).optional(),
}).passthrough().optional().default({});

export const thinkSchema = z.object({
  message: z.string().min(1, 'message is required').max(10000),
  mode: z.enum(thinkingModeValues).optional(),
  session_id: z.string().uuid().optional(),
  context: thinkContextSchema,
  tools: z.array(z.object({
    name: z.string().min(1).max(64),
    description: z.string().min(1).max(500),
  })).max(10).optional().default([]),
  stream: z.boolean().optional().default(true),
  use_extended_thinking: z.boolean().optional().default(false),
});

export const detectModeSchema = z.object({
  message: z.string().min(1, 'message is required').max(10000),
  context: thinkContextSchema,
});

export const compareModesSchema = z.object({
  message: z.string().min(1, 'message is required').max(10000),
  modes: z.array(z.string().min(1)).min(1).max(3),
  session_id: z.string().uuid().optional(),
  context: thinkContextSchema,
  tools: z.array(z.object({
    name: z.string().min(1).max(64),
    description: z.string().min(1).max(500),
  })).max(10).optional().default([]),
});

export const saveMemorySchema = z.object({
  type: z.enum(['fact', 'preference', 'skill', 'project', 'relationship']),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(50)).optional().default([]),
  confidence: z.number().min(0).max(1).optional().default(0.8),
  expires_in_days: z.number().int().positive().optional(),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.validated = result.data;
    next();
  };
}
