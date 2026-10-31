// state: engine-generated — revisión humana pendiente.
/**
 * El renderizador de markdown del chat corre en el navegador dentro de una IIFE sin exports,
 * así que no se puede importar desde Node. Lo que sí se puede verificar es el patrón literal
 * que se ejecuta allí: se extrae del archivo que se sirve y se ejunta contra los casos que
 * importan. Si alguien edita el regex, esta prueba sigue al archivo.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const chatSource = readFileSync(new URL('../../src/ui/platform/chat.js', import.meta.url), 'utf8');

function linkPattern(): RegExp {
  const literal = chatSource
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('/\\[') && line.endsWith('/g,'));
  if (!literal) throw new Error('PATTERN_NOT_FOUND: el patrón de enlaces cambió de forma');
  return new RegExp(literal.slice(1, literal.lastIndexOf('/')), 'g');
}

function renderedHref(markdown: string): string | undefined {
  const pattern = linkPattern();
  const match = pattern.exec(`[etiqueta](${markdown})`);
  return match?.[2];
}

describe('enlaces del chat: sólo absolutos https o rutas propias', () => {
  it('acepta http/https y una ruta absoluta de un solo slash', () => {
    expect(renderedHref('https://tamv.network/docs')).toBe('https://tamv.network/docs');
    expect(renderedHref('http://tamv.network/docs')).toBe('http://tamv.network/docs');
    expect(renderedHref('/api/v1/readyz')).toBe('/api/v1/readyz');
    expect(renderedHref('/ui/app.js')).toBe('/ui/app.js');
  });

  it('rechaza el prefijo protocolo-relativo, que saca al cliente del origen', () => {
    expect(renderedHref('//dominio-externo.example/x')).toBeUndefined();
    expect(renderedHref('/\\dominio-externo.example/x')).toBeUndefined();
    expect(renderedHref('/ /espacio')).toBeUndefined();
  });

  it('rechaza esquemas peligrosos y datos opacos', () => {
    expect(renderedHref('javascript:alert(1)')).toBeUndefined();
    expect(renderedHref('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined();
    expect(renderedHref('file:///etc/passwd')).toBeUndefined();
    expect(renderedHref('relative/sin-barra-inicial')).toBeUndefined();
  });

  it('el texto del enlace no reemplaza al destino', () => {
    const pattern = linkPattern();
    const match = pattern.exec('[https://no-es-el-destino.example](/api/v1/readyz)');
    expect(match?.[1]).toBe('https://no-es-el-destino.example');
    expect(match?.[2]).toBe('/api/v1/readyz');
  });
});
