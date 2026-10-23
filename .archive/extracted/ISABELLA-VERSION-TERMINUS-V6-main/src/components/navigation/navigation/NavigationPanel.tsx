/**
 * NavigationPanel
 *
 * Panel deslizante que contiene el contenido de cada navbar.
 * Se despliega desde el lado correspondiente (izq/der).
 * Incluye header con título y botón de cierre.
 */

import { useRef, useEffect, type ReactNode } from "react";
import { useNavigation } from "./NavigationStateProvider";
import { NAVBAR_CONFIGS, type NavbarId } from "./types";

interface NavigationPanelProps {
  navbarId: NavbarId;
  children: ReactNode;
}

export function NavigationPanel({ navbarId, children }: NavigationPanelProps) {
  const { state, closeNavbar, setPreviousFocus } = useNavigation();
  const isOpen = state.activeNavbar === navbarId;
  const panelRef = useRef<HTMLDivElement>(null);
  const config = NAVBAR_CONFIGS[navbarId];

  useEffect(() => {
    if (isOpen && panelRef.current) {
      // Focus primer elemento interactivo
      const firstInteractive = panelRef.current.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      firstInteractive?.focus();

      // Anunciar para lectores de pantalla
      const announcement = document.getElementById("nav-announcement");
      if (announcement) {
        announcement.textContent = `Navegación de ${config.label} abierta.`;
      }
    }
  }, [isOpen, config.label]);

  const handleClose = () => {
    setPreviousFocus(`nav-trigger-${navbarId}`);
    closeNavbar();

    // Restaurar foco al trigger
    setTimeout(() => {
      const trigger = document.getElementById(`nav-trigger-${navbarId}`);
      trigger?.focus();
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  // Trap focus dentro del panel cuando está abierto
  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  const side = config.side;
  const translateX = isOpen ? "0" : side === "left" ? "-100%" : "100%";

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="nav-overlay"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <nav
        ref={panelRef}
        id={`nav-panel-${navbarId}`}
        className={`nav-panel ${config.surfaceClass} ${side}`}
        role="navigation"
        aria-label={config.label}
        aria-hidden={!isOpen}
        onKeyDown={handleKeyDown}
        style={{
          transform: `translateX(${translateX})`,
          transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
          visibility: isOpen ? "visible" : "hidden",
        }}
      >
        <div className="nav-panel-header">
          <div className="nav-panel-title-group">
            <span className="nav-panel-icon">{config.icon}</span>
            <div>
              <h2 className="nav-panel-title">{config.label}</h2>
              <p className="nav-panel-description">{config.description}</p>
            </div>
          </div>
          <button
            className="nav-panel-close"
            onClick={handleClose}
            aria-label={`Cerrar navegación de ${config.label}`}
          >
            ✕
          </button>
        </div>

        <div className="nav-panel-content">{children}</div>
      </nav>
    </>
  );
}
