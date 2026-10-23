/**
 * NavigationShell
 *
 * Shell que envuelve toda la interfaz.
 * Contiene: barra superior, triggers, overlays, paneles.
 * Los paneles se despliegan desde sus lados correspondientes.
 */

import type { ReactNode } from "react";
import { NavigationStateProvider } from "./NavigationStateProvider";
import { NavigationTrigger } from "./NavigationTrigger";
import { NavigationPanel } from "./NavigationPanel";
import { ContextNavbar } from "./ContextNavbar";
import { WorkspaceNavbar } from "./WorkspaceNavbar";
import { GovernanceNavbar } from "./GovernanceNavbar";
import { MonetizationNavbar } from "./MonetizationNavbar";

interface NavigationShellProps {
  children: ReactNode;
  projectName?: string;
  territory?: string;
  userName?: string;
}

export function NavigationShell({
  children,
  projectName = "Mineral del Monte",
  territory = "Hidalgo",
  userName = "Edwin",
}: NavigationShellProps) {
  return (
    <NavigationStateProvider>
      <div className="nav-shell">
        {/* Top bar */}
        <header className="nav-topbar">
          <div className="nav-topbar-left">
            <span className="nav-topbar-logo">◉</span>
            <span className="nav-topbar-brand">Isabella</span>
            <span className="nav-topbar-separator">·</span>
            <span className="nav-topbar-context">
              {projectName} · {territory}
            </span>
          </div>

          <div className="nav-topbar-center">
            <button className="nav-search-trigger" aria-label="Buscar">
              <span className="nav-search-icon">⌕</span>
              <span className="nav-search-label">Buscar</span>
            </button>
          </div>

          <div className="nav-topbar-right">
            <span className="nav-topbar-status">
              <span className="status-dot active" />
              Activo
            </span>
            <button className="nav-topbar-user" aria-label="Perfil de usuario">
              <span className="user-avatar">{userName.charAt(0)}</span>
              <span className="user-name">{userName}</span>
            </button>
          </div>
        </header>

        {/* Navigation triggers */}
        <div className="nav-triggers">
          <div className="nav-triggers-left">
            <NavigationTrigger navbarId="context" />
            <NavigationTrigger navbarId="workspace" badge={3} />
            <NavigationTrigger navbarId="governance" />
          </div>
          <div className="nav-triggers-right">
            <NavigationTrigger navbarId="monetization" badge={2} />
          </div>
        </div>

        {/* Navigation panels */}
        <NavigationPanel navbarId="context">
          <ContextNavbar />
        </NavigationPanel>

        <NavigationPanel navbarId="workspace">
          <WorkspaceNavbar />
        </NavigationPanel>

        <NavigationPanel navbarId="governance">
          <GovernanceNavbar />
        </NavigationPanel>

        <NavigationPanel navbarId="monetization">
          <MonetizationNavbar />
        </NavigationPanel>

        {/* Main content */}
        <main className="nav-main">{children}</main>

        {/* Accessible announcement region */}
        <div
          id="nav-announcement"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />
      </div>
    </NavigationStateProvider>
  );
}
