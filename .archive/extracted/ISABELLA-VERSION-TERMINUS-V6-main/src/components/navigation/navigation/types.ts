/**
 * Navigation Types
 *
 * Arquitectura de navegación oculta, modular y expandible.
 * Cada navbar permanece oculta al iniciar; se activa por icono.
 */

// ============================================================================
// NAVIGATION NODE
// ============================================================================

export type NavigationNodeType = "folder" | "section" | "action";

export type BadgeTone = "info" | "success" | "warning" | "danger";

export interface NavigationBadge {
  value: string | number;
  tone: BadgeTone;
}

export interface NavigationNode {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  type: NavigationNodeType;
  children?: NavigationNode[];
  permission?: string;
  badge?: NavigationBadge;
  requiresConfirmation?: boolean;
  reversible?: boolean;
  disabled?: boolean;
}

// ============================================================================
// NAVIGATION STATE
// ============================================================================

export type NavbarId = "context" | "workspace" | "governance" | "monetization";

export interface NavigationState {
  activeNavbar: NavbarId | null;
  expandedFolders: Record<string, boolean>;
  activeNode: string | null;
  previousFocusId: string | null;
  comparisonMode: boolean;
  comparisonNavbars: [NavbarId, NavbarId] | null;
}

export type NavigationAction =
  | { type: "OPEN_NAVBAR"; navbar: NavbarId }
  | { type: "CLOSE_NAVBAR" }
  | { type: "TOGGLE_NAVBAR"; navbar: NavbarId }
  | { type: "TOGGLE_FOLDER"; nodeId: string }
  | { type: "EXPAND_FOLDER"; nodeId: string }
  | { type: "COLLAPSE_FOLDER"; nodeId: string }
  | { type: "SET_ACTIVE_NODE"; nodeId: string | null }
  | { type: "SET_PREVIOUS_FOCUS"; focusId: string | null }
  | { type: "ENABLE_COMPARISON"; navbars: [NavbarId, NavbarId] }
  | { type: "DISABLE_COMPARISON" }
  | { type: "RESET" };

// ============================================================================
// NAVBAR CONFIGURATION
// ============================================================================

export interface NavbarConfig {
  id: NavbarId;
  label: string;
  icon: string;
  description: string;
  side: "left" | "right";
  surfaceClass: string;
}

export const NAVBAR_CONFIGS: Record<NavbarId, NavbarConfig> = {
  context: {
    id: "context",
    label: "Identidad y contexto",
    icon: "◈",
    description: "Dónde te encuentras en el sistema",
    side: "left",
    surfaceClass: "nav-surface-context",
  },
  workspace: {
    id: "workspace",
    label: "Operación y creación",
    icon: "✦",
    description: "Trabajar, explorar y construir",
    side: "left",
    surfaceClass: "nav-surface-workspace",
  },
  governance: {
    id: "governance",
    label: "Gobernanza y control",
    icon: "⌘",
    description: "Memoria, seguridad y auditoría",
    side: "left",
    surfaceClass: "nav-surface-governance",
  },
  monetization: {
    id: "monetization",
    label: "Monetización y ecosistema",
    icon: "◇",
    description: "Valor económico y territorial",
    side: "right",
    surfaceClass: "nav-surface-monetization",
  },
};

// ============================================================================
// ECONOMIC OPERATION
// ============================================================================

export type EconomicStatus = "pending" | "verified" | "settled" | "reversed";

export interface EconomicOperation {
  id: string;
  functionId: string;
  projectId?: string;
  territoryId?: string;
  socialNetwork?: string;
  paymentMethod?: string;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  aiUsageCost?: number;
  communityDistribution?: number;
  netAmount: number;
  currency: string;
  status: EconomicStatus;
  authorizationId?: string;
  reversibleUntil?: string;
  createdAt: string;
}
