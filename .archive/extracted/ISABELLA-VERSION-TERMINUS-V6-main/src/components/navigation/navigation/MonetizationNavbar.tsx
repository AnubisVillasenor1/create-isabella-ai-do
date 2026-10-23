/**
 * MonetizationNavbar — NAV 4
 *
 * Monetización y ecosistema.
 * Superficie navy con detalles de cobre.
 * Presenta valor económico, social y territorial con desglose completo.
 */

import { AccordionFolder } from "./AccordionFolder";
import { EconomicBreakdown } from "./EconomicBreakdown";
import type { NavigationNode, EconomicOperation } from "./types";

const monetizationTree: NavigationNode[] = [
  {
    id: "mon-summary",
    label: "Resumen financiero",
    type: "folder",
    badge: { value: "$1,240.50", tone: "success" },
    children: [
      { id: "mon-income", label: "Ingresos actuales", type: "section" },
      { id: "mon-costs", label: "Costos operativos", type: "section" },
      { id: "mon-net", label: "Ingresos netos", type: "section" },
      { id: "mon-pending", label: "Pagos pendientes", type: "section", badge: { value: 2, tone: "warning" } },
      { id: "mon-balance", label: "Balance por periodo", type: "section" },
    ],
  },
  {
    id: "mon-by-function",
    label: "Por función",
    type: "folder",
    children: [
      { id: "mon-fn-experiences", label: "Experiencias", type: "section" },
      { id: "mon-fn-reservations", label: "Reservas", type: "section" },
      { id: "mon-fn-subscriptions", label: "Suscripciones", type: "section" },
      { id: "mon-fn-ai", label: "IA y créditos", type: "section" },
      { id: "mon-fn-premium", label: "Contenido premium", type: "section" },
      { id: "mon-fn-donations", label: "Donaciones", type: "section" },
      { id: "mon-fn-sponsorships", label: "Patrocinios", type: "section" },
      { id: "mon-fn-affiliates", label: "Afiliaciones", type: "section" },
    ],
  },
  {
    id: "mon-by-method",
    label: "Por método",
    type: "folder",
    children: [
      { id: "mon-mt-card", label: "Tarjeta", type: "section" },
      { id: "mon-mt-transfer", label: "Transferencia", type: "section" },
      { id: "mon-mt-subscription", label: "Suscripción", type: "section" },
      { id: "mon-mt-credit", label: "Crédito interno", type: "section" },
      { id: "mon-mt-local", label: "Moneda local", type: "section" },
      { id: "mon-mt-rewards", label: "Recompensas", type: "section" },
    ],
  },
  {
    id: "mon-by-social",
    label: "Por red social",
    type: "folder",
    children: [
      { id: "mon-sg-community", label: "Comunidad Isabella", type: "section" },
      { id: "mon-sg-campaigns", label: "Campañas", type: "section" },
      { id: "mon-sg-reach", label: "Alcance", type: "section" },
      { id: "mon-sg-conversion", label: "Conversión", type: "section" },
      { id: "mon-sg-attributed", label: "Ingresos atribuidos", type: "section" },
      { id: "mon-sg-distributed", label: "Recompensas distribuidas", type: "section" },
    ],
  },
  {
    id: "mon-by-territory",
    label: "Distribución territorial",
    type: "folder",
    children: [
      { id: "mon-tr-community", label: "Beneficios por comunidad", type: "section" },
      { id: "mon-tr-local", label: "Aportaciones locales", type: "section" },
      { id: "mon-tr-suppliers", label: "Proveedores", type: "section" },
      { id: "mon-tr-impact", label: "Impacto regional", type: "section" },
      { id: "mon-tr-percentage", label: "Porcentaje de distribución", type: "section" },
    ],
  },
  {
    id: "mon-payment-methods",
    label: "Métodos de pago",
    type: "folder",
    children: [
      { id: "mon-pm-accounts", label: "Cuentas conectadas", type: "section" },
      { id: "mon-pm-billing", label: "Facturación", type: "section" },
      { id: "mon-pm-prefs", label: "Preferencias", type: "section" },
      { id: "mon-pm-limits", label: "Límites", type: "section" },
      { id: "mon-pm-verification", label: "Verificación", type: "section" },
    ],
  },
  {
    id: "mon-transparency",
    label: "Transparencia económica",
    type: "folder",
    children: [
      { id: "mon-tr-fees", label: "Comisiones", type: "section" },
      { id: "mon-tr-taxes", label: "Impuestos", type: "section" },
      { id: "mon-tr-ai-consumption", label: "Consumo de IA", type: "section" },
      { id: "mon-tr-refund", label: "Políticas de reembolso", type: "section" },
      { id: "mon-tr-history", label: "Historial de operaciones", type: "section" },
    ],
  },
];

// Sample operation for demo
const sampleOperation: EconomicOperation = {
  id: "op-001",
  functionId: "experiencia-territorial",
  projectId: "proj-mineral-monte",
  territoryId: "terr-hidalgo",
  paymentMethod: "tarjeta-digital",
  socialNetwork: "Isabella Comunidad",
  grossAmount: 1240,
  platformFee: 62,
  processingFee: 31,
  aiUsageCost: 18.5,
  communityDistribution: 124,
  netAmount: 1004.5,
  currency: "MXN",
  status: "settled",
  authorizationId: "auth-001",
  reversibleUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
};

export function MonetizationNavbar() {
  const handleAction = (node: NavigationNode) => {
    console.log("NAV4 action:", node.id, node.label);
  };

  return (
    <div className="navbar-content">
      <div className="mon-section-title">
        OPERACIÓN · EXPERIENCIA TERRITORIAL
      </div>

      <EconomicBreakdown operation={sampleOperation} />

      <div className="mon-divider" />

      {monetizationTree.map((node) => (
        <AccordionFolder
          key={node.id}
          node={node}
          onAction={handleAction}
        />
      ))}
    </div>
  );
}
