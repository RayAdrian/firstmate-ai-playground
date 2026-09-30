/**
 * A tiny JSON Schema checker: enough for this exercise, with no dependencies.
 * Supports type (object, array, string, integer), enum, required, properties,
 * additionalProperties: false, items, minItems and minLength.
 * Returns a list of readable problems. An empty list means the value is valid.
 */
export function validate(schema, value, path = "$") {
  const problems = [];

  if (schema.type) {
    const actual = typeOf(value);
    const ok = schema.type === "integer" ? actual === "integer" : actual === schema.type;
    if (!ok) {
      problems.push(`${path}: expected ${schema.type}, got ${actual}`);
      return problems;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.join(", ")}`);
  }

  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) {
    problems.push(`${path}: shorter than ${schema.minLength}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      problems.push(`${path}: fewer than ${schema.minItems} items`);
    }
    if (schema.items) {
      value.forEach((item, i) => problems.push(...validate(schema.items, item, `${path}[${i}]`)));
    }
  }

  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) problems.push(`${path}: missing required field "${key}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) problems.push(...validate(sub, value[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (schema.properties ?? {}))) problems.push(`${path}: unexpected field "${key}"`);
      }
    }
  }

  return problems;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}
