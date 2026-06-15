/**
 * Safe numeric expression parser/evaluator for optimization objectives.
 * No eval/Function — whitelist tokenizer + AST evaluation only.
 */

const MAX_LENGTH = 500;
const VAR_NAME = /^x(\d+)?$/;
const ALLOWED_CHARS = /^[0-9xsin()coslnexp+\-*/^.\s]+$/i;

export class SafeExpressionError extends Error {
  constructor(message, code = 'EVAL_ERROR') {
    super(message);
    this.name = 'SafeExpressionError';
    this.status = 400;
    this.code = code;
  }
}

function preprocess(expr) {
  return expr
    .replace(/\s+/g, '')
    .replace(/(\d)([a-z(])/gi, '$1*$2')
    .replace(/(\))([a-z(])/gi, '$1*$2')
    .replace(/(\d)\(/g, '$1*(')
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
      while (i < expr.length && /[a-z0-9]/.test(expr[i])) {
        word += expr[i];
        i += 1;
      }
      if (VAR_NAME.test(word)) {
        tokens.push({ type: 'var', name: word });
      } else if (['sin', 'cos', 'ln', 'exp'].includes(word)) {
        tokens.push({ type: 'func', name: word });
      } else {
        throw new SafeExpressionError(`Unknown identifier: ${word}`, 'PARSE_ERROR');
      }
      continue;
    }

    throw new SafeExpressionError(`Unexpected character '${ch}'`, 'PARSE_ERROR');
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
    if (!tok) throw new SafeExpressionError('Unexpected end of expression', 'PARSE_ERROR');
    if (expected && tok.type !== expected) {
      throw new SafeExpressionError(`Expected '${expected}' but found '${tok.type}'`, 'PARSE_ERROR');
    }
    this.pos += 1;
    return tok;
  }

  parse() {
    const node = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new SafeExpressionError('Unexpected tokens after expression end', 'PARSE_ERROR');
    }
    return node;
  }

  parseExpression() {
    let node = this.parseTerm();
    while (this.peek()?.type === '+' || this.peek()?.type === '-') {
      const op = this.consume().type;
      node = { type: 'binary', op, left: node, right: this.parseTerm() };
    }
    return node;
  }

  parseTerm() {
    let node = this.parsePower();
    while (this.peek()?.type === '*' || this.peek()?.type === '/') {
      const op = this.consume().type;
      node = { type: 'binary', op, left: node, right: this.parsePower() };
    }
    return node;
  }

  parsePower() {
    let node = this.parseUnary();
    if (this.peek()?.type === '^') {
      this.consume('^');
      node = { type: 'binary', op: '^', left: node, right: this.parseUnary() };
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
    if (!tok) throw new SafeExpressionError('Unexpected end of expression', 'PARSE_ERROR');

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

    throw new SafeExpressionError(`Unexpected token '${tok.type}'`, 'PARSE_ERROR');
  }
}

function parseSafeExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    throw new SafeExpressionError('Expression must be a non-empty string', 'INVALID_INPUT');
  }
  if (expression.length > MAX_LENGTH) {
    throw new SafeExpressionError(`Expression exceeds max length of ${MAX_LENGTH}`, 'INVALID_INPUT');
  }
  if (!ALLOWED_CHARS.test(expression)) {
    throw new SafeExpressionError('Expression contains disallowed characters', 'INVALID_INPUT');
  }

  const cleaned = preprocess(expression);
  if (!cleaned) throw new SafeExpressionError('Expression cannot be empty', 'INVALID_INPUT');

  return new Parser(tokenize(cleaned)).parse();
}

function resolveVar(name, point) {
  if (name === 'x') return point[0];
  const match = name.match(/^x(\d+)$/);
  if (match) {
    const index = parseInt(match[1], 10);
    if (index >= point.length) {
      throw new SafeExpressionError(`Variable ${name} is out of range for ${point.length} dimension(s)`, 'EVAL_ERROR');
    }
    return point[index];
  }
  throw new SafeExpressionError(`Unknown variable: ${name}`, 'EVAL_ERROR');
}

function evaluateAst(node, point) {
  switch (node.type) {
    case 'const':
      return node.value;
    case 'var':
      return resolveVar(node.name, point);
    case 'unary':
      return node.op === '-' ? -evaluateAst(node.arg, point) : evaluateAst(node.arg, point);
    case 'binary': {
      const a = evaluateAst(node.left, point);
      const b = evaluateAst(node.right, point);
      if (node.op === '+') return a + b;
      if (node.op === '-') return a - b;
      if (node.op === '*') return a * b;
      if (node.op === '/') {
        if (Math.abs(b) < 1e-12) throw new SafeExpressionError('Division by zero', 'EVAL_ERROR');
        return a / b;
      }
      if (node.op === '^') return a ** b;
      break;
    }
    case 'call': {
      const arg = evaluateAst(node.arg, point);
      if (node.name === 'sin') return Math.sin(arg);
      if (node.name === 'cos') return Math.cos(arg);
      if (node.name === 'ln') {
        if (arg <= 0) throw new SafeExpressionError('ln(x) undefined for non-positive x', 'EVAL_ERROR');
        return Math.log(arg);
      }
      if (node.name === 'exp') return Math.exp(arg);
      break;
    }
    default:
      break;
  }
  throw new SafeExpressionError('Cannot evaluate expression', 'EVAL_ERROR');
}

/**
 * Build a safe fitness function from a string expression.
 * Variables: x0, x1, ... or x for single dimension.
 */
export function buildSafeObjective(expression, dimensions = 1) {
  const ast = parseSafeExpression(expression);
  return (point) => {
    try {
      const val = evaluateAst(ast, point);
      if (!Number.isFinite(val)) {
        throw new SafeExpressionError('Objective returned non-finite value', 'EVAL_ERROR');
      }
      return val;
    } catch (error) {
      if (error instanceof SafeExpressionError) throw error;
      throw new SafeExpressionError(`Invalid objective expression: ${error.message}`, 'EVAL_ERROR');
    }
  };
}
