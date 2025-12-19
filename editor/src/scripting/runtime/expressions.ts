// ═══════════════════════════════════════════════════════════════════════════
// Expression Evaluator
// Safe evaluation of expressions like "$expr": "health * 0.5 + armor"
// ═══════════════════════════════════════════════════════════════════════════

import { SeededRandom } from './lifecycle'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ExprValue = number | string | boolean | Vec2 | ExprValue[] | Record<string, unknown> | null

export type Vec2 = [number, number]

export interface ExprContext {
  /** Variables available in the expression */
  variables: Record<string, ExprValue>
  /** Optional seeded random for determinism */
  random?: SeededRandom
  /** Optional reference to self node */
  self?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// AST Node Types
// ─────────────────────────────────────────────────────────────────────────────

type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'identifier'; name: string }
  | { type: 'member'; object: ASTNode; property: string | ASTNode; computed: boolean }
  | { type: 'binary'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'unary'; operator: string; operand: ASTNode }
  | { type: 'call'; callee: string; args: ASTNode[] }
  | { type: 'conditional'; test: ASTNode; consequent: ASTNode; alternate: ASTNode }
  | { type: 'array'; elements: ASTNode[] }

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer
// ─────────────────────────────────────────────────────────────────────────────

interface Token {
  type: 'number' | 'string' | 'identifier' | 'operator' | 'punctuation' | 'eof'
  value: string | number
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const char = expr[i]

    // Skip whitespace
    if (/\s/.test(char)) {
      i++
      continue
    }

