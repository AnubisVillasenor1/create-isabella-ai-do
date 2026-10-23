// ISABELLA Ω · Catálogo canónico de customización nativa (state: draft | engine-generated).
//
// Deriva el modelo de customización de Antigravity —reglas, skills, plugins, hooks y
// servidores MCP— a entidades NATIVAS declarativas. Los esquemas de herramientas MCP
// son un subconjunto representativo de `mcp/chrome_devtools/*.json` (JSON-Schema draft-07).
//
// Invariante: declarar un pack NO autoriza, NO instala y NO ejecuta. Todo entra como
// dato de solo lectura, pendiente de revisión humana (AGENTS.md §7).
import type { CustomizationEntry, McpToolSchema, PluginBundle } from "./types";

const MCP_CHROME = "isabella.mcp.chrome-devtools";
const RULE_INVARIANT = "isabella.rule.invariant";
const RULE_SPEC = "isabella.rule.spec-canonical";
const SKILL_CUSTOMIZATION = "isabella.skill.customization";
const SKILL_GENERATIVE = "isabella.skill.generative-ui";
const SKILL_MIGRATE = "isabella.skill.migrate-workflows";
const SKILL_PERMISSIONED = "isabella.skill.permissioned-github";
const SKILL_GUIDE = "isabella.skill.antigravity-guide";
const HOOK_SECRET = "isabella.hook.secret-guard";
const HOOK_QUALITY = "isabella.hook.quality-gate";
const PLUGIN_KIT = "isabella.plugin.antigravity-kit";

const CHROME_TOOLS: readonly McpToolSchema[] = [
  {
    name: "navigate_page",
    description: "Go to a URL, or back, forward, or reload. Use project URL if not specified otherwise.",
    readOnlyHint: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["url", "back", "forward", "reload"], description: "Navigate the page by URL, back or forward in history, or reload." },
        url: { type: "string", description: "Target URL (only type=url)" },
        timeout: { type: "integer", description: "Maximum wait time in milliseconds. If set to 0, the default timeout will be used." },
        ignoreCache: { type: "boolean", description: "Whether to ignore cache on reload." },
        handleBeforeUnload: { type: "string", enum: ["accept", "decline"] },
        initScript: { type: "string" },
      },
    },
  },
  {
    name: "take_snapshot",
    description: "Take a text snapshot of the currently selected page based on the a11y tree. The snapshot lists page elements along with a unique identifier (uid). Always use the latest snapshot. Prefer taking a snapshot over taking a screenshot.",
    readOnlyHint: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        filePath: { type: "string", description: "The absolute path, or a path relative to the current working directory, to save the snapshot to instead of attaching it to the response." },
        verbose: { type: "boolean", description: "Whether to include all possible information available in the full a11y tree. Default is false." },
      },
    },
  },
  {
    name: "list_console_messages",
    description: "List all console messages for the currently selected page since the last navigation.",
    readOnlyHint: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        includePreservedMessages: { type: "boolean", default: false },
        pageIdx: { type: "integer", minimum: 0 },
        pageSize: { type: "integer", exclusiveMinimum: 0 },
        types: {
          type: "array",
          items: { type: "string", enum: ["log", "debug", "info", "error", "warn", "dir", "dirxml", "table", "trace", "clear", "startGroup", "startGroupCollapsed", "endGroup", "assert", "profile", "profileEnd", "count", "timeEnd", "verbose", "issue"] },
        },
      },
    },
  },
  {
    name: "evaluate_script",
    description: "Evaluate a JavaScript function inside the currently selected page. Returns the response as JSON, so returned values have to be JSON-serializable.",
    readOnlyHint: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["function"],
      properties: {
        function: { type: "string", description: "A JavaScript function declaration to be executed by the tool in the currently selected page." },
        args: { type: "array", items: { type: "string" } },
        dialogAction: { type: "string" },
      },
    },
  },
  {
    name: "close_page",
    description: "Closes the page by its index. The last open page cannot be closed.",
    readOnlyHint: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["pageId"],
      properties: {
        pageId: { type: "number", description: "The ID of the page to close. Call list_pages to list pages." },
      },
    },
  },
];

const KIT_BUNDLES: PluginBundle = {
  rules: [RULE_INVARIANT, RULE_SPEC],
  skills: [SKILL_CUSTOMIZATION, SKILL_GENERATIVE, SKILL_MIGRATE, SKILL_PERMISSIONED, SKILL_GUIDE],
  hooks: [HOOK_SECRET, HOOK_QUALITY],
  mcpServers: [MCP_CHROME],
};

