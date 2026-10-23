/**
 * EconomicBreakdown
 *
 * Desglose completo de una operación económica.
 * Muestra: ingreso bruto, comisiones, costos, distribución, neto.
 * Incluye: método, red, estado, reversibilidad, autorización.
 */

import type { EconomicOperation } from "./types";

interface EconomicBreakdownProps {
  operation: EconomicOperation;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  verified: "Verificado",
  settled: "Liquidado",
  reversed: "Revertido",
};

const STATUS_TONES: Record<string, string> = {
  pending: "warning",
  verified: "info",
  settled: "success",
  reversed: "danger",
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EconomicBreakdown({ operation }: EconomicBreakdownProps) {
  const rows = [
    {
      label: "Ingreso bruto",
      value: formatCurrency(operation.grossAmount, operation.currency),
      type: "gross",
    },
    {
      label: "Comisión de plataforma",
      value: `-${formatCurrency(operation.platformFee, operation.currency)}`,
      type: "fee",
    },
    {
      label: "Procesamiento de pago",
      value: `-${formatCurrency(operation.processingFee, operation.currency)}`,
      type: "fee",
    },
    ...(operation.aiUsageCost
      ? [
          {
            label: "Consumo de inteligencia artificial",
            value: `-${formatCurrency(operation.aiUsageCost, operation.currency)}`,
            type: "fee" as const,
          },
        ]
      : []),
    ...(operation.communityDistribution
      ? [
          {
            label: "Distribución comunitaria",
            value: `-${formatCurrency(operation.communityDistribution, operation.currency)}`,
            type: "distribution" as const,
          },
        ]
      : []),
    {
      label: "Ingreso neto",
      value: formatCurrency(operation.netAmount, operation.currency),
      type: "net",
    },
  ];

  return (
    <div className="economic-breakdown">
      <div className="economic-rows">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`economic-row ${row.type === "net" ? "economic-row-net" : ""} ${row.type === "gross" ? "economic-row-gross" : ""}`}
          >
            <span className="economic-label">{row.label}</span>
            <span className="economic-value">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="economic-meta">
        <div className="economic-meta-row">
          <span className="economic-meta-label">Método:</span>
          <span className="economic-meta-value">
            {operation.paymentMethod ?? "No especificado"}
          </span>
        </div>
        <div className="economic-meta-row">
          <span className="economic-meta-label">Red:</span>
          <span className="economic-meta-value">
            {operation.socialNetwork ?? "Directo"}
          </span>
        </div>
        <div className="economic-meta-row">
          <span className="economic-meta-label">Estado:</span>
          <span
            className={`economic-status ${STATUS_TONES[operation.status]}`}
          >
            {STATUS_LABELS[operation.status]}
          </span>
        </div>
        <div className="economic-meta-row">
          <span className="economic-meta-label">Reversible:</span>
          <span className="economic-meta-value">
            {operation.reversibleUntil
              ? `Sí, hasta ${formatDateTime(operation.reversibleUntil)}`
              : "No"}
          </span>
        </div>
        <div className="economic-meta-row">
          <span className="economic-meta-label">Autorización:</span>
          <span className="economic-meta-value">
            {operation.authorizationId ?? "Ninguna"}
          </span>
        </div>
      </div>
    </div>
  );
}
