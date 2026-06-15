/**
 * OWNAI Mathematics Problem Solver
 * All algorithms implemented from first principles — no external math libraries.
 */

export class MathSolverError extends Error {
  constructor(message, code = 'MATH_ERROR') {
    super(message);
    this.name = 'MathSolverError';
    this.status = 400;
    this.code = code;
  }
}

const EPSILON = 1e-10;

function nearZero(n) {
  return Math.abs(n) < EPSILON;
}

/**
 * Solve ax² + bx + c = 0 using the quadratic formula.
 * Time complexity: O(1)
 *
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @returns {{ discriminant: number, roots: Array<{real:number, imaginary:number}> }}
 */
export function solveQuadratic(a, b, c) {
  if (typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number') {
    throw new MathSolverError('Coefficients a, b, and c must be numbers', 'INVALID_INPUT');
  }
  if (nearZero(a)) {
    throw new MathSolverError(
      'Coefficient a cannot be zero — not a quadratic equation. Use a linear solver instead.',
      'NOT_QUADRATIC',
    );
  }

  const discriminant = b * b - 4 * a * c;

  if (discriminant > EPSILON) {
    const sqrtD = Math.sqrt(discriminant);
    return {
      discriminant,
      nature: 'two_distinct_real',
      roots: [
        { real: (-b + sqrtD) / (2 * a), imaginary: 0 },
        { real: (-b - sqrtD) / (2 * a), imaginary: 0 },
      ],
    };
  }

  if (nearZero(discriminant)) {
    return {
      discriminant,
      nature: 'one_repeated_real',
      roots: [{ real: -b / (2 * a), imaginary: 0 }],
    };
  }

  const realPart = -b / (2 * a);
  const imagPart = Math.sqrt(-discriminant) / (2 * a);
  return {
    discriminant,
    nature: 'two_complex_conjugate',
    roots: [
      { real: realPart, imaginary: imagPart },
      { real: realPart, imaginary: -imagPart },
    ],
  };
}

/**
 * Solve 2×2 linear system via Cramer's Rule (determinant method).
 * Time complexity: O(1)
 *
 * @param {number} a1
 * @param {number} b1
 * @param {number} c1
 * @param {number} a2
 * @param {number} b2
 * @param {number} c2
 */
export function solveLinearSystem2x2(a1, b1, c1, a2, b2, c2) {
  const coeffs = [a1, b1, c1, a2, b2, c2];
  if (coeffs.some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    throw new MathSolverError('All six coefficients must be valid numbers', 'INVALID_INPUT');
  }

  const det = a1 * b2 - a2 * b1;
  const detX = c1 * b2 - c2 * b1;
  const detY = a1 * c2 - a2 * c1;

  if (nearZero(det)) {
    if (nearZero(detX) && nearZero(detY)) {
      return {
        type: 'infinite_solutions',
        message: 'Lines are coincident — infinitely many solutions.',
        determinant: det,
      };
    }
    return {
      type: 'no_solution',
      message: 'Lines are parallel — no solution exists.',
      determinant: det,
    };
  }

  return {
    type: 'unique_solution',
    determinant: det,
    solution: { x: detX / det, y: detY / det },
    method: 'cramers_rule',
  };
}

// ─── Expression parser & symbolic differentiation ───────────────────────────

