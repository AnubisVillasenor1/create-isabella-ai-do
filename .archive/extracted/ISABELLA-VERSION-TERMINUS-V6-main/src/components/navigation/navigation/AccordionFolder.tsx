/**
 * AccordionFolder
 *
 * Carpeta retráctile con 5 estados:
 * cerrada, abierta, activa, con cambios, con alerta, bloqueada,
 * en proceso, completada, requiere revisión.
 */

import { useState, useRef, useEffect } from "react";
import type { NavigationNode, NavigationBadge } from "./types";
import { useNavigation } from "./NavigationStateProvider";

// ============================================================================
// BADGE COMPONENT
// ============================================================================

function Badge({ badge }: { badge: NavigationBadge }) {
  const toneClasses: Record<string, string> = {
    info: "badge-info",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
  };

  return (
    <span className={`nav-badge ${toneClasses[badge.tone] ?? ""}`}>
      {badge.value}
    </span>
  );
}

// ============================================================================
// ACCORDION FOLDER
// ============================================================================

interface AccordionFolderProps {
  node: NavigationNode;
  level?: number;
  onAction?: (node: NavigationNode) => void;
}

export function AccordionFolder({
  node,
  level = 0,
  onAction,
}: AccordionFolderProps) {
  const { toggleFolder, isFolderExpanded, state, dispatch } = useNavigation();
  const isExpanded = isFolderExpanded(node.id);
  const isActive = state.activeNode === node.id;
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded, node.children]);

  const handleClick = () => {
    if (node.disabled) return;
    toggleFolder(node.id);
    dispatch({ type: "SET_ACTIVE_NODE", nodeId: node.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
    if (e.key === "Escape") {
      dispatch({ type: "CLOSE_NAVBAR" });
    }
  };

  const handleChildAction = (child: NavigationNode) => {
    if (child.requiresConfirmation) {
      // TODO: Show confirmation dialog
      console.log("Confirmación requerida:", child.label);
    }
    onAction?.(child);
    dispatch({ type: "SET_ACTIVE_NODE", nodeId: child.id });
  };

  const chevronStyle = {
    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform 180ms ease-out",
  };

  return (
    <div
      className={`accordion-folder ${isActive ? "active" : ""} ${node.disabled ? "disabled" : ""}`}
      data-level={level}
    >
      <button
        className="accordion-trigger"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={`folder-content-${node.id}`}
        aria-label={`${isExpanded ? "Cerrar" : "Abrir"} ${node.label}`}
        disabled={node.disabled}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {node.type === "folder" && (
          <span className="accordion-chevron" style={chevronStyle}>
            ▸
          </span>
        )}

        {node.icon && <span className="accordion-icon">{node.icon}</span>}

        <span className="accordion-label">{node.label}</span>

        {node.badge && <Badge badge={node.badge} />}

        {node.description && (
          <span className="accordion-description">{node.description}</span>
        )}
      </button>

      <div
        ref={contentRef}
        id={`folder-content-${node.id}`}
        className="accordion-content"
        role="region"
        aria-label={`Contenido de ${node.label}`}
        style={{
          height: isExpanded ? `${contentHeight}px` : "0px",
          opacity: isExpanded ? 1 : 0,
          overflow: "hidden",
        }}
      >
        <div className="accordion-inner">
          {node.children?.map((child) => (
            <AccordionFolder
              key={child.id}
              node={child}
              level={level + 1}
              onAction={handleChildAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
