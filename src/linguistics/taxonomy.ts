export const CATEGORIES = [
  'modismo',
  'jerga',
  'tecnicismo',
  'regionalismo',
  'albur',
  'doble_sentido',
  'empresarial',
  'programacion',
  'ingenieria',
  'dicho',
  'expresion',
  'cultural',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
