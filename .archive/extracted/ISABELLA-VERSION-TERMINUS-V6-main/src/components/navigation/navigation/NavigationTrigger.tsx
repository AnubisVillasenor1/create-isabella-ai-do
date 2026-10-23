/**
 * NavigationTrigger
 *
 * Botón de activación para cada navbar.
 * Incluye: aria-label, aria-expanded, aria-controls.
 * Estado activo con línea vertical terracotta/cobre.
 */

import { useNavigation } from "./NavigationStateProvider";
import { NAVBAR_CONFIGS, type NavbarId } from "./types";

interface NavigationTriggerProps {
  navbarId: NavbarId;
  badge?: number;
}

export function NavigationTrigger({
  navbarId,
  badge,
}: NavigationTriggerProps) {
  const { state, toggleNavbar, setPreviousFocus } = useNavigation();
  const config = NAVBAR_CONFIGS[navbarId];
  const isActive = state.activeNavbar === navbarId;

  const handleClick = () => {
    setPreviousFocus(`nav-trigger-${navbarId}`);
    toggleNavbar(navbarId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      id={`nav-trigger-${navbarId}`}
      className={`nav-trigger ${isActive ? "active" : ""} ${config.side}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Abrir navegación de ${config.label}`}
      aria-expanded={isActive}
      aria-controls={`nav-panel-${navbarId}`}
      title={config.label}
    >
      <span className="nav-trigger-icon">{config.icon}</span>

      {badge !== undefined && badge > 0 && (
        <span className="nav-trigger-badge">{badge}</span>
      )}

      {isActive && <span className="nav-trigger-indicator" />}
    </button>
  );
}
