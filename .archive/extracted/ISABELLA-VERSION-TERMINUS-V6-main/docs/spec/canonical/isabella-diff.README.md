# Isabella Diff Observatory

Plugin gobernado para visualizar cambios no confirmados del workspace junto al transcript de Isabella.

## Comportamiento

- `/diff` abre o actualiza el panel.
- El primer cambio puede abrirlo automáticamente si el terminal tiene ancho suficiente.
- Se actualiza después de ediciones, comandos de shell y turnos finalizados.
- Cada archivo muestra estado, adiciones, eliminaciones, hunks y señales de riesgo.
- `ask` adjunta únicamente los hunks seleccionados al siguiente prompt.
- No realiza cambios en el workspace.
- No usa red.
- Redacta patrones con apariencia de secretos y omite binarios.
- Puede registrar metadatos y hashes en BookPI sin guardar contenido del diff.

## Integración

El host debe proporcionar `DiffPluginContext` y registrar el módulo mediante `register(context)`.

## Política

La implementación es de solo lectura por defecto. Cualquier acción de escritura debe pertenecer a otro plugin con permisos explícitos, revisión humana y registro BookPI.
