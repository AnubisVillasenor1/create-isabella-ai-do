// state: draft | engine-generated
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(p, 'utf8');

describe('production-readiness reporting is evidence-based', () => {
  const readme = read('README.md');
  const estado = read('docs/ESTADO-REAL-ACTUAL.md');

  it('the current README refuses an unsupported global completion percentage', () => {
    expect(readme).toMatch(/Avance global de implementación: no publicado como porcentaje único/);
    expect(readme).toMatch(/denominador de requisitos ponderados y reproducible/);
    expect(readme).not.toMatch(/Avance global de implementación: 100%/);
  });

  it('never reintroduces unsupported legacy figures', () => {
    for (const md of [readme, estado]) {
      expect(md).not.toMatch(/~\s*66\s*%|~\s*80\s*%|46\.25\s*%\s*ponderado/);
    }
  });
});
