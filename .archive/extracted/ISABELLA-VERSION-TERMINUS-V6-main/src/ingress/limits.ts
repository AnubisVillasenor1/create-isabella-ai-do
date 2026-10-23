/** Límites de solicitud (INGRESS — request limits). */

export interface BodyBudget {
  maxBytes: number;
  consumedBytes: number;
}

export function bodySizeBytes(body: unknown): number {
  if (typeof body === "string") {
    return Buffer.byteLength(body, "utf8");
  }
  try {
    return Buffer.byteLength(JSON.stringify(body), "utf8");
  } catch {
    return 0;
  }
}

export function checkBodySize(body: unknown, maxBytes: number): void {
  const size = bodySizeBytes(body);
  if (size > maxBytes) {
    throw new Error(`INGRESS: cuerpo excede ${maxBytes} bytes (${size})`);
  }
}

export function createBodyBudget(maxBytes: number): BodyBudget {
  if (maxBytes <= 0) {
    throw new Error("INGRESS: el presupuesto de cuerpo debe ser mayor que cero");
  }
  return { maxBytes, consumedBytes: 0 };
}

export function consumeBodyBudget(budget: BodyBudget, body: unknown): number {
  const size = bodySizeBytes(body);
  budget.consumedBytes += size;
  if (budget.consumedBytes > budget.maxBytes) {
    budget.consumedBytes -= size;
    throw new Error(
      `INGRESS: presupuesto de cuerpo agotado (${budget.consumedBytes}/${budget.maxBytes})`,
    );
  }
  return size;
}