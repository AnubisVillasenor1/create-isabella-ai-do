/**
 * Catálogo de tareas del Hugging Face Hub y su mapeo al dominio de capacidad de
 * Isabella. state: draft | engine-generated.
 *
 * Puramente declarativo: no ejecuta red ni concede autoridad. El mapeo es una
 * clasificación operativa (qué tipo de artefacto es), no una afirmación de que
 * Isabella pueda ejecutarlo. CAPABILITY ≠ AUTHORITY.
 */
import type { CapabilityDomain } from '../capabilities';

/** Id de método canónico de la capacidad de catálogo HF. */
export const HF_HUB_METHOD_ID = 'A.TWINS.HFHUB.query_catalog.v1.0.0.LOW.AUTONOMOUS';

/** Aviso honesto: catálogo/información/datos del Hub; NO inferencia. */
export const HF_HUB_DISCLAIMER =
  'Catálogo, model cards, datasets y archivos públicos del Hugging Face Hub (uso de DATOS e INFORMACIÓN, gratuito). No usa el router de inferencia (de pago): Isabella no genera texto con estos artefactos, solo los descubre y, si se ingieren, los propone como conocimiento PENDING_REVIEW.';

/** Tope de lectura por archivo descargado del Hub (NO es un mirror completo). */
export const HF_HUB_MAX_FILE_BYTES = 512 * 1024;

export interface HfTaskMapping {
  readonly task: string;
  readonly label: string;
  readonly domain: CapabilityDomain;
}

/**
 * Subconjunto representativo de `pipeline_tag` del Hub. El Hub tiene cientos de
 * tareas; aquí se declaran las relevantes para Isabella y su dominio asociado.
 */
export const HF_HUB_TASKS: readonly HfTaskMapping[] = Object.freeze([
  { task: 'text-generation', label: 'Generación de texto', domain: 'knowledge' },
  { task: 'text2text-generation', label: 'Texto a texto', domain: 'knowledge' },
  { task: 'summarization', label: 'Resumen', domain: 'knowledge' },
  { task: 'translation', label: 'Traducción', domain: 'knowledge' },
  { task: 'question-answering', label: 'Pregunta-respuesta', domain: 'knowledge' },
  { task: 'fill-mask', label: 'Relleno de máscara', domain: 'knowledge' },
  { task: 'feature-extraction', label: 'Extracción de características', domain: 'knowledge' },
  { task: 'sentence-similarity', label: 'Similitud de frases (embeddings)', domain: 'memory' },
  { task: 'text-classification', label: 'Clasificación de texto', domain: 'verification' },
  { task: 'token-classification', label: 'Clasificación de tokens', domain: 'verification' },
  {
    task: 'zero-shot-classification',
    label: 'Clasificación de cero disparos',
    domain: 'verification',
  },
  { task: 'image-text-to-text', label: 'Imagen-texto a texto', domain: 'integration' },
  { task: 'image-classification', label: 'Clasificación de imagen', domain: 'integration' },
  { task: 'object-detection', label: 'Detección de objetos', domain: 'integration' },
  { task: 'image-segmentation', label: 'Segmentación de imagen', domain: 'integration' },
  { task: 'text-to-image', label: 'Texto a imagen', domain: 'integration' },
  { task: 'image-to-image', label: 'Imagen a imagen', domain: 'integration' },
  { task: 'automatic-speech-recognition', label: 'Reconocimiento de voz', domain: 'integration' },
  { task: 'text-to-speech', label: 'Texto a voz', domain: 'integration' },
  { task: 'text-to-video', label: 'Texto a vídeo', domain: 'integration' },
  { task: 'image-to-video', label: 'Imagen a vídeo', domain: 'integration' },
]);

const TASK_INDEX: ReadonlyMap<string, HfTaskMapping> = new Map(
  HF_HUB_TASKS.map((mapping) => [mapping.task.toLowerCase(), mapping] as const)
);

export function hfTaskDomain(task: string): CapabilityDomain {
  return TASK_INDEX.get(task.trim().toLowerCase())?.domain ?? 'knowledge';
}

export function hfTaskLabel(task: string): string {
  const normalized = task.trim();
  return TASK_INDEX.get(normalized.toLowerCase())?.label ?? (normalized || 'desconocido');
}

export function hfHubSummary(): { readonly methodId: string; readonly tasks: number } {
  return Object.freeze({ methodId: HF_HUB_METHOD_ID, tasks: HF_HUB_TASKS.length });
}

/**
 * Referencias verificadas del Hub por dominio nativo de Isabella.
 *
 * Honestidad: cada `repoId` se comprobó que EXISTE en huggingface.co en la fecha
 * indicada, con su `pipeline_tag` y licencia declaradas por el propio Hub. Esto
 * es descubrimiento, NO ejecución: Isabella no carga estos pesos ni genera con
 * ellos. La licencia se transcribe de la tarjeta del Hub y debe revalidarse antes
 * de cualquier uso comercial (cambia sin aviso).
 */
export interface HfVerifiedReference {
  /** Dominio nativo de Isabella al que sirve de referencia. */
  readonly domain: 'llm' | 'moe' | 'tts' | 'asr';
  readonly repoId: string;
  readonly task: string;
  readonly license: string;
  /** Fecha (UTC, ISO) en que se verificó la existencia del repo. */
  readonly verifiedAt: string;
}

export const HF_VERIFIED_REFERENCES: readonly HfVerifiedReference[] = Object.freeze([
  Object.freeze({
    domain: 'moe',
    repoId: 'migtissera/Synthia-MoE-v3-Mixtral-8x7B',
    task: 'text-generation',
    license: 'apache-2.0',
    verifiedAt: '2026-10-24',
  }),
  Object.freeze({
    domain: 'moe',
    repoId: 'Alpha-VLLM/MoE-Mixtral-7B-8Expert',
    task: 'text-generation',
    license: 'mit',
    verifiedAt: '2026-10-24',
  }),
  Object.freeze({
    domain: 'tts',
    repoId: 'HirCoir/Piper-TTS-Laura',
    task: 'text-to-speech',
    license: 'cc-by-nc-4.0',
    verifiedAt: '2026-10-24',
  }),
  Object.freeze({
    domain: 'asr',
    repoId: 'DrishtiSharma/wav2vec2-xlsr-spanish-speech-emotion-recognition-v2',
    task: 'unspecified-on-card',
    license: 'unspecified-on-card',
    verifiedAt: '2026-10-24',
  }),
]);

/** Referencias verificadas para un dominio nativo. Devuelve copia congelada. */
export function hfReferencesForDomain(
  domain: HfVerifiedReference['domain']
): readonly HfVerifiedReference[] {
  return Object.freeze(HF_VERIFIED_REFERENCES.filter((reference) => reference.domain === domain));
}
