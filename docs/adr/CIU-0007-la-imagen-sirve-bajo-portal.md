# CIU-0007 — La imagen sirve bajo `/portal/`, sin redirigir y sin publicar nada sucio

- **Estado**: Aceptada (2026-09-23, issue 37 / PR #48; las marcas de la demostración, issue 58 / PR #69)
- **Dónde vive**: `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore` y
  `frontend/imagen/`; lo vigilan `frontend/verificaciones/imagen-y-despliegue.test.ts`,
  `frontend/verificaciones/lo-servido-esta-limpio.test.ts` y `frontend/e2e/el-dist-de-la-imagen-esta-limpio.spec.ts`

## Contexto

El portal se empaqueta en una imagen portada de `rentas/frontend/Dockerfile` (rentas#44, rentas#75). En
`rentas` el ingreso quita el prefijo (`stripPrefix`) y nginx sirve en `/`, con `try_files $uri /index.html`
para que recargar en una ruta funcione; eso hace también que un `.js` que falta llegue como HTML con un
200 (pantalla en blanco, «Unexpected token '<'»).

## Decisión

- **Se sirve BAJO `/portal/`**: `base: '/portal/'` en Vite, el `dist/` en `html/portal/` y nginx sirviendo
  desde `html/`. Las tres cosas las cruza `imagen-y-despliegue.test.ts`. Lo que no cuelgue de `/portal/`
  da 404 diciendo que alguien quitó el prefijo.
- **Sin repliegue al `index.html`**: las rutas viven en el hash, así que el navegador pide siempre
  `/portal/`. Lo que no existe da 404; solo `/portal/` cae al `index.html`.
- **Todo 404 por `@no_existe`, con `no-store`**: un 404 guardado sobrevive al arreglo.
- **Ninguna redirección** (`/portal` sin barra da 404, no 301): una redirección la resuelve el navegador
  contra el `Host` y el puerto que el contenedor cree tener, que detrás de un ingreso no son los de fuera.
  Ni reenvío a la API: el mismo origen lo pone el ingreso.
- Las tres cabeceras de seguridad, **con `always` en cada `location`** (`add_header` no se hereda).
  `X-Frame-Options: DENY` en todos los bloques salvo `silencio.html`, que es `SAMEORIGIN` porque se dibuja
  en el marco del canje silencioso (CIU-0003), y `no-store` porque su URL trae el `code` y el `state`.
  `configuracion.js`, `no-store`; los activos con huella, un año y **sin** `always`.
- **La última etapa no se construye si lo servido está sucio**: `imagen/lo-servido-esta-limpio.sh`, corrido
  después del último `COPY`, sale en rojo ante un mapa de símbolos, código fuente, una copia byte a byte de
  `src/` o `diseno/` (salvo el escudo), el artboard o la captura del backend pegados, o —desde el issue
  58— los datos de la demostración, por las marcas que escribe la etapa de construcción.
- La etapa de construcción parte de `node:24-alpine` —la mayor del `.nvmrc`, y el quinto sitio que vigila
  `el-motor-es-uno-solo.test.ts`— y lleva `kamayuk-lib` por **contexto con nombre**, del que copia solo
  `paquetes/`. La que sirve va clavada (`nginx:1.31.5-alpine`), como el uid 101.

## Consecuencias

- El ingreso **no** tiene que quitar el prefijo; publicar la imagen y enrutar `/portal` hacia ella es de
  `infrastructure`, y no se hace desde aquí.
- `configuracion.js` se sustituye sin reconstruir, montando otro encima.
- El arnés mide el bundle servido por `vite preview`, no la imagen; la imagen se probó con `docker build`
  y `docker run`, y la salida está en el PR del issue 37.

## Qué se midió

- Con `always` en la caché de los activos, un 404 salía con `immutable` dentro (rentas#44).
- Tres `Dockerfile` rotos por `-f` (un `COPY` de `src/`, sin `sin-mapas.sh`, el artboard copiado a
  `assets/`): los tres salen con rc=1 en la etapa `interfaz`, «LO SERVIDO NO ESTA LIMPIO».
- El issue pedía «Node 22 (la que declara `engines`)»; `engines` dice 24 desde el issue 39, y lo que el
  issue quería era la de `engines`.

## Qué se descartó

- **Servir en la raíz y confiar en `stripPrefix`**, como `rentas`: la avería del prefijo sería muda.
- **`try_files … /index.html`**: el «200 que miente».
- **La comprobación como `grep` dentro del `Dockerfile`**: un guion aparte se demuestra fallando sin Docker.