function preprocessExpression(expr) {
  return expr
    .replace(/\s+/g, '')
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/(\))([a-zA-Z(])/g, '$1*$2')
    .replace(/(\d)\(/g, '$1*(')
    .replace(/x\^/g, 'x^')
    .toLowerCase();
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if ('+-*/^(),'.includes(ch)) {
      tokens.push({ type: ch });
      i += 1;
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
        num += expr[i];
        i += 1;
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }

    if (/[a-z]/.test(ch)) {
      let word = '';
      while (i < expr.length && /[a-z]/.test(expr[i])) {
        word += expr[i];
        i += 1;
      }
      if (word === 'x') {
        tokens.push({ type: 'var', name: 'x' });
      } else if (['sin', 'cos', 'ln', 'exp'].includes(word)) {
        tokens.push({ type: 'func', name: word });
      } else {
        throw new MathSolverError(`Unknown identifier: ${word}`, 'PARSE_ERROR');
      }
      continue;
    }

    throw new MathSolverError(`Unexpected character '${ch}' in expression`, 'PARSE_ERROR');
  }

  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(expected) {
    const tok = this.tokens[this.pos];
    if (!tok) throw new MathSolverError('Unexpected end of expression', 'PARSE_ERROR');
    if (expected && tok.type !== expected) {
      throw new MathSolverError(`Expected '${expected}' but found '${tok.type}'`, 'PARSE_ERROR');
    }
    this.pos += 1;
    return tok;
  }

  parse() {
    const node = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new MathSolverError('Unexpected tokens after expression end', 'PARSE_ERROR');
    }
    return node;
  }

  parseExpression() {
    let node = this.parseTerm();
    while (this.peek()?.type === '+' || this.peek()?.type === '-') {
      const op = this.consume().type;
      const right = this.parseTerm();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  parseTerm() {
    let node = this.parsePower();
    while (this.peek()?.type === '*' || this.peek()?.type === '/') {
      const op = this.consume().type;
      const right = this.parsePower();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  parsePower() {
    let node = this.parseUnary();
    if (this.peek()?.type === '^') {
      this.consume('^');
      const right = this.parseUnary();
      node = { type: 'binary', op: '^', left: node, right };
    }
    return node;
  }

  parseUnary() {
    if (this.peek()?.type === '-') {
      this.consume('-');
      return { type: 'unary', op: '-', arg: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const tok = this.peek();
    if (!tok) throw new MathSolverError('Unexpected end of expression', 'PARSE_ERROR');

    if (tok.type === 'num') {
      this.consume();
      return { type: 'const', value: tok.value };
    }
    if (tok.type === 'var') {
      this.consume();
      return { type: 'var', name: tok.name };
    }
    if (tok.type === 'func') {
      const name = this.consume().name;
      this.consume('(');
      const arg = this.parseExpression();
      this.consume(')');
      return { type: 'call', name, arg };
    }
    if (tok.type === '(') {
      this.consume('(');
      const node = this.parseExpression();
      this.consume(')');
      return node;
    }

    throw new MathSolverError(`Unexpected token '${tok.type}'`, 'PARSE_ERROR');
  }
}

function parseExpression(expr) {
  if (!expr || typeof expr !== 'string') {
    throw new MathSolverError('Expression must be a non-empty string', 'INVALID_INPUT');
  }
  const cleaned = preprocessExpression(expr);
  if (!cleaned) throw new MathSolverError('Expression cannot be empty', 'INVALID_INPUT');
  const tokens = tokenize(cleaned);
  return new Parser(tokens).parse();
}

function astToString(node) {
  switch (node.type) {
    case 'const':
      return nearZero(node.value) ? '0' : String(node.value);
    case 'var':
      return node.name;
    case 'unary':
      return `(${node.op}${astToString(node.arg)})`;
    case 'binary': {
      const l = astToString(node.left);
      const r = astToString(node.right);
      if (node.op === '^') return `(${l}^${r})`;
      return `(${l}${node.op}${r})`;
    }
    case 'call':
      return `${node.name}(${astToString(node.arg)})`;
    default:
      return '?';
  }
}

function simplify(node) {
  if (node.type === 'binary') {
    node.left = simplify(node.left);
    node.right = simplify(node.right);

    if (node.op === '^' && node.right.type === 'const' && nearZero(node.right.value - 1)) {
      return node.left;
    }

    if (node.op !== '^' && node.left.type === 'const' && node.right.type === 'const') {
      const ops = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b };
      if (node.op === '/' && nearZero(node.right.value)) {
        throw new MathSolverError('Division by zero in expression', 'EVAL_ERROR');
      }
      return { type: 'const', value: ops[node.op](node.left.value, node.right.value) };
    }

    if (node.op === '*') {
      if (node.left.type === 'const' && node.right.type === 'const') {
        return { type: 'const', value: node.left.value * node.right.value };
      }
      if (node.left.type === 'const' && nearZero(node.left.value)) return { type: 'const', value: 0 };
      if (node.right.type === 'const' && nearZero(node.right.value)) return { type: 'const', value: 0 };
      if (node.left.type === 'const' && nearZero(node.left.value - 1)) return node.right;
      if (node.right.type === 'const' && nearZero(node.right.value - 1)) return node.left;
      if (node.left.type === 'const' && node.right.type === 'binary' && node.right.op === '*') {
        if (node.right.left.type === 'const') {
          return simplify({
            type: 'binary',
            op: '*',
            left: { type: 'const', value: node.left.value * node.right.left.value },
            right: node.right.right,
          });
        }
      }
    }

    if (node.op === '+' && node.left.type === 'const' && nearZero(node.left.value)) return node.right;
    if (node.op === '+' && node.right.type === 'const' && nearZero(node.right.value)) return node.left;
    if (node.op === '-' && node.right.type === 'const' && nearZero(node.right.value)) return node.left;
    if (node.op === '-' && node.left.type === 'const' && nearZero(node.left.value)) {
      return { type: 'unary', op: '-', arg: node.right };
    }
  }

  if (node.type === 'unary') {
    node.arg = simplify(node.arg);
    if (node.op === '-' && node.arg.type === 'const') {
      return { type: 'const', value: -node.arg.value };
    }
  }

  return node;
}

/**
 * Symbolic differentiation of expression AST with respect to x.
 * Time complexity: O(n) where n = AST node count
 */
function differentiateAst(node) {
  switch (node.type) {
    case 'const':
      return { type: 'const', value: 0 };
    case 'var':
      return node.name === 'x' ? { type: 'const', value: 1 } : { type: 'const', value: 0 };
    case 'unary':
      if (node.op === '-') return { type: 'unary', op: '-', arg: differentiateAst(node.arg) };
      throw new MathSolverError(`Unsupported unary operator: ${node.op}`, 'DIFF_ERROR');
    case 'binary': {
      const u = node.left;
      const v = node.right;
      const du = differentiateAst(u);
      const dv = differentiateAst(v);

      if (node.op === '+') return simplify({ type: 'binary', op: '+', left: du, right: dv });
      if (node.op === '-') return simplify({ type: 'binary', op: '-', left: du, right: dv });
      if (node.op === '*') {
        return simplify({
          type: 'binary',
          op: '+',
          left: { type: 'binary', op: '*', left: du, right: v },
          right: { type: 'binary', op: '*', left: u, right: dv },
        });
      }
      if (node.op === '/') {
        return simplify({
          type: 'binary',
          op: '/',
          left: {
            type: 'binary',
            op: '-',
            left: { type: 'binary', op: '*', left: du, right: v },
            right: { type: 'binary', op: '*', left: u, right: dv },
          },
          right: { type: 'binary', op: '^', left: v, right: { type: 'const', value: 2 } },
        });
      }
      if (node.op === '^') {
        if (u.type === 'var' && u.name === 'x' && v.type === 'const') {
          const n = v.value;
          if (nearZero(n)) return { type: 'const', value: 0 };
          if (nearZero(n - 1)) return { type: 'const', value: 1 };
          return simplify({
            type: 'binary',
            op: '*',
            left: { type: 'const', value: n },
            right: { type: 'binary', op: '^', left: u, right: { type: 'const', value: n - 1 } },
          });
        }
        throw new MathSolverError('General power rule (f^g) not supported — use x^n form', 'DIFF_ERROR');
      }
      throw new MathSolverError(`Unsupported binary operator: ${node.op}`, 'DIFF_ERROR');
    }
    case 'call': {
      const inner = node.arg;
      const dInner = differentiateAst(inner);
      if (node.name === 'sin') {
        return simplify({
          type: 'binary',
          op: '*',
          left: dInner,
          right: { type: 'call', name: 'cos', arg: inner },
        });
      }
      if (node.name === 'cos') {
        return simplify({
          type: 'unary',
          op: '-',
          arg: {
            type: 'binary',
            op: '*',
            left: dInner,
            right: { type: 'call', name: 'sin', arg: inner },
          },
        });
      }
      if (node.name === 'exp') {
        return simplify({
          type: 'binary',
          op: '*',
          left: dInner,
          right: { type: 'call', name: 'exp', arg: inner },
        });
      }
      if (node.name === 'ln') {
        return simplify({
          type: 'binary',
          op: '/',
          left: dInner,
          right: inner,
        });
      }
      throw new MathSolverError(`Unsupported function: ${node.name}`, 'DIFF_ERROR');
    }
    default:
      throw new MathSolverError('Unknown AST node type', 'DIFF_ERROR');
  }
}

/**
 * Compute symbolic derivative of expression string.
 * @param {string} expression
 */
export function computeDerivative(expression) {
  const ast = parseExpression(expression);
  const derivative = simplify(differentiateAst(ast));
  return {
    input: expression,
    derivative: astToString(derivative),
    rules_applied: ['power_rule', 'sum_rule', 'product_rule', 'chain_rule'],
  };
}

/**
 * Evaluate AST at x value.
 * Time complexity: O(n)
 */
function evaluateAst(node, x) {
  switch (node.type) {
    case 'const':
      return node.value;
    case 'var':
      return x;
    case 'unary':
      return node.op === '-' ? -evaluateAst(node.arg, x) : evaluateAst(node.arg, x);
    case 'binary': {
      const a = evaluateAst(node.left, x);
      const b = evaluateAst(node.right, x);
      if (node.op === '+') return a + b;
      if (node.op === '-') return a - b;
      if (node.op === '*') return a * b;
      if (node.op === '/') {
        if (nearZero(b)) throw new MathSolverError('Division by zero during evaluation', 'EVAL_ERROR');
        return a / b;
      }
      if (node.op === '^') return a ** b;
      break;
    }
    case 'call': {
      const arg = evaluateAst(node.arg, x);
      if (node.name === 'sin') return Math.sin(arg);
      if (node.name === 'cos') return Math.cos(arg);
      if (node.name === 'ln') {
        if (arg <= 0) throw new MathSolverError('ln(x) undefined for non-positive x', 'EVAL_ERROR');
        return Math.log(arg);
      }
      if (node.name === 'exp') return Math.exp(arg);
      break;
    }
    default:
      break;
  }
  throw new MathSolverError('Cannot evaluate expression', 'EVAL_ERROR');
}

/**
 * Definite integral via Simpson's Rule.
 * Time complexity: O(n) where n = number of subintervals
 *
 * @param {string} expression
 * @param {number} a - lower bound
 * @param {number} b - upper bound
 * @param {number} n - even number of subintervals
 */
export function integrateSimpson(expression, a, b, n) {
  if (typeof a !== 'number' || typeof b !== 'number' || typeof n !== 'number') {
    throw new MathSolverError('Bounds a, b and subintervals n must be numbers', 'INVALID_INPUT');
  }
  if (a >= b) throw new MathSolverError('Lower bound a must be less than upper bound b', 'INVALID_INPUT');
  if (!Number.isInteger(n) || n < 2 || n % 2 !== 0) {
    throw new MathSolverError('Subintervals n must be an even integer >= 2', 'INVALID_INPUT');
  }

  const ast = parseExpression(expression);
  const h = (b - a) / n;
  let sum = evaluateAst(ast, a) + evaluateAst(ast, b);

  for (let i = 1; i < n; i += 1) {
    const x = a + i * h;
    const fx = evaluateAst(ast, x);
    sum += fx * (i % 2 === 0 ? 2 : 4);
  }

  const integral = (h / 3) * sum;
  return {
    method: 'simpsons_rule',
    expression,
    bounds: { a, b },
    subintervals: n,
    approximate_value: integral,
  };
}

// ─── Statistics ─────────────────────────────────────────────────────────────

function sortedCopy(data) {
  return [...data].sort((x, y) => x - y);
}

/**
 * Descriptive statistics + optional linear regression.
 * Time complexity: O(n log n) for sort, O(n) for regression
 *
 * @param {number[]} data
 * @param {number[]} [x] - optional x values for regression
 * @param {number[]} [y] - optional y values for regression
 */
export function computeStatistics(data, x = null, y = null) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new MathSolverError('data must be a non-empty array of numbers', 'INVALID_INPUT');
  }
  if (data.some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    throw new MathSolverError('All data values must be valid numbers', 'INVALID_INPUT');
  }

  const n = data.length;
  const mean = data.reduce((s, v) => s + v, 0) / n;

  const sorted = sortedCopy(data);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const freq = new Map();
  for (const v of data) freq.set(v, (freq.get(v) || 0) + 1);
  const maxFreq = Math.max(...freq.values());
  const mode = [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v);

  const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const standardDeviation = Math.sqrt(variance);

  const result = {
    count: n,
    mean,
    median,
    mode,
    variance,
    standard_deviation: standardDeviation,
  };

  if (x !== null && y !== null) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 2) {
      throw new MathSolverError('x and y must be arrays of equal length (>= 2) for regression', 'INVALID_INPUT');
    }
    if (x.some((v) => typeof v !== 'number') || y.some((v) => typeof v !== 'number')) {
      throw new MathSolverError('Regression x and y must contain numbers', 'INVALID_INPUT');
    }

    const m = x.length;
    const sumX = x.reduce((s, v) => s + v, 0);
    const sumY = y.reduce((s, v) => s + v, 0);
    const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
    const sumX2 = x.reduce((s, v) => s + v * v, 0);

    const denom = m * sumX2 - sumX * sumX;
    if (nearZero(denom)) {
      throw new MathSolverError('Cannot compute regression — x values are collinear', 'REGRESSION_ERROR');
    }

    const slope = (m * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / m;

    result.linear_regression = {
      method: 'least_squares',
      slope,
      intercept,
      equation: `y = ${slope}x + ${intercept}`,
    };
  }

  return result;
}

// ─── Root finding (Newton-Raphson & Secant) ─────────────────────────────────

/**
 * Build numeric evaluators for f(x) and optionally f'(x) from expression strings.
 * @param {string} expression
 * @param {string|null} [derivativeExpression]
 * @returns {{ f: (x:number)=>number, df: ((x:number)=>number)|null, derivative_available: boolean }}
 */
function buildFunctionEvaluators(expression, derivativeExpression = null) {
  const fAst = parseExpression(expression);
  const f = (x) => {
    const value = evaluateAst(fAst, x);
    if (!Number.isFinite(value)) {
      throw new MathSolverError(
        `Function evaluation produced a non-finite value at x=${x}`,
        'EVAL_ERROR',
      );
    }
    return value;
  };

  if (derivativeExpression) {
    const dAst = parseExpression(derivativeExpression);
    const df = (x) => {
      const value = evaluateAst(dAst, x);
      if (!Number.isFinite(value)) {
        throw new MathSolverError(
          `Derivative evaluation produced a non-finite value at x=${x}`,
          'EVAL_ERROR',
        );
      }
      return value;
    };
    return { f, df, derivative_available: true };
  }

  try {
    const dAst = simplify(differentiateAst(fAst));
    const df = (x) => {
      const value = evaluateAst(dAst, x);
      if (!Number.isFinite(value)) {
        throw new MathSolverError(
          `Derivative evaluation produced a non-finite value at x=${x}`,
          'EVAL_ERROR',
        );
      }
      return value;
    };
    return { f, df, derivative_available: true };
  } catch {
    return { f, df: null, derivative_available: false };
  }
}

/**
 * Secant method step: x₁ - f(x₁)(x₁ - x₀) / (f(x₁) - f(x₀))
 * @param {number} x0
 * @param {number} x1
 * @param {(x:number)=>number} f
 * @returns {number}
 */
function secantStep(x0, x1, f) {
  const f0 = f(x0);
  const f1 = f(x1);
  const denom = f1 - f0;

  if (nearZero(denom)) {
    throw new MathSolverError(
      'Secant method stalled: f(x₀) and f(x₁) are equal — cannot continue (division by zero)',
      'DIVISION_BY_ZERO',
    );
  }

  const xNext = x1 - (f1 * (x1 - x0)) / denom;
  if (!Number.isFinite(xNext)) {
    throw new MathSolverError(
      'Secant iteration produced a non-finite value — try a different initial guess',
      'NON_FINITE',
    );
  }
  return xNext;
}

/**
 * Run secant method from two starting points until convergence or iteration limit.
 * Time complexity: O(k·n) where k = iterations, n = AST evaluation cost
 *
 * @param {(x:number)=>number} f
 * @param {number} x0
 * @param {number} x1
 * @param {number} tolerance
 * @param {number} maxIterations
 * @param {number} [iterationsUsed=0]
 */
function runSecantMethod(f, x0, x1, tolerance, maxIterations, iterationsUsed = 0) {
  let prev = x0;
  let curr = x1;
  let iterations = iterationsUsed;

  if (Math.abs(f(curr)) < tolerance) {
    return {
      root: curr,
      iterations,
      converged: true,
      method: 'secant',
      status: 'converged',
      function_value_at_root: f(curr),
      message: 'Root found via secant method.',
    };
  }

  while (iterations < maxIterations) {
    const next = secantStep(prev, curr, f);
    const fNext = f(next);

    if (Math.abs(fNext) < tolerance || Math.abs(next - curr) < tolerance) {
      return {
        root: next,
        iterations: iterations + 1,
        converged: true,
        method: 'secant',
        status: 'converged',
        function_value_at_root: fNext,
        message: 'Root found via secant method.',
      };
    }

    prev = curr;
    curr = next;
    iterations += 1;
  }

  return {
    root: curr,
    iterations,
    converged: false,
    method: 'secant',
    status: 'non_converged',
    function_value_at_root: f(curr),
    message: `Secant method did not converge within ${maxIterations} iterations.`,
  };
}

/**
 * Find a root of f(x) = 0 using Newton-Raphson with secant-method fallback.
 *
 * Newton-Raphson: xₙ₊₁ = xₙ − f(xₙ) / f'(xₙ)
 * Secant (fallback): xₙ₊₁ = xₙ − f(xₙ)(xₙ − xₙ₋₁) / (f(xₙ) − f(xₙ₋₁))
 *
 * Falls back to the secant method when:
 * - Symbolic derivative is unavailable and no `derivative` option is given
 * - f'(x) is zero at the current iterate (division-by-zero guard)
 * - Derivative evaluation fails at the current iterate
 *
 * Time complexity: O(k·n) per iteration where k = maxIterations, n = AST size
 *
 * @param {string} expression - f(x) as a string, e.g. `"x^2 - 4"`
 * @param {number} initialGuess - Starting x₀
 * @param {number} [tolerance=1e-6] - Convergence tolerance ε
 * @param {number} [maxIterations=100] - Maximum iterations
 * @param {object} [options]
 * @param {string} [options.derivative] - Optional f'(x) expression string
 * @param {number} [options.secondGuess] - Second starting point for secant fallback
 * @returns {{
 *   root: number,
 *   iterations: number,
 *   converged: boolean,
 *   method: 'newton_raphson'|'secant',
 *   status: 'converged'|'non_converged'|'fallback_to_secant',
 *   function_value_at_root: number,
 *   message: string,
 *   expression: string,
 *   initial_guess: number,
 *   tolerance: number,
 * }}
 *
 * @example
 * // f(x) = x² − 4 has root at x = 2
 * solveNewtonRaphson('x^2 - 4', 3, 0.0001, 100);
 * // → { root: 2, converged: true, method: 'newton_raphson', ... }
 *
 * @example
 * // f(x) = cos(x) − x has root ≈ 0.7390851332
 * solveNewtonRaphson('cos(x) - x', 0.5, 0.0001, 100);
 * // → { root: ~0.739, converged: true, ... }
 */
export function solveNewtonRaphson(
  expression,
  initialGuess,
  tolerance = 1e-6,
  maxIterations = 100,
  options = {},
) {
  if (!expression || typeof expression !== 'string') {
    throw new MathSolverError('function expression must be a non-empty string', 'INVALID_INPUT');
  }
  if (typeof initialGuess !== 'number' || Number.isNaN(initialGuess)) {
    throw new MathSolverError('initialGuess must be a valid number', 'INVALID_INPUT');
  }
  if (typeof tolerance !== 'number' || tolerance <= 0 || Number.isNaN(tolerance)) {
    throw new MathSolverError('tolerance ε must be a positive number', 'INVALID_INPUT');
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new MathSolverError('maxIterations must be a positive integer', 'INVALID_INPUT');
  }

  const { derivative: derivativeExpression, secondGuess } = options;
  const { f, df, derivative_available } = buildFunctionEvaluators(expression, derivativeExpression ?? null);

  const secantSecondGuess = typeof secondGuess === 'number' && !Number.isNaN(secondGuess)
    ? secondGuess
    : initialGuess + (nearZero(initialGuess) ? 0.1 : initialGuess * 0.01);

  if (!derivative_available || !df) {
    const secantResult = runSecantMethod(f, initialGuess, secantSecondGuess, tolerance, maxIterations);
    return {
      expression,
      initial_guess: initialGuess,
      tolerance,
      ...secantResult,
      message: 'Symbolic derivative unavailable — used secant method.',
    };
  }

  let x = initialGuess;
  let iterations = 0;
  let usedSecantFallback = false;

  const fx0 = f(x);
  if (Math.abs(fx0) < tolerance) {
    return {
      expression,
      initial_guess: initialGuess,
      tolerance,
      root: x,
      iterations: 0,
      converged: true,
      method: 'newton_raphson',
      status: 'converged',
      function_value_at_root: fx0,
      message: 'Initial guess is already a root.',
    };
  }

  while (iterations < maxIterations) {
    const fx = f(x);
    if (Math.abs(fx) < tolerance) {
      return {
        expression,
        initial_guess: initialGuess,
        tolerance,
        root: x,
        iterations,
        converged: true,
        method: usedSecantFallback ? 'secant' : 'newton_raphson',
        status: usedSecantFallback ? 'fallback_to_secant' : 'converged',
        function_value_at_root: fx,
        message: usedSecantFallback
          ? 'Root found after switching to secant method (derivative was zero).'
          : 'Root found via Newton-Raphson method.',
      };
    }

    let dfx;
    try {
      dfx = df(x);
    } catch (error) {
      const secantResult = runSecantMethod(
        f,
        initialGuess,
        secantSecondGuess,
        tolerance,
        maxIterations - iterations,
        iterations,
      );
      return {
        expression,
        initial_guess: initialGuess,
        tolerance,
        ...secantResult,
        status: 'fallback_to_secant',
        message: `Derivative evaluation failed (${error.message}) — used secant method.`,
      };
    }

    if (nearZero(dfx)) {
      const secantResult = runSecantMethod(
        f,
        x,
        secantSecondGuess,
        tolerance,
        maxIterations - iterations,
        iterations,
      );
      return {
        expression,
        initial_guess: initialGuess,
        tolerance,
        ...secantResult,
        status: 'fallback_to_secant',
        message: 'Newton-Raphson stalled (f\'(x) ≈ 0) — switched to secant method.',
      };
    }

    const xNext = x - fx / dfx;
    if (!Number.isFinite(xNext)) {
      throw new MathSolverError(
        'Newton-Raphson produced a non-finite value — adjust the initial guess',
        'NON_FINITE',
      );
    }

    if (Math.abs(xNext - x) < tolerance && Math.abs(f(xNext)) < tolerance) {
      return {
        expression,
        initial_guess: initialGuess,
        tolerance,
        root: xNext,
        iterations: iterations + 1,
        converged: true,
        method: 'newton_raphson',
        status: 'converged',
        function_value_at_root: f(xNext),
        message: 'Root found via Newton-Raphson method.',
      };
    }

    x = xNext;
    iterations += 1;
  }

  return {
    expression,
    initial_guess: initialGuess,
    tolerance,
    root: x,
    iterations,
    converged: false,
    method: 'newton_raphson',
    status: 'non_converged',
    function_value_at_root: f(x),
    message: `Newton-Raphson did not converge within ${maxIterations} iterations.`,
  };
}
