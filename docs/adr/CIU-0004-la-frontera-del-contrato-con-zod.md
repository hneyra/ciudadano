# CIU-0004 — La frontera de `GET /portal/situacion`: el contrato como esquema de `zod`

- **Estado**: Aceptada (2026-09-23, issue 34 / PR #44), sobre el contrato del issue 14 (PR #30)
- **Dónde vive**: `frontend/src/datos/contrato.ts` (el esquema y `leerLaSituacion`),
  `frontend/src/datos/respuestaQueNoEntiendo.ts` (el fallo con nombre), `frontend/src/datos/fuenteDeLaPlataforma.ts`
  (que valida antes de adaptar) y el peldaño `respuesta-ilegible` de `frontend/src/api/escalera.ts`

## Contexto

`contrato.ts` nació en el issue 14 como tipos escritos a mano: la forma de `GET /portal/situacion`, con
los nombres del JSON, leída de las clases Java que la sirven. Lo que llegaba por el cable se **tipaba sin
mirarlo** (`solicitar<SituacionDelContrato>`) y pasaba al adaptador (`deLaSituacion.ts`). Una respuesta
con otra forma no fallaba en la frontera sino dentro de una cuenta o al dibujar: con el `importe` como
número, la aplicación se caía entera («TypeError: valor.trim is not a function», capturado por el
`ErrorBoundary` por omisión de React Router).

## Decisión

- El contrato es un **esquema de `zod`**, y cada tipo es `z.infer` de su esquema: una forma escrita dos
  veces acaba diciendo dos cosas. `contrato.test.ts` lo fija con `expectTypeOf`.
- `leerLaSituacion(unknown)` valida con `safeParse`. Si no cuadra, lanza `RespuestaQueNoEntiendo`, con
  los `fallos` de `zod` para depurar y nunca para la pantalla. `fuenteDeLaPlataforma.ts` pide
  `solicitar<unknown>` y solo lo validado llega a `deLaSituacion`, que no cambió.
- **La asimetría**: objetos `z.object` a secas, ni `.strict()` ni `.passthrough()`.
  - Un campo **de más** no rompe y **se descarta**: el backend tiene que poder crecer (un `cuotas`, un
    `moneda`) sin dejar a todos los ciudadanos sin su deuda hasta redesplegar; y lo que no se validó no
    sigue, para que ninguna pantalla lea un campo que la frontera no conoce.
  - Un campo **de menos, o de otro tipo**, rompe: un importe que falta se dibujaría como un hueco que
    parece un cero, y un `ejercicio` en texto llegaría a una cuenta como si fuera número. Es dinero de
    una persona: mejor «no pudimos leerlo» que una cifra equivocada.
- Importe y fecha, a la forma que `formatearImporte`/`formatearFecha` aceptan (`-?\d+(\.\d{1,2})?` y
  `AAAA-MM-DD`): otra forma ya reventaba, solo que después y en mitad de la pantalla. No se exigen dos
  decimales justos porque el backend no los garantiza (`Dinero` sale por `toPlainString()`, y su escala
  es la decisión D-03a de `rentas`, abierta cuando se escribió esto).
- El fallo de forma tiene **su peldaño**, `respuesta-ilegible` (CIU-0009): es avería, no pide identidad,
  y sus textos dicen por qué no hay ni una cifra.

## Consecuencias

- `zod` entra en el **arranque** del paquete de producción: lo importa de forma estática la frontera, que
  valida la primera consulta. Medido al cerrar el issue 34: 39.23 kB (14.08 kB comprimido). Es coste
  aceptado, no un descuido; trocearlo es trabajo aparte. Antes solo lo cargaban las pantallas perezosas
  de los formularios.
- `respuestaQueNoEntiendo.ts` no importa `zod` en ejecución.

## Qué se midió

- Con la fuente otra vez sin frontera: «expected TypeError: respuesta.municipalidades.map … to be an
  instance of RespuestaQueNoEntiendo», y la caída entera de la aplicación con el `importe` en número.
- Cada rotura del AC2, una a una (`aLaFecha` opcional, `ejercicio` coaccionado, `municipalidades`
  convertida en `[]`, `actualizadoA` opcional, `importe` número): cada una deja pasar SU rotura y solo esa.
- La forma del importe y de la fecha, contra la librería: «importe «1,842.60»: el esquema lo admite si y
  solo si la librería lo dibuja».

## Qué se descartó

- **`.strict()`**: cualquier campo nuevo del backend tumbaría al portal desplegado («Unrecognized key:
  "moneda"»).
- **`.passthrough()`**: dejaría seguir lo no validado.
- **Tipos escritos a mano junto al esquema**: se desvían, y el que se desvía es el que nadie mira.
