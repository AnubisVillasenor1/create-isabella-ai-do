/**
 * OSIRIS defense-posture assessment.
 *
 * Reports the observed state of defensive controls as active / inactive /
 * unknown. It NEVER reports "secure" or "certified": an unobserved control is
 * `unknown`, not `active`. state: draft | engine-generated.
 */
import type { DefensePosture, PostureControl, PostureState } from "./types";

export interface PostureInputs {
  /** ISA-X post-quantum verification is wired and reachable. */
  readonly pqcAvailable?: boolean;
  /** An Ed25519 identity key is active for signatures. */
  readonly ed25519Active?: boolean;
  /** Required secrets are present in the server environment only. */
  readonly secretsConfigured?: boolean;
  /** Rate limiting is enabled on public routes. */
  readonly rateLimitEnabled?: boolean;
  /** TLS termination is enforced for inbound traffic. */
  readonly tlsEnforced?: boolean;
  /** The BookPI ledger is backed by durable storage (not in-memory only). */
  readonly ledgerDurable?: boolean;
  /** The audit hash chain verified without integrity failures. */
  readonly auditChainValid?: boolean;
}

function stateOf(value: boolean | undefined): PostureState {
  if (value === undefined) return "unknown";
  return value ? "active" : "inactive";
}

interface ControlSpec {
  readonly control: string;
  readonly value: boolean | undefined;
  readonly activeNote: string;
  readonly inactiveNote: string;
  readonly unknownNote: string;
}

export function assessDefensePosture(
  inputs: PostureInputs = {},
  now: () => string = () => new Date().toISOString(),
): DefensePosture {
  const specs: readonly ControlSpec[] = [
    {
      control: "post_quantum_readiness",
      value: inputs.pqcAvailable,
      activeNote: "ISA-X post-quantum verification is reachable",
      inactiveNote: "No post-quantum verifier is wired",
      unknownNote: "Post-quantum readiness was not probed",
    },
    {
      control: "signature_identity",
      value: inputs.ed25519Active,
      activeNote: "An Ed25519 identity key is active",
      inactiveNote: "No active Ed25519 identity key",
      unknownNote: "Signature identity was not probed",
    },
    {
      control: "secret_hygiene",
      value: inputs.secretsConfigured,
      activeNote: "Required secrets are present server-side",
      inactiveNote: "One or more required secrets are missing",
      unknownNote: "Secret configuration was not probed",
    },
    {
      control: "rate_limiting",
      value: inputs.rateLimitEnabled,
      activeNote: "Public routes enforce rate limits",
      inactiveNote: "Rate limiting is not enforced on public routes",
      unknownNote: "Rate limiting was not probed",
    },
    {
      control: "transport_tls",
      value: inputs.tlsEnforced,
      activeNote: "Inbound transport is TLS-terminated",
      inactiveNote: "Inbound transport is not TLS-terminated",
      unknownNote: "TLS termination was not probed",
    },
    {
      control: "ledger_durability",
      value: inputs.ledgerDurable,
      activeNote: "BookPI is backed by durable storage",
      inactiveNote: "BookPI is in-memory only (not durable)",
      unknownNote: "Ledger durability was not probed",
    },
    {
      control: "audit_chain_integrity",
      value: inputs.auditChainValid,
      activeNote: "The audit hash chain verified with no integrity failures",
      inactiveNote: "The audit hash chain reported an integrity failure",
      unknownNote: "Audit chain integrity was not probed",
    },
  ];

  const controls: PostureControl[] = specs.map((spec) => {
    const state = stateOf(spec.value);
    const note = state === "active" ? spec.activeNote : state === "inactive" ? spec.inactiveNote : spec.unknownNote;
    return Object.freeze({ control: spec.control, state, note });
  });

  return Object.freeze({
    assessedAt: now(),
    controls: Object.freeze(controls),
    activeCount: controls.filter((c) => c.state === "active").length,
    unknownCount: controls.filter((c) => c.state === "unknown").length,
    certification: "NOT_CERTIFIED" as const,
    trainedModelPresent: false as const,
  });
}