    // Numbers (including decimals)
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(expr[i + 1]))) {
      let num = ''
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++]
      }
      tokens.push({ type: 'number', value: parseFloat(num) })
      continue
    }

    // Strings (single or double quotes)
    if (char === '"' || char === "'") {
      const quote = char
      i++ // Skip opening quote
      let str = ''
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          i++ // Skip backslash
          const escaped = expr[i]
          if (escaped === 'n') str += '\n'
          else if (escaped === 't') str += '\t'
          else str += escaped
        } else {
          str += expr[i]
        }
        i++
      }
      i++ // Skip closing quote
      tokens.push({ type: 'string', value: str })
      continue
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(char)) {
      let id = ''
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
        id += expr[i++]
      }
      tokens.push({ type: 'identifier', value: id })
      continue
    }

    // Multi-character operators
    const twoChar = expr.slice(i, i + 2)
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar })
      i += 2
      continue
    }

    // Single-character operators
    if ('+-*/%<>!'.includes(char)) {
      tokens.push({ type: 'operator', value: char })
      i++
      continue
    }

    // Punctuation
    if ('()[],:.?'.includes(char)) {
      tokens.push({ type: 'punctuation', value: char })
      i++
      continue
    }

    throw new Error(`Unexpected character: '${char}' at position ${i}`)
  }

  tokens.push({ type: 'eof', value: '' })
  return tokens
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[]
  private pos: number = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): ASTNode {
    const node = this.parseExpression()
    if (this.peek().type !== 'eof') {
      throw new Error(`Unexpected token: ${JSON.stringify(this.peek())}`)
    }
    return node
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'eof', value: '' }
  }

  private consume(): Token {
    return this.tokens[this.pos++] || { type: 'eof', value: '' }
  }

  private expect(type: string, value?: string): Token {
    const token = this.consume()
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`)
    }
    return token
  }

  // Expression parsing with precedence climbing
  private parseExpression(): ASTNode {
    return this.parseTernary()
  }

  private parseTernary(): ASTNode {
    let node = this.parseOr()

    if (this.peek().value === '?') {
      this.consume() // ?
      const consequent = this.parseExpression()
      this.expect('punctuation', ':')
      const alternate = this.parseExpression()
      node = { type: 'conditional', test: node, consequent, alternate }
    }

    return node
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd()

    while (this.peek().value === '||') {
      const operator = this.consume().value as string
      const right = this.parseAnd()
      left = { type: 'binary', operator, left, right }
    }

    return left
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality()

    while (this.peek().value === '&&') {
      const operator = this.consume().value as string
      const right = this.parseEquality()
      left = { type: 'binary', operator, left, right }
    }

    return left
  }

  private parseEquality(): ASTNode {
    let left = this.parseComparison()

    while (this.peek().value === '==' || this.peek().value === '!=') {
      const operator = this.consume().value as string
      const right = this.parseComparison()
      left = { type: 'binary', operator, left, right }
    }

    return left
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive()

    while (['<', '>', '<=', '>='].includes(this.peek().value as string)) {
      const operator = this.consume().value as string
      const right = this.parseAdditive()
      left = { type: 'binary', operator, left, right }
    }

    return left
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative()

    while (this.peek().value === '+' || this.peek().value === '-') {
      const operator = this.consume().value as string
      const right = this.parseMultiplicative()
      left = { type: 'binary', operator, left, right }
    }

    return left
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary()

    while (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%') {
      const operator = this.consume().value as string
      const right = this.parseUnary()
      left = { type: 'binary', operator, left, right }
    }

    return left
  }

  private parseUnary(): ASTNode {
    if (this.peek().value === '!' || this.peek().value === '-') {
      const operator = this.consume().value as string
      const operand = this.parseUnary()
      return { type: 'unary', operator, operand }
    }

    return this.parsePostfix()
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary()

    while (true) {
      if (this.peek().value === '.') {
        this.consume()
        const property = this.expect('identifier').value as string
        node = { type: 'member', object: node, property, computed: false }
      } else if (this.peek().value === '[') {
        this.consume()
        const property = this.parseExpression()
        this.expect('punctuation', ']')
        node = { type: 'member', object: node, property, computed: true }
      } else if (this.peek().value === '(' && node.type === 'identifier') {
        // Function call
        this.consume()
        const args: ASTNode[] = []
        if (this.peek().value !== ')') {
          args.push(this.parseExpression())
          while (this.peek().value === ',') {
            this.consume()
            args.push(this.parseExpression())
          }
        }
        this.expect('punctuation', ')')
        node = { type: 'call', callee: node.name, args }
      } else {
        break
      }
    }

    return node
  }

  private parsePrimary(): ASTNode {
    const token = this.peek()

    // Number
    if (token.type === 'number') {
      this.consume()
      return { type: 'number', value: token.value as number }
    }

    // String
    if (token.type === 'string') {
      this.consume()
      return { type: 'string', value: token.value as string }
    }

    // Identifier or keyword
    if (token.type === 'identifier') {
      const name = this.consume().value as string

      // Boolean keywords
      if (name === 'true') return { type: 'boolean', value: true }
      if (name === 'false') return { type: 'boolean', value: false }
      if (name === 'null') return { type: 'null' }

      return { type: 'identifier', name }
    }

    // Parenthesized expression
    if (token.value === '(') {
      this.consume()
      const expr = this.parseExpression()
      this.expect('punctuation', ')')
      return expr
    }

    // Array literal
    if (token.value === '[') {
      this.consume()
      const elements: ASTNode[] = []
      if (this.peek().value !== ']') {
        elements.push(this.parseExpression())
        while (this.peek().value === ',') {
          this.consume()
          elements.push(this.parseExpression())
        }
      }
      this.expect('punctuation', ']')
      return { type: 'array', elements }
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Functions
// ─────────────────────────────────────────────────────────────────────────────

type BuiltinFn = (args: ExprValue[], ctx: ExprContext) => ExprValue

const BUILTINS: Record<string, BuiltinFn> = {
  // Math functions
  abs: (args) => Math.abs(args[0] as number),
  sign: (args) => Math.sign(args[0] as number),
  floor: (args) => Math.floor(args[0] as number),
  ceil: (args) => Math.ceil(args[0] as number),
  round: (args) => Math.round(args[0] as number),
  min: (args) => Math.min(...args.map(a => a as number)),
  max: (args) => Math.max(...args.map(a => a as number)),
  sqrt: (args) => Math.sqrt(args[0] as number),
  pow: (args) => Math.pow(args[0] as number, args[1] as number),

  // Trigonometry
  sin: (args) => Math.sin(args[0] as number),
  cos: (args) => Math.cos(args[0] as number),
  tan: (args) => Math.tan(args[0] as number),
  asin: (args) => Math.asin(args[0] as number),
  acos: (args) => Math.acos(args[0] as number),
  atan: (args) => Math.atan(args[0] as number),
  atan2: (args) => Math.atan2(args[0] as number, args[1] as number),

  // Interpolation
  clamp: (args) => {
    const [value, min, max] = args as number[]
    return Math.max(min, Math.min(max, value))
  },
  lerp: (args) => {
    const [a, b, t] = args as number[]
    return a + (b - a) * t
  },

  // Vector operations
  distance: (args) => {
    const a = args[0] as Vec2
    const b = args[1] as Vec2
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    return Math.sqrt(dx * dx + dy * dy)
  },
  normalize: (args) => {
    const v = args[0] as Vec2
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1])
    if (len === 0) return [0, 0] as Vec2
    return [v[0] / len, v[1] / len] as Vec2
  },
  dot: (args) => {
    const a = args[0] as Vec2
    const b = args[1] as Vec2
    return a[0] * b[0] + a[1] * b[1]
  },
  vec2: (args) => [args[0] as number, args[1] as number] as Vec2,

  // Array functions
  len: (args) => {
    const value = args[0]
    if (Array.isArray(value)) return value.length
    if (typeof value === 'string') return value.length
    return 0
  },

  // String functions
  concat: (args) => args.map(a => String(a)).join(''),
  contains: (args) => {
    const str = String(args[0])
    const substr = String(args[1])
    return str.includes(substr)
  },
  toLowerCase: (args) => String(args[0]).toLowerCase(),
  toUpperCase: (args) => String(args[0]).toUpperCase(),
  substring: (args) => {
    const str = String(args[0])
    const start = args[1] as number
    const end = args[2] as number | undefined
    return end !== undefined ? str.substring(start, end) : str.substring(start)
  },

  // Type conversion
  int: (args) => Math.trunc(args[0] as number),
  float: (args) => Number(args[0]),
  str: (args) => String(args[0]),
  bool: (args) => Boolean(args[0]),

  // Random (seeded if available)
  random: (args, ctx) => {
    const min = (args[0] as number) ?? 0
    const max = (args[1] as number) ?? 1
    if (ctx.random) {
      return ctx.random.float(min, max)
    }
    return Math.random() * (max - min) + min
  },
  randomInt: (args, ctx) => {
    const min = args[0] as number
    const max = args[1] as number
    if (ctx.random) {
      return ctx.random.int(min, max)
    }
    return Math.floor(Math.random() * (max - min)) + min
  },

  // Utility
  typeof: (args) => {
    const value = args[0]
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator
// ─────────────────────────────────────────────────────────────────────────────

function evaluate(node: ASTNode, ctx: ExprContext): ExprValue {
  switch (node.type) {
    case 'number':
      return node.value

    case 'string':
      return node.value

    case 'boolean':
      return node.value

    case 'null':
      return null

    case 'identifier': {
      // Check for 'self' reference
      if (node.name === 'self' && ctx.self) {
        return ctx.self as ExprValue
      }
      const value = ctx.variables[node.name]
      if (value === undefined) {
        throw new Error(`Undefined variable: '${node.name}'`)
      }
      return value
    }

    case 'member': {
      const object = evaluate(node.object, ctx)
      if (object === null || object === undefined) {
        throw new Error(`Cannot access property of null/undefined`)
      }

      let key: string | number
      if (node.computed) {
        const keyValue = evaluate(node.property as ASTNode, ctx)
        key = typeof keyValue === 'number' ? keyValue : String(keyValue)
      } else {
        key = node.property as string
      }

      if (Array.isArray(object)) {
        return object[key as number] as ExprValue
      }

      return (object as Record<string, unknown>)[key] as ExprValue
    }

    case 'binary': {
      // Short-circuit evaluation for && and ||
      if (node.operator === '&&') {
        const left = evaluate(node.left, ctx)
        if (!left) return left
        return evaluate(node.right, ctx)
      }
      if (node.operator === '||') {
        const left = evaluate(node.left, ctx)
        if (left) return left
        return evaluate(node.right, ctx)
      }

      const left = evaluate(node.left, ctx)
      const right = evaluate(node.right, ctx)

      switch (node.operator) {
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return String(left) + String(right)
          }
          return (left as number) + (right as number)
        case '-':
          return (left as number) - (right as number)
        case '*':
          return (left as number) * (right as number)
        case '/':
          return (left as number) / (right as number)
        case '%':
          return (left as number) % (right as number)
        case '<':
          return (left as number) < (right as number)
        case '>':
          return (left as number) > (right as number)
        case '<=':
          return (left as number) <= (right as number)
        case '>=':
          return (left as number) >= (right as number)
        case '==':
          return left === right
        case '!=':
          return left !== right
        default:
          throw new Error(`Unknown operator: ${node.operator}`)
      }
    }

    case 'unary': {
      const operand = evaluate(node.operand, ctx)
      switch (node.operator) {
        case '!':
          return !operand
        case '-':
          return -(operand as number)
        default:
          throw new Error(`Unknown unary operator: ${node.operator}`)
      }
    }

    case 'call': {
      const fn = BUILTINS[node.callee]
      if (!fn) {
        throw new Error(`Unknown function: '${node.callee}'`)
      }
      const args = node.args.map(arg => evaluate(arg, ctx))
      return fn(args, ctx)
    }

    case 'conditional': {
      const test = evaluate(node.test, ctx)
      return test ? evaluate(node.consequent, ctx) : evaluate(node.alternate, ctx)
    }

    case 'array': {
      return node.elements.map(el => evaluate(el, ctx))
    }

    default:
      throw new Error(`Unknown AST node type: ${(node as ASTNode).type}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compile an expression string to an AST for repeated evaluation
 */
export function compileExpression(expr: string): ASTNode {
  const tokens = tokenize(expr)
  const parser = new Parser(tokens)
  return parser.parse()
}

/**
 * Evaluate a compiled expression with a context
 */
export function evaluateAST(ast: ASTNode, ctx: ExprContext): ExprValue {
  return evaluate(ast, ctx)
}

/**
 * Compile and evaluate an expression in one step
 */
export function evaluateExpression(expr: string, ctx: ExprContext): ExprValue {
  const ast = compileExpression(expr)
  return evaluate(ast, ctx)
}

/**
 * Expression wrapper object (for JSON serialization)
 */
export interface ExprWrapper {
  $expr: string
}

/**
 * Check if a value is an expression wrapper
 */
export function isExprWrapper(value: unknown): value is ExprWrapper {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$expr' in value &&
    typeof (value as ExprWrapper).$expr === 'string'
  )
}

/**
 * Resolve a value that might be an expression
 */
export function resolveValue(value: unknown, ctx: ExprContext): ExprValue {
  if (isExprWrapper(value)) {
    return evaluateExpression(value.$expr, ctx)
  }
  return value as ExprValue
}

// ─────────────────────────────────────────────────────────────────────────────
// Expression Cache (for performance)
// ─────────────────────────────────────────────────────────────────────────────

const expressionCache = new Map<string, ASTNode>()

/**
 * Evaluate an expression with caching
 */
export function evaluateCached(expr: string, ctx: ExprContext): ExprValue {
  let ast = expressionCache.get(expr)
  if (!ast) {
    ast = compileExpression(expr)
    expressionCache.set(expr, ast)
  }
  return evaluate(ast, ctx)
}

/**
 * Clear the expression cache
 */
export function clearExpressionCache(): void {
  expressionCache.clear()
}

/**
 * Get cache statistics
 */
export function getExpressionCacheStats(): { size: number; expressions: string[] } {
  return {
    size: expressionCache.size,
    expressions: Array.from(expressionCache.keys()),
  }
}
