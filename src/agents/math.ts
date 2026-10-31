/**
 * Safe arithmetic evaluator for local agents. state: wired | tested (unit).
 * Supports + - * / % ^, parentheses and unary signs. It deliberately has no
 * identifiers, function calls, property access, assignment or eval(), so a
 * caller cannot reach the JavaScript runtime or environment through input.
 */

export type ArithmeticResult =
  { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string };

type Token =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'op'; readonly value: '+' | '-' | '*' | '/' | '%' | '^' | '(' | ')' };

const MAX_EXPRESSION_CHARS = 120;
const MAX_RESULT = 1e15;

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(expression.slice(index));
      if (!match) return null;
      const raw = match[0];
      if ((raw.match(/\./g) ?? []).length > 1) return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      tokens.push({ kind: 'number', value });
      index += raw.length;
      continue;
    }
    if (
      char === '+' ||
      char === '-' ||
      char === '*' ||
      char === '/' ||
      char === '%' ||
      char === '^' ||
      char === '(' ||
      char === ')'
    ) {
      tokens.push({ kind: 'op', value: char });
      index += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

class ArithmeticParser {
  private position = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): number {
    const value = this.expression();
    if (this.position !== this.tokens.length) throw new Error('EXPRESSION_TRAILING_INPUT');
    return value;
  }

  private expression(): number {
    let value = this.term();
    while (this.match('+') || this.match('-')) {
      const operator = this.previous();
      const right = this.term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.factor();
    while (this.match('*') || this.match('/') || this.match('%')) {
      const operator = this.previous();
      const right = this.factor();
      if ((operator === '/' || operator === '%') && right === 0)
        throw new Error('DIVISION_BY_ZERO');
      if (operator === '*') value *= right;
      else if (operator === '/') value /= right;
      else value %= right;
    }
    return value;
  }

  private factor(): number {
    const sign = this.match('-') ? -1 : this.match('+') ? 1 : 0;
    if (sign !== 0) return sign * this.factor();
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (this.match('^')) {
      const exponent = this.factor();
      return Math.pow(base, exponent);
    }
    return base;
  }

  private primary(): number {
    if (this.match('(')) {
      const value = this.expression();
      if (!this.match(')')) throw new Error('EXPRESSION_UNBALANCED_PARENTHESIS');
      return value;
    }
    const token = this.tokens[this.position];
    if (!token || token.kind !== 'number') throw new Error('EXPRESSION_UNEXPECTED_TOKEN');
    this.position += 1;
    return token.value;
  }

  private match(operator: '+' | '-' | '*' | '/' | '%' | '^' | '(' | ')'): boolean {
    const token = this.tokens[this.position];
    if (token?.kind !== 'op' || token.value !== operator) return false;
    this.position += 1;
    return true;
  }

  private previous(): '+' | '-' | '*' | '/' | '%' | '^' | '(' | ')' {
    const token = this.tokens[this.position - 1];
    return token?.kind === 'op' ? token.value : '+';
  }
}

export function evaluateArithmetic(expression: string): ArithmeticResult {
  const trimmed = expression.trim();
  if (!trimmed) return { ok: false, error: 'EXPRESSION_EMPTY' };
  if (trimmed.length > MAX_EXPRESSION_CHARS) return { ok: false, error: 'EXPRESSION_TOO_LONG' };
  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return { ok: false, error: 'EXPRESSION_INVALID_CHARACTERS' };
  try {
    const raw = new ArithmeticParser(tokens).parse();
    if (!Number.isFinite(raw)) return { ok: false, error: 'EXPRESSION_NOT_FINITE' };
    if (Math.abs(raw) > MAX_RESULT) return { ok: false, error: 'EXPRESSION_RESULT_OUT_OF_RANGE' };
    const rounded = Math.round(raw * 1e12) / 1e12;
    return { ok: true, value: Object.is(rounded, -0) ? 0 : rounded };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'EXPRESSION_INVALID' };
  }
}
