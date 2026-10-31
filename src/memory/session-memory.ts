import { createHash, randomBytes } from 'node:crypto';

export interface SessionMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: string;
}

export interface SessionMemoryOptions {
  readonly maxMessagesPerSession?: number;
  readonly maxSessions?: number;
}

export interface SessionSnapshot {
  readonly sessionId: string;
  readonly messages: readonly SessionMessage[];
  readonly messageCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const DEFAULT_MAX_MESSAGES_PER_SESSION = 50;
const DEFAULT_MAX_SESSIONS = 1000;
const MAX_CONTENT_LENGTH = 50_000;

export class SessionMemory {
  private readonly sessions = new Map<string, SessionMessage[]>();
  private readonly sessionOrder: string[] = [];
  private readonly maxMessagesPerSession: number;
  private readonly maxSessions: number;

  constructor(options: SessionMemoryOptions = {}) {
    const maxMessages = options.maxMessagesPerSession ?? DEFAULT_MAX_MESSAGES_PER_SESSION;
    const maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    if (!Number.isInteger(maxMessages) || maxMessages < 2 || maxMessages > 10_000) {
      throw new Error(
        'SESSION_MEMORY: maxMessagesPerSession must be an integer between 2 and 10000'
      );
    }
    if (!Number.isInteger(maxSessions) || maxSessions < 1 || maxSessions > 100_000) {
      throw new Error('SESSION_MEMORY: maxSessions must be an integer between 1 and 100000');
    }
    this.maxMessagesPerSession = maxMessages;
    this.maxSessions = maxSessions;
  }

  addToSession(sessionId: string, message: SessionMessage): void {
    const trimmedId = sessionId.trim();
    if (!trimmedId) throw new Error('SESSION_MEMORY: sessionId required');
    if (trimmedId.length > 256) throw new Error('SESSION_MEMORY: sessionId too long');
    if (!message.content.trim()) throw new Error('SESSION_MEMORY: content required');
    if (message.content.length > MAX_CONTENT_LENGTH)
      throw new Error('SESSION_MEMORY: content too large');
    if (message.role !== 'user' && message.role !== 'assistant') {
      throw new Error("SESSION_MEMORY: role must be 'user' or 'assistant'");
    }
    if (!this.sessions.has(trimmedId)) {
      this.sessions.set(trimmedId, []);
      this.sessionOrder.push(trimmedId);
      if (this.sessionOrder.length > this.maxSessions) {
        const evicted = this.sessionOrder.shift();
        if (evicted !== undefined) this.sessions.delete(evicted);
      }
    }
    const history = this.sessions.get(trimmedId);
    if (history === undefined) throw new Error('SESSION_MEMORY: internal consistency error');
    const stamped: SessionMessage = Object.freeze({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || new Date().toISOString(),
    });
    history.push(stamped);
    if (history.length > this.maxMessagesPerSession) {
      history.splice(0, history.length - this.maxMessagesPerSession);
    }
  }

  getSessionHistory(sessionId: string): readonly SessionMessage[] {
    const history = this.sessions.get(sessionId);
    if (history === undefined) return Object.freeze([]);
    return Object.freeze([...history]);
  }

  clearSession(sessionId: string): boolean {
    const existed = this.sessions.delete(sessionId);
    const index = this.sessionOrder.indexOf(sessionId);
    if (index >= 0) this.sessionOrder.splice(index, 1);
    return existed;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  snapshot(sessionId: string): SessionSnapshot | null {
    const history = this.sessions.get(sessionId);
    if (history === undefined || history.length === 0) return null;
    return Object.freeze({
      sessionId,
      messages: Object.freeze([...history]),
      messageCount: history.length,
      createdAt: history[0]?.timestamp ?? new Date().toISOString(),
      updatedAt: history[history.length - 1]?.timestamp ?? new Date().toISOString(),
    });
  }
}

export function deriveSessionId(raw: string | undefined | null): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return createHash('sha256').update(raw.trim()).digest('hex').slice(0, 32);
  }
  // CSPRNG: un id de sesión anónimo no debe ser predecible (Math.random + Date.now son adivinables).
  return randomBytes(16).toString('hex');
}

export function formatSessionContext(messages: readonly SessionMessage[], limit = 10): string {
  const recent = messages.slice(-limit);
  if (recent.length === 0) return '';
  const lines = recent.map(
    (m) =>
      `[${m.timestamp}] ${m.role === 'user' ? 'Usuario' : 'Isabella'}: ${m.content.length > 300 ? `${m.content.slice(0, 300)}…` : m.content}`
  );
  return `Contexto de sesión reciente:\n${lines.join('\n')}`;
}
