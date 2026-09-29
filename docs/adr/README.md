# Decisiones de arquitectura de `ciudadano`

Aquí vive la **historia** de las decisiones de este portal: qué problema había, qué se decidió, qué se
midió para decidirlo y qué se probó y se descartó. Junto al código queda solo el porqué **operativo**,
en pocas líneas, y un enlace al ADR que lo cuenta entero.

## Numeración: `CIU-NNNN`, para no chocar con los del producto

Los ADR de este repositorio llevan el prefijo **`CIU-`**. Los de Kamayuk, el producto, viven en
[`hneyra/infrastructure`](https://github.com/hneyra/infrastructure), en
`docs/30-arquitectura/adr/ADR-NNNN-titulo-en-kebab.md`, y se citan en el código como
**`infrastructure ADR-NNNN`** (por ejemplo, `infrastructure ADR-0020`, que retiró `GET /portal/deuda?doc=`).
Un `ADR-NNNN` sin prefijo es siempre del producto.

Los comentarios del código citan un ADR de aquí por su ruta desde la raíz del repositorio
(`docs/adr/CIU-0001-la-raiz-de-la-api-escrita-una-vez.md`), y
`frontend/verificaciones/los-adr-citados-existen.test.ts` exige que cada ruta citada exista y que cada
ADR esté en este índice.

## Índice

| ADR | Decisión | Issues |
|---|---|---|
| [CIU-0001](CIU-0001-la-raiz-de-la-api-escrita-una-vez.md) | La raíz de la API, escrita una vez en un archivo hoja | 13 |
| [CIU-0002](CIU-0002-el-recorrido-es-una-maquina-de-estados.md) | El recorrido es una máquina de estados, y la URL la sigue con una sola regla | 4, 61, 74 |
| [CIU-0003](CIU-0003-recargar-no-echa-el-canje-silencioso.md) | Recargar no echa: el canje silencioso con `prompt=none` en un marco oculto | 35, 56 |
| [CIU-0004](CIU-0004-la-frontera-del-contrato-con-zod.md) | La frontera de `GET /portal/situacion`: el contrato como esquema de `zod` | 14, 34 |
| [CIU-0005](CIU-0005-el-modo-es-una-politica.md) | El modo es una política, y solo `src/modo/` lo lee | 27, 28, 59, 60 |
| [CIU-0006](CIU-0006-una-sola-verdad-para-lo-que-dice-el-servidor.md) | Una sola verdad para lo que dice el servidor: la cache de consultas, con su política | 50 |
| [CIU-0007](CIU-0007-la-imagen-sirve-bajo-portal.md) | La imagen sirve bajo `/portal/`, sin redirigir y sin publicar nada sucio | 37, 58 |
| [CIU-0008](CIU-0008-los-topes-de-la-suite.md) | Los topes de la suite: dos procesos y los plazos del portal dichos | 42 |
| [CIU-0009](CIU-0009-la-escalera-del-ciudadano.md) | La escalera de identidad, dicha al ciudadano | 13, 33, 34 |

## Plantilla

```markdown
# CIU-NNNN — Título en una frase

- **Estado**: Aceptada (AAAA-MM-DD, issue N / PR #M)
- **Dónde vive**: los archivos que la aplican

## Contexto
Qué problema había, medido y no supuesto.

## Decisión
Qué se hace, en presente.

## Consecuencias
Lo que se gana, lo que cuesta y lo que queda fuera.

## Qué se midió
Las cifras y los rojos que la sostienen, con su fecha. Son historia: no se re-miden.

## Qué se descartó
Las alternativas que se probaron o se pensaron, y por qué no.
```

Un ADR no se reescribe cuando la decisión cambia: se escribe otro que lo **sustituye**, y el viejo pasa
a «Sustituida por CIU-NNNN». Lo que sí se corrige es un dato que era falso el día que se escribió.
