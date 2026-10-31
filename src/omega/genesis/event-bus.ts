// state: draft | engine-generated — Bus de Eventos Ω (Documento §XII · AsyncAPI en memoria).
// Bus de mensajes en memoria, determinista y acotado, que modela los canales AsyncAPI de los
// skills fundacionales (orion/sophia/argus/mnemos/lumen). Publica eventos con un sobre común
// (skill, tipo, traceId, payload, emitidoAt) y despacha a suscriptores por canal. Es la contraparte
// ejecutable del contrato `asyncapi/isabella_genesis_asyncapi.yaml`: NO es broker real (Kafka/NATS/
// RabbitMQ), NO atraviesa procesos ni abre red. Un evento publicado aquí es una capacidad
// computacional, NO una garantía de entrega durable (AGENTS.md §1).
import { sha256 } from '../../skills/canonical-json';

/** Canales AsyncAPI canónicos de los cinco skills fundacionales. */
export const SKILL_CHANNELS = [
  'isabella.orion.provenance',
  'isabella.sophia.knowledge',
  'isabella.argus.verification',
  'isabella.mnemos.memory',
  'isabella.lumen.authority',
] as const;
export type SkillChannel = (typeof SKILL_CHANNELS)[number];

export type SkillEventType = 'proposed' | 'computed' | 'evaluated' | 'sealed' | 'denied';

export interface SkillEvent {
  readonly channel: SkillChannel;
  readonly type: SkillEventType;
  readonly traceId: string;
  readonly skillId: string;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
  readonly emittedAt: string;
}

export interface PublishedEvent extends SkillEvent {
  readonly eventId: string; // SHA-256 determinista del sobre
}

export type Subscriber = (event: PublishedEvent) => void;

function isSkillChannel(value: string): value is SkillChannel {
  return (SKILL_CHANNELS as readonly string[]).includes(value);
}

/**
 * Bus de eventos en memoria. `publish` valida el canal y el trazo, deriva un `eventId`
 * determinista (hash del sobre) y entrega a los suscriptores del canal. Un fallo de un
 * suscriptor no aborta la publicación (aislamiento), pero se registra para observabilidad.
 */
export class SkillEventBus {
  private readonly subscribers = new Map<SkillChannel, Set<Subscriber>>();
  private readonly history: PublishedEvent[] = [];
  private readonly maxHistory: number;
  private deliveryFailures = 0;

  constructor(maxHistory = 512) {
    this.maxHistory = Math.max(1, maxHistory);
  }

  subscribe(channel: SkillChannel, handler: Subscriber): () => void {
    if (!isSkillChannel(channel)) throw new Error('EVENT_BUS_UNKNOWN_CHANNEL');
    const set = this.subscribers.get(channel) ?? new Set<Subscriber>();
    set.add(handler);
    this.subscribers.set(channel, set);
    return () => {
      set.delete(handler);
    };
  }

  publish(event: SkillEvent): PublishedEvent {
    if (!isSkillChannel(event.channel)) throw new Error('EVENT_BUS_UNKNOWN_CHANNEL');
    if (!event.traceId.trim()) throw new Error('EVENT_BUS_TRACE_ID_REQUIRED');
    if (!event.skillId.trim()) throw new Error('EVENT_BUS_SKILL_ID_REQUIRED');
    const published: PublishedEvent = Object.freeze({
      ...event,
      payload: Object.freeze({ ...event.payload }),
      eventId: sha256({
        channel: event.channel,
        type: event.type,
        traceId: event.traceId,
        skillId: event.skillId,
        payload: event.payload,
        emittedAt: event.emittedAt,
      }),
    });
    this.history.push(published);
    while (this.history.length > this.maxHistory) this.history.shift();

    for (const handler of this.subscribers.get(event.channel) ?? []) {
      try {
        handler(published);
      } catch {
        this.deliveryFailures += 1;
      }
    }
    return published;
  }

  /** Historial (opcionalmente filtrado por canal), más recientes primero, sin mutación externa. */
  recent(channel?: SkillChannel, limit = 50): readonly PublishedEvent[] {
    const filtered = channel ? this.history.filter((e) => e.channel === channel) : this.history;
    return Object.freeze(filtered.slice(-Math.max(0, limit)).reverse());
  }

  publishedCount(): number {
    return this.history.length;
  }

  failureCount(): number {
    return this.deliveryFailures;
  }
}
