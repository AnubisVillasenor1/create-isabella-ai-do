/**
 * WorkspaceNavbar — NAV 2
 *
 * Operación y creación.
 * Superficie navy institucional.
 * Navbar principal para trabajar, explorar y construir.
 */

import { AccordionFolder } from "./AccordionFolder";
import type { NavigationNode } from "./types";

const workspaceTree: NavigationNode[] = [
  {
    id: "ws-home",
    label: "Inicio",
    type: "folder",
    children: [
      { id: "ws-overview", label: "Vista general", type: "section" },
      { id: "ws-recent", label: "Actividad reciente", type: "section" },
      { id: "ws-continue", label: "Continuar trabajando", type: "action" },
      { id: "ws-favorites", label: "Favoritos", type: "section" },
    ],
  },
  {
    id: "ws-explore",
    label: "Explorar territorio",
    type: "folder",
    children: [
      { id: "ws-places", label: "Lugares", type: "section", icon: "📍" },
      { id: "ws-routes", label: "Rutas", type: "section", icon: "🛤" },
      { id: "ws-culture", label: "Cultura y patrimonio", type: "section" },
      { id: "ws-nature", label: "Naturaleza", type: "section" },
      { id: "ws-gastronomy", label: "Gastronomía", type: "section" },
      { id: "ws-layers", label: "Capas territoriales", type: "section" },
    ],
  },
  {
    id: "ws-create",
    label: "Crear",
    type: "folder",
    children: [
      { id: "ws-new-exp", label: "Nueva experiencia", type: "action" },
      { id: "ws-new-route", label: "Nuevo recorrido", type: "action" },
      { id: "ws-new-project", label: "Nuevo proyecto", type: "action" },
      { id: "ws-new-mission", label: "Nueva misión", type: "action" },
      { id: "ws-new-content", label: "Nuevo contenido", type: "action" },
      { id: "ws-new-collection", label: "Nueva colección", type: "action" },
    ],
  },
  {
    id: "ws-ai",
    label: "Inteligencia artificial",
    type: "folder",
    badge: { value: 3, tone: "info" },
    description: "Herramientas y análisis asistidos",
    children: [
      { id: "ws-ai-chat", label: "Conversar con Isabella", type: "action", icon: "✦" },
      { id: "ws-ai-analyze", label: "Analizar territorio", type: "action" },
      { id: "ws-ai-generate", label: "Generar contenido", type: "action" },
      { id: "ws-ai-research", label: "Investigar fuentes", type: "action" },
      { id: "ws-ai-itinerary", label: "Crear itinerarios", type: "action" },
      { id: "ws-ai-review", label: "Revisar resultados", type: "section" },
      { id: "ws-ai-history", label: "Historial de ejecuciones", type: "section" },
    ],
  },
  {
    id: "ws-data",
    label: "Datos y mapas",
    type: "folder",
    children: [
      { id: "ws-map", label: "Mapa principal", type: "section" },
      { id: "ws-layers-info", label: "Capas de información", type: "section" },
      { id: "ws-poi", label: "Puntos de interés", type: "section" },
      { id: "ws-geometries", label: "Geometrías", type: "section" },
      { id: "ws-indicators", label: "Indicadores", type: "section" },
      { id: "ws-export", label: "Exportaciones", type: "action" },
    ],
  },
  {
    id: "ws-experiences",
    label: "Experiencias",
    type: "folder",
    children: [
      { id: "ws-exp-published", label: "Rutas publicadas", type: "section" },
      { id: "ws-exp-missions", label: "Misiones activas", type: "section" },
      { id: "ws-exp-gamification", label: "Gamificación", type: "section" },
      { id: "ws-exp-narratives", label: "Narrativas", type: "section" },
      { id: "ws-exp-audio", label: "Audio y voz", type: "section" },
      { id: "ws-exp-immersive", label: "Experiencias inmersivas", type: "section" },
    ],
  },
  {
    id: "ws-library",
    label: "Biblioteca",
    type: "folder",
    children: [
      { id: "ws-lib-docs", label: "Documentos", type: "section" },
      { id: "ws-lib-images", label: "Imágenes", type: "section" },
      { id: "ws-lib-audio", label: "Audio", type: "section" },
      { id: "ws-lib-video", label: "Video", type: "section" },
      { id: "ws-lib-3d", label: "Modelos 3D", type: "section" },
      { id: "ws-lib-references", label: "Fuentes y referencias", type: "section" },
    ],
  },
];

export function WorkspaceNavbar() {
  const handleAction = (node: NavigationNode) => {
    console.log("NAV2 action:", node.id, node.label);
  };

  return (
    <div className="navbar-content">
      {workspaceTree.map((node) => (
        <AccordionFolder
          key={node.id}
          node={node}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}
