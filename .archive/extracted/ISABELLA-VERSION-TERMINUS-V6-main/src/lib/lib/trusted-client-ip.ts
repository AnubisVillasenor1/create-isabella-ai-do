import { config } from "./config";

function isValidIpAddress(value: string): boolean {
  const candidate = value.trim();
  if (!candidate) return false;

  if (candidate.includes(":")) {
    const sections = candidate.split("::");
    if (sections.length > 2) return false;
    const left = sections[0] ? sections[0].split(":") : [];
    const right = sections.length === 2 && sections[1] ? sections[1].split(":") : [];
    const groups = [...left, ...right];
    if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return false;
    return sections.length === 2 ? groups.length < 8 : groups.length === 8;
  }

  const octets = candidate.split(".");
  return (
    octets.length === 4 &&
    octets.every((octet) => {
      return /^(0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255;
    })
  );
}

/**
 * Resolución de IP con contrato explícito de proxy.
 *
 * TRUSTED_PROXY_MODE:
 *   - vercel: solo x-vercel-forwarded-for
 *   - cloudflare: solo cf-connecting-ip
 *   - generic: solo x-real-ip (el reverse proxy DEBE sobrescribirlo)
 *   - cualquier otro valor, incluido el legacy "true": fail-closed
 *
 * No se acepta X-Forwarded-For genérico porque el Request API no expone
 * de forma portable la dirección del socket remoto con la que podríamos
 * verificar la identidad del proxy.
 */
export function resolveTrustedClientIp(request: Request): string {
  let mode = "";
  try {
    mode = String(config().TRUSTED_PROXY_MODE ?? "")
      .trim()
      .toLowerCase();
  } catch {
    return "unknown";
  }

  const candidate = (() => {
    if (mode === "vercel") {
      return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    }
    if (mode === "cloudflare") {
      return request.headers.get("cf-connecting-ip")?.trim();
    }
    if (mode === "generic") {
      return request.headers.get("x-real-ip")?.trim();
    }
    return undefined;
  })();

  if (candidate && isValidIpAddress(candidate)) return candidate;
  return "unknown";
}
