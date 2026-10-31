/**
 * Minimal JSON Schema (Draft 2020-12 subset) validator.
 *
 * Supports the assertion keywords that the canonical skill contracts rely on:
 * type (string or union), required, properties, additionalProperties, enum,
 * const, pattern, minLength, maxLength, minimum, maximum, minItems, maxItems and
 * items. It is intentionally dependency-free and fail-closed: any value outside
 * the understood subset is accepted only when it does not contradict a declared
 * assertion, so unknown keywords never mask a real violation.
 */
import { canonicalJson } from './canonical-json';

export interface SchemaViolation {
  readonly path: string;
  readonly message: string;
}

export interface SchemaValidation {
  readonly valid: boolean;
  readonly violations: readonly SchemaViolation[];
}

type Schema = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case 'object':
      return isRecord(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return false;
  }
}

export function validateSchema(value: unknown, schema: Schema): SchemaValidation {
  const violations: SchemaViolation[] = [];
  validateAt(value, schema, '$', violations);
  return { valid: violations.length === 0, violations };
}

function validateAt(value: unknown, schema: Schema, path: string, out: SchemaViolation[]): void {
  const type = schema.type;
  if (typeof type === 'string') {
    if (!typeMatches(value, type)) {
      out.push({ path, message: `expected type ${type}` });
      return;
    }
  } else if (Array.isArray(type)) {
    const allowed = type.filter((entry): entry is string => typeof entry === 'string');
    if (!allowed.some((entry) => typeMatches(value, entry))) {
      out.push({ path, message: `expected one of ${allowed.join('|')}` });
      return;
    }
  }

  if (Array.isArray(schema.enum)) {
    const matches = schema.enum.some(
      (candidate) => canonicalJson(candidate) === canonicalJson(value)
    );
    if (!matches) out.push({ path, message: 'value is not in enum' });
  }

  if ('const' in schema && canonicalJson(schema.const) !== canonicalJson(value)) {
    out.push({ path, message: 'value does not match const' });
  }

  if (typeof value === 'string') {
    const { minLength, maxLength, pattern } = schema;
    if (typeof minLength === 'number' && value.length < minLength) {
      out.push({ path, message: `string shorter than minLength ${minLength}` });
    }
    if (typeof maxLength === 'number' && value.length > maxLength) {
      out.push({ path, message: `string longer than maxLength ${maxLength}` });
    }
    if (typeof pattern === 'string') {
      try {
        if (!new RegExp(pattern).test(value))
          out.push({ path, message: 'string does not match pattern' });
      } catch {
        out.push({ path, message: 'invalid pattern in schema' });
      }
    }
  }

  if (typeof value === 'number') {
    const { minimum, maximum } = schema;
    if (typeof minimum === 'number' && value < minimum)
      out.push({ path, message: `number below minimum ${minimum}` });
    if (typeof maximum === 'number' && value > maximum)
      out.push({ path, message: `number above maximum ${maximum}` });
  }

  if (Array.isArray(value)) {
    const { minItems, maxItems, items } = schema;
    if (typeof minItems === 'number' && value.length < minItems)
      out.push({ path, message: `array shorter than minItems ${minItems}` });
    if (typeof maxItems === 'number' && value.length > maxItems)
      out.push({ path, message: `array longer than maxItems ${maxItems}` });
    if (isRecord(items)) {
      value.forEach((entry, index) => validateAt(entry, items, `${path}[${index}]`, out));
    }
  }

  if (isRecord(value)) {
    const { required, properties, additionalProperties } = schema;
    if (Array.isArray(required)) {
      for (const key of required) {
        if (typeof key === 'string' && !(key in value)) {
          out.push({ path: `${path}.${key}`, message: 'missing required property' });
        }
      }
    }
    if (isRecord(properties)) {
      for (const [key, subSchema] of Object.entries(properties)) {
        if (isRecord(subSchema) && key in value)
          validateAt(value[key], subSchema, `${path}.${key}`, out);
      }
    }
    if (additionalProperties === false) {
      const allowed = isRecord(properties) ? new Set(Object.keys(properties)) : new Set<string>();
      for (const key of Object.keys(value)) {
        if (!allowed.has(key))
          out.push({ path: `${path}.${key}`, message: 'additional property not allowed' });
      }
    }
  }
}
