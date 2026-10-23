/**
 * Navigation Module
 *
 * Arquitectura de navegación oculta, modular y expandible.
 * 4 navbars: Context, Workspace, Governance, Monetization.
 * Cada una permanece oculta al iniciar; se activa por icono.
 */

export { NavigationShell } from "./NavigationShell";
export { NavigationPanel } from "./NavigationPanel";
export { NavigationTrigger } from "./NavigationTrigger";
export { AccordionFolder } from "./AccordionFolder";
export { ContextNavbar } from "./ContextNavbar";
export { WorkspaceNavbar } from "./WorkspaceNavbar";
export { GovernanceNavbar } from "./GovernanceNavbar";
export { MonetizationNavbar } from "./MonetizationNavbar";
export { EconomicBreakdown } from "./EconomicBreakdown";
export {
  NavigationStateProvider,
  useNavigation,
} from "./NavigationStateProvider";
export type {
  NavigationNode,
  NavigationNodeType,
  NavigationBadge,
  BadgeTone,
  NavbarId,
  NavbarConfig,
  NavigationState,
  NavigationAction,
  EconomicOperation,
  EconomicStatus,
} from "./types";
export { NAVBAR_CONFIGS } from "./types";
