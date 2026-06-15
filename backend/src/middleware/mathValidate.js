import { z } from 'zod';

export const quadraticSchema = z.object({
  a: z.number({ invalid_type_error: 'a must be a number' }),
  b: z.number({ invalid_type_error: 'b must be a number' }),
  c: z.number({ invalid_type_error: 'c must be a number' }),
});

export const linearSystemSchema = z.object({
  a1: z.number(),
  b1: z.number(),
  c1: z.number(),
  a2: z.number(),
  b2: z.number(),
  c2: z.number(),
});

export const derivativeSchema = z.object({
  expression: z.string().min(1, 'expression is required').max(500),
});

export const integralSchema = z.object({
  expression: z.string().min(1, 'expression is required').max(500),
  a: z.number(),
  b: z.number(),
  n: z.number().int().min(2).refine((v) => v % 2 === 0, 'n must be an even integer'),
});

export const statisticsSchema = z.object({
  data: z.array(z.number()).min(1, 'data must contain at least one value'),
  x: z.array(z.number()).optional(),
  y: z.array(z.number()).optional(),
}).refine(
  (val) => {
    if ((val.x && !val.y) || (!val.x && val.y)) return false;
    if (val.x && val.y && val.x.length !== val.y.length) return false;
    return true;
  },
  { message: 'x and y must both be provided with equal length for regression' },
);

export const newtonRaphsonSchema = z.object({
  function: z.string().min(1, 'function is required').max(500),
  derivative: z.string().min(1).max(500).optional(),
  initialGuess: z.number({ invalid_type_error: 'initialGuess must be a number' }),
  secondGuess: z.number().optional(),
  tolerance: z.number().positive('tolerance must be a positive number').optional().default(1e-6),
  maxIterations: z.number().int().min(1).max(10000).optional().default(100),
});
