# CIU-0005 — El modo es una política, y solo `src/modo/` lo lee

- **Estado**: Aceptada (2026-09-27, issue 59 / PR #70; agrupada por preguntas en el issue 60 / PR #71),
  sobre el doble modo de los issues 27 y 28
- **Dónde vive**: `frontend/src/modo/modo.ts` (`Modo`, `PoliticaDelModo`, `POLITICAS`) y
  `frontend/src/modo/useModo.ts`; lo vigila `frontend/verificaciones/el-modo-se-lee-en-su-modulo.test.ts`

## Contexto

Desde el issue 27 el portal tiene dos modos: **demostración** (el recorrido del artboard, con sus datos)
y **plataforma** (entrar con la cuenta del portal y la deuda de `GET /portal/situacion`). Hasta el issue 59
el modo era un booleano repartido: `conPlataforma` aparecía 57 veces en el código de producción, se leía
de dos sitios —`estado.conPlataforma` y `hayPlataforma(fuente)`— y se resolvía de tres formas, con una
docena de ternarios `simulado ? null : …` en las pantallas. Las frases falsas del issue 49 se escaparon
por ramas que nadie miró, y el tipo admitía estados que no existen: una fuente sin plataforma y sin
demostración arrancaba en demostración y reventaba en la primera pantalla, y con plataforma el reductor
podía sellar un comprobante con número de operación que la vista tenía que esconder.

## Decisión

- **`Modo` es una unión discriminada**: `EnDemostracion`, con sus datos, o `ConPlataforma`, sin ellos.
  «Sin plataforma y sin demostración» no es un valor del tipo. La fuente es un `Modo` con lo que sabe
  pedir encima.
- **`PoliticaDelModo` es lo que cada modo decide**, una por modo en `POLITICAS`, que el tipo obliga a
  escribir entera. Desde el issue 60 se agrupa en `recorrido`, `sesion`, `cobro` y `contenido`, y **cada
  campo se nombra por la pregunta que contesta**, no por el modo (`laDeudaSeConsulta`, `traeReajuste`,
  `publicaLosPagos`…).
- Las pantallas y el reductor **preguntan a la política** (`useModo()`, `estado.politica`), nunca por el
  modo. La fija siempre el proveedor, con `politicaDe(fuente)`.
- `PagoSellado` es una unión: `PagoRegistrado` o `PagoSimulado` (sin medio, destino ni números); el
  comprobante y «Mis pagos» preguntan una cosa, `esSimulado(pago)`.
- **La amnistía no es del modo**: la dice la fuente y sigue en `estado.amnistia`, porque el día que el
  contrato traiga una saldrá de la respuesta.

## Consecuencias

- Un modo nuevo es una variante más de `Modo` y una entrada más de `POLITICAS`, no un `if` en cada
  archivo.
- `consultaDe`, `demostracionDe`, `loLeidoDe` y lo que nombra el modo solo se usan en los sitios de
  `PERMITIDAS` (`frontend/verificaciones/lecturas-del-modo.ts`), vigilado con los tipos del compilador.
- `src/modo/modo.test.ts` mide que ningún valor ni nombre de campo de una política sea el nombre de un
  modo, y que las respuestas de cada política sean coherentes entre sí.

## Qué se midió

- Lecturas del modo fuera de `src/modo/`: **60 en 13 archivos** sobre `main` (`74c1442a`), todas del
  booleano; **0** después.
- Hasta el issue 60 la política decía `deuda: 'del-artboard' | 'de-la-consulta'`: el nombre del modo
  escrito en un valor, y `deuda` contestaba a la vez la fila «Reajuste» de «Pagar» y qué secciones dibuja
  «Mis pagos» (revisión del PR #70).

## Qué se descartó

- **Seguir con el booleano**, aunque con un solo sitio que lo lea: sigue contestando varias preguntas con
  una sola respuesta, y admite los estados imposibles.
- **Valores que nombran el modo** (`'las-del-artboard'`, `'del-emisor'`): la pregunta queda escondida en el
  nombre del modo, y un modo nuevo obliga a leer cada pantalla para saber qué significaba.
