# CIU-0001 — La raíz de la API, escrita una vez en un archivo hoja

- **Estado**: Aceptada (2026-09-16, issue 13 / PR #29)
- **Dónde vive**: `frontend/src/api/prefijo.ts`, que leen `frontend/src/api/cliente.ts` y `frontend/vite.config.ts`

## Contexto

La raíz de la API que consulta el portal, `/rentas/api/v1`, la necesitan dos piezas: el cliente HTTP
(`src/api/cliente.ts`), que compone con ella cada petición, y el `server.proxy` de desarrollo
(`vite.config.ts`), que enruta con ella hacia el backend. En `rentas` la cadena está escrita en los dos
sitios. Con dos copias, cada mitad funciona sola y el desajuste **solo aparece con las dos puestas a la
vez**: la petición sale a una ruta, el proxy espera otra, y el servidor de Vite contesta el `index.html`
con un 200. La pantalla pide JSON y recibe HTML con un código de éxito: no parece un error, así que
nadie lo busca.

## Decisión

La raíz se escribe **una vez**, en `src/api/prefijo.ts`, un archivo **hoja**: sin un solo `import`. El
cliente la reexporta y `vite.config.ts` la importa de ahí.

Es `rentas` y no `ciudadano` porque el primer segmento dice **el sistema que responde**, no el que
pregunta (infrastructure ADR-0030 §2): `GET /portal/situacion` lo atiende el backend de `rentas`, y este
portal no tiene backend propio.

## Consecuencias

- El proxy y el cliente no pueden desalinearse: leen la misma constante.
- `prefijo.ts` no puede importar nada, nunca. Lo vigila `frontend/verificaciones/camino-a-la-api.test.ts`
  («se escribe una sola vez, en `src/api/prefijo.ts`», sin líneas `import`), junto con que el cliente y
  `vite.config.ts` no vuelvan a escribirla.

## Qué se midió

Con `PREFIJO` importado de `src/api/cliente.ts` en vez de la hoja, `yarn build` sale con rc=1 **antes de
leer un solo archivo de `src/`**:

    failed to load config from …/frontend/vite.config.ts
    error during build:
    TypeError: Cannot read properties of undefined (reading 'VITE_KAMAYUK_OIDC_REALM')

Vite empaqueta su configuración con esbuild y la ejecuta en Node, donde `import.meta.env` no existe; y
`cliente.ts` arrastra `identidad.ts` y con él `configuracion.ts`, que lee `import.meta.env.VITE_*`.

## Qué se descartó

- **La cadena escrita en los dos sitios**, como en `rentas`: es el defecto del «200 que miente» de
  arriba.
- **La constante dentro de `cliente.ts`**, que sería su sitio natural: es el rc=1 medido.
