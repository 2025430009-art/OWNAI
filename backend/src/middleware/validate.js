import { z } from 'zod';

export const generateSchema = z.object({
  prompt: z.string().min(1, 'prompt is required').max(32000),
  max_tokens: z.number().int().min(1).max(4096).optional().default(100),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  model_key: z.string().optional(),
  model_src: z.string().optional(),
  algorithm_id: z.string().optional(),
  stream: z.boolean().optional().default(false),
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
