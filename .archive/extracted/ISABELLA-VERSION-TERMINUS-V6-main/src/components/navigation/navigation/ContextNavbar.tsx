/**
 * ContextNavbar — NAV 1
 *
 * Identidad y contexto.
 * Superficie navy profunda.
 * Informa dónde se encuentra la persona dentro del sistema.
 */

import { AccordionFolder } from "./AccordionFolder";
import type { NavigationNode } from "./types";

const contextTree: NavigationNode[] = [
  {
    id: "isabella",
    label: "Isabella",
    type: "folder",
    children: [
      {
        id: "space-current",
        label: "Espacio actual",
        type: "folder",
        children: [
          { id: "space-personal", label: "Personal", type: "section" },
          { id: "space-org", label: "Organización", type: "section" },
          { id: "space-community", label: "Comunidad", type: "section" },
          { id: "space-admin", label: "Administración", type: "section" },
        ],
      },
    ],
  },
  {
    id: "territory",
    label: "Territorio",
    type: "folder",
    children: [
      {
        id: "territory-name",
        label: "Mineral del Monte",
        type: "section",
        badge: { value: "Activo", tone: "success" },
      },
      {
        id: "territory-state",
        label: "Hidalgo",
        type: "section",
      },
      {
        id: "territory-region",
        label: "Región activa",
        type: "section",
      },
      {
        id: "territory-map",
        label: "Mapa territorial",
        type: "action",
        icon: "🗺",
      },
    ],
  },
  {
    id: "project",
    label: "Proyecto actual",
    type: "folder",
    children: [
      { id: "project-summary", label: "Resumen", type: "section" },
      { id: "project-participants", label: "Participantes", type: "section" },
      { id: "project-status", label: "Estado operativo", type: "section" },
      { id: "project-switch", label: "Cambiar proyecto", type: "action" },
    ],
  },
  {
    id: "session",
    label: "Sesión",
    type: "folder",
    children: [
      { id: "session-security", label: "Estado de seguridad", type: "section" },
      { id: "session-device", label: "Dispositivo actual", type: "section" },
      { id: "session-activity", label: "Actividad reciente", type: "section" },
      { id: "session-logout", label: "Cerrar sesión", type: "action" },
    ],
  },
];

export function ContextNavbar() {
  const handleAction = (node: NavigationNode) => {
    console.log("NAV1 action:", node.id, node.label);
  };

  return (
    <div className="navbar-content">
      {contextTree.map((node) => (
        <AccordionFolder
          key={node.id}
          node={node}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}