const CUSTOMIZATION_ENTRIES: readonly CustomizationEntry[] = [
  {
    kind: "rule",
    id: RULE_INVARIANT,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    displayName: "Invariante operativo",
    description: "CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION: las inteligencias sugieren, calculan y evalúan; la autoridad humana decide y ejecuta.",
    path: "AGENTS.md",
    alwaysOn: true,
    trigger: "always_on",
  },
  {
    kind: "rule",
    id: RULE_SPEC,
    version: "1.0.0",
    state: "engine-generated",
    scope: "workspace",
    displayName: "Fuente canónica de la especificación",
    description: "En conflicto entre código y spec gana la spec; el conflicto se archiva como divergencia pendiente de arbitraje humano (docs/spec/canonical/DIVERGENCE-REGISTER.md).",
    path: "docs/spec",
    alwaysOn: false,
    trigger: "model_decision",
  },
  {
    kind: "skill",
    id: SKILL_CUSTOMIZATION,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    displayName: "Customizaciones (reglas, skills, hooks, plugins, MCP)",
    description: "Cómo declarar reglas, skills, hooks, plugins y servidores MCP, y cómo se componen por herencia con `inherits`/`entries`.",
    activation: "on-demand",
    frontmatterName: "agy-customizations",
    riskTier: "LOW",
    references: [
      "docs/skills.md",
      "docs/rules.md",
      "docs/plugins.md",
      "docs/hooks.md",
      "docs/json_configs.md",
      "docs/mcp_servers.md",
    ],
  },
  {
    kind: "skill",
    id: SKILL_GENERATIVE,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    displayName: "Interfaz generativa",
    description: "Genera widgets HTML/Tailwind autocontenidos e insertables con <agent-embed> para visualizar datos del agente.",
    activation: "on-demand",
    frontmatterName: "generative_ui",
    riskTier: "LOW",
    references: [],
  },
  {
    kind: "skill",
    id: SKILL_MIGRATE,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    displayName: "Migrar flujos de trabajo a skills",
    description: "Convierte flujos de trabajo heredados en skills con divulgación progresiva.",
    activation: "on-demand",
    frontmatterName: "migrate-workflows",
    riskTier: "LOW",
    references: [],
  },
  {
    kind: "skill",
    id: SKILL_PERMISSIONED,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    displayName: "GitHub con permisos explícitos",
    description: "Formato de permiso `<command-binary>.<action>(<resource_json>)` y petición explícita vía `ask_custom_permission`.",
    activation: "on-demand",
    frontmatterName: "permissioned-github",
    riskTier: "MEDIUM",
    references: [],
  },
  {
    kind: "skill",
    id: SKILL_GUIDE,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    displayName: "Guía de la plataforma (app, cli, ide, sdk)",
    description: "Referencia de la plataforma: aplicación, CLI, IDE y SDK.",
    activation: "on-demand",
    frontmatterName: "antigravity_guide",
    riskTier: "LOW",
    references: ["references/app.md", "references/cli.md", "references/ide.md", "references/sdk.md"],
  },
  {
    kind: "hook",
    id: HOOK_SECRET,
    version: "1.0.0",
    state: "engine-generated",
    scope: "workspace",
    displayName: "Guarda de secretos (pre-tool)",
    description: "Hook PreToolUse que intercepta comandos con apariencia de credencial antes de ejecutarse.",
    event: "PreToolUse",
    enabled: true,
    handlers: [{ type: "command", matcher: ".*", timeoutSeconds: 5 }],
  },
  {
    kind: "hook",
    id: HOOK_QUALITY,
    version: "1.0.0",
    state: "engine-generated",
    scope: "workspace",
    displayName: "Compuerta de calidad (post-tool)",
    description: "Hook PostToolUse que dispara la verificación de typecheck/tests tras editar archivos de origen.",
    event: "PostToolUse",
    enabled: false,
    handlers: [{ type: "command", matcher: "src/**/*.ts", timeoutSeconds: 30 }],
  },
  {
    kind: "mcp-server",
    id: MCP_CHROME,
    version: "1.0.0",
    state: "engine-generated",
    scope: "builtin",
    displayName: "Chrome DevTools MCP",
    description: "Servidor MCP de depuración de navegador; expone 31 herramientas (subconjunto representativo declarado aquí).",
    transport: "stdio",
    command: "npx",
    tools: CHROME_TOOLS,
  },
  {
    kind: "plugin",
    id: PLUGIN_KIT,
    version: "1.0.0",
    state: "engine-generated",
    scope: "workspace",
    displayName: "Kit de customization",
    description: "Pack que agrupa reglas, skills, hooks y el servidor MCP de Chrome DevTools. Opt-in: inhabilitado por defecto.",
    enabledByDefault: false,
    disabled: true,
    bundles: KIT_BUNDLES,
  },
];

export const CUSTOMIZATION_CATALOG: readonly CustomizationEntry[] = Object.freeze(
  CUSTOMIZATION_ENTRIES.map((entry) => Object.freeze(entry)),
);
