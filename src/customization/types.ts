// ISABELLA Ω · Customización nativa (state: draft | engine-generated).
//
// Modela los cinco tipos de customización de Antigravity —reglas, skills, plugins,
// hooks y servidores MCP— como entidades NATIVAS, inmutables y de solo lectura.
//
// Invariante: catalogar y clasificar NO autoriza, NO instala y NO ejecuta. Estos
// tipos son descriptores declarativos (datos), nunca rutas de ejecución.
import type { RiskTier } from '../authority/method-id';

export type CustomizationKind = 'rule' | 'skill' | 'plugin' | 'hook' | 'mcp-server';

export type CustomizationState = 'draft' | 'engine-generated' | 'human-approved' | 'human-authored';

export type CustomizationScope = 'workspace' | 'global' | 'builtin';

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'PreInvocation' | 'PostInvocation' | 'Stop';

export interface CustomizationBase {
  readonly kind: CustomizationKind;
  readonly id: string;
  readonly version: string;
  readonly state: CustomizationState;
  readonly scope: CustomizationScope;
  readonly description: string;
  /** Nombre legible opcional; si se omite, el marketplace usa el `id`. */
  readonly displayName?: string;
}

export interface RuleCustomization extends CustomizationBase {
  readonly kind: 'rule';
  /** Ubicación canónica del archivo de reglas (p. ej. "AGENTS.md"). */
  readonly path: string;
  readonly alwaysOn: boolean;
  readonly trigger: 'always_on' | 'model_decision';
}

export interface SkillCustomization extends CustomizationBase {
  readonly kind: 'skill';
  /** Divulgación progresiva: las skills se cargan bajo demanda, nunca siempre-activas. */
  readonly activation: 'on-demand';
  /** `name` declarado en el frontmatter YAML de SKILL.md. */
  readonly frontmatterName: string;
  readonly riskTier: RiskTier;
  /** Rutas relativas de recursos referenciados (docs/, references/, scripts/). */
  readonly references: readonly string[];
}

export interface HookHandler {
  readonly type: 'command';
  readonly matcher: string;
  readonly timeoutSeconds: number;
}

export interface HookCustomization extends CustomizationBase {
  readonly kind: 'hook';
  readonly event: HookEvent;
  readonly enabled: boolean;
  readonly handlers: readonly HookHandler[];
}

export interface McpToolSchema {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly readOnlyHint: boolean;
}

export interface McpServerCustomization extends CustomizationBase {
  readonly kind: 'mcp-server';
  readonly transport: 'stdio' | 'sse';
  readonly command?: string;
  readonly serverUrl?: string;
  readonly tools: readonly McpToolSchema[];
}

export interface PluginBundle {
  readonly rules: readonly string[];
  readonly skills: readonly string[];
  readonly hooks: readonly string[];
  readonly mcpServers: readonly string[];
}

export interface PluginCustomization extends CustomizationBase {
  readonly kind: 'plugin';
  readonly enabledByDefault: boolean;
  readonly disabled: boolean;
  readonly bundles: PluginBundle;
}

export type CustomizationEntry =
  | RuleCustomization
  | SkillCustomization
  | HookCustomization
  | McpServerCustomization
  | PluginCustomization;

export const CUSTOMIZATION_KINDS: readonly CustomizationKind[] = Object.freeze([
  'rule',
  'skill',
  'plugin',
  'hook',
  'mcp-server',
]);
