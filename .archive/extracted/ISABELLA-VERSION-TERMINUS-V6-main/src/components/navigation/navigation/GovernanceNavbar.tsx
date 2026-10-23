/**
 * GovernanceNavbar — NAV 3
 *
 * Gobernanza, memoria y control.
 * Superficie azul petróleo oscuro.
 * Hace visibles los controles que normalmente permanecen ocultos.
 */

import { AccordionFolder } from "./AccordionFolder";
import type { NavigationNode } from "./types";

const governanceTree: NavigationNode[] = [
  {
    id: "gov-memory",
    label: "Memoria",
    type: "folder",
    children: [
      { id: "gov-mem-active", label: "Memoria activa", type: "section" },
      { id: "gov-mem-origin", label: "Origen de los datos", type: "section" },
      { id: "gov-mem-saved", label: "Elementos guardados", type: "section" },
      { id: "gov-mem-prefs", label: "Preferencias", type: "section" },
      { id: "gov-mem-correct", label: "Correcciones", type: "action" },
      { id: "gov-mem-delete", label: "Eliminar memoria", type: "action", requiresConfirmation: true },
    ],
  },
  {
    id: "gov-evidence",
    label: "Evidencia",
    type: "folder",
    children: [
      { id: "gov-ev-sources", label: "Fuentes utilizadas", type: "section" },
      { id: "gov-ev-criteria", label: "Criterios de decisión", type: "section" },
      { id: "gov-ev-confidence", label: "Nivel de confianza", type: "section" },
      { id: "gov-ev-updated", label: "Fecha de actualización", type: "section" },
      { id: "gov-ev-limitations", label: "Limitaciones", type: "section" },
    ],
  },
  {
    id: "gov-authorization",
    label: "Autorizaciones",
    type: "folder",
    children: [
      { id: "gov-auth-personal", label: "Permisos personales", type: "section" },
      { id: "gov-auth-team", label: "Permisos de equipo", type: "section" },
      { id: "gov-auth-pending", label: "Acciones pendientes", type: "section", badge: { value: 2, tone: "warning" } },
      { id: "gov-auth-approvals", label: "Aprobaciones", type: "section" },
      { id: "gov-auth-revoke", label: "Revocaciones", type: "action" },
    ],
  },
  {
    id: "gov-audit",
    label: "Auditoría",
    type: "folder",
    children: [
      { id: "gov-audit-history", label: "Historial de actividad", type: "section" },
      { id: "gov-audit-changes", label: "Cambios realizados", type: "section" },
      { id: "gov-audit-ai", label: "Acciones de IA", type: "section" },
      { id: "gov-audit-economic", label: "Operaciones económicas", type: "section" },
      { id: "gov-audit-export", label: "Exportar registro", type: "action" },
    ],
  },
  {
    id: "gov-security",
    label: "Seguridad",
    type: "folder",
    children: [
      { id: "gov-sec-auth", label: "Autenticación", type: "section" },
      { id: "gov-sec-devices", label: "Dispositivos", type: "section" },
      { id: "gov-sec-sessions", label: "Sesiones activas", type: "section" },
      { id: "gov-sec-tokens", label: "Claves y tokens", type: "section" },
      { id: "gov-sec-policies", label: "Políticas de acceso", type: "section" },
    ],
  },
  {
    id: "gov-privacy",
    label: "Privacidad",
    type: "folder",
    children: [
      { id: "gov-priv-data", label: "Datos personales", type: "section" },
      { id: "gov-priv-consent", label: "Consentimientos", type: "section" },
      { id: "gov-priv-usage", label: "Uso de información", type: "section" },
      { id: "gov-priv-download", label: "Descarga de datos", type: "action" },
      { id: "gov-priv-delete", label: "Eliminación de cuenta", type: "action", requiresConfirmation: true, reversible: false },
    ],
  },
  {
    id: "gov-settings",
    label: "Configuración",
    type: "folder",
    children: [
      { id: "gov-set-appearance", label: "Apariencia", type: "section" },
      { id: "gov-set-accessibility", label: "Accesibilidad", type: "section" },
      { id: "gov-set-language", label: "Idioma y región", type: "section" },
      { id: "gov-set-voice", label: "Voz", type: "section" },
      { id: "gov-set-animations", label: "Animaciones", type: "section" },
      { id: "gov-set-integrations", label: "Integraciones", type: "section" },
    ],
  },
];

export function GovernanceNavbar() {
  const handleAction = (node: NavigationNode) => {
    console.log("NAV3 action:", node.id, node.label);
  };

  return (
    <div className="navbar-content">
      {governanceTree.map((node) => (
        <AccordionFolder
          key={node.id}
          node={node}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}
