# ciudadano

El **portal publico de pago de tributos** de **Kamayuk** para la Municipalidad Distrital de Catacaos:
la cara que ve el contribuyente, no la ventanilla. Busca su deuda, elige que pagar, deja un correo o
entra a su cuenta, paga con uno de cuatro medios y se lleva un comprobante que se imprime solo.

> **Dos modos, y la bandera es de construccion.**
>
> · **Demostracion** (`yarn dev`): sin backend ni login real. Los datos salen de `frontend/src/datos/`,
>   ningun medio cobra y cualquier documento y clave «entran». Es el recorrido del artboard, de cinco
>   pasos, y es lo que el arnes recorre.
> · **Con plataforma** (`yarn dev:con-plataforma`, y el paquete de produccion): se entra con la cuenta
>   del portal —Keycloak, realm `kamayuk-ciudadano`— y la deuda la contesta `GET /portal/situacion`. El
>   recorrido es de **cuatro** pasos: Entrar → Elegir que pago → Pagar → Comprobante. **El pago sigue
>   simulado y se dice**: no hay endpoint de cobro, las dos ultimas pantallas lo avisan, no se ofrece
>   ningun medio de pago, el comprobante es una vista de ejemplo y **la deuda no cambia**.
>
> Hoy, contra la plataforma local, la respuesta real es «no se pudo consultar»: `catastro` contesta 401
> al token del ciudadano, asi que `rentas` no puede componer el total. Es backend, y de otros
> repositorios.
>
> Nada se despliega.

Todo lo que hace falta saber para trabajar aqui —que hay, que no, el stack, las reglas, las
verificaciones y como se demostro que cada una muerde— esta en [`CLAUDE.md`](CLAUDE.md).

## Requisitos

- Node 22 y yarn classic (1.x).
- **`kamayuk-lib` clonado al lado de este repositorio, y en `main`**: `frontend/package.json` enlaza
  `@kamayuk/{formato,ui,verificaciones}` con `link:../../kamayuk-lib/paquetes/*`. Sin el hermano,
  `yarn install` sale con codigo 0 igual y lo primero que se rompe lo dice nombrando el `git clone`.

```bash
git clone https://github.com/hneyra/kamayuk-lib ../kamayuk-lib   # desde la raiz de este repositorio
```

## Comandos

```bash
cd frontend
yarn install                 # con ../../kamayuk-lib en su sitio
yarn dev                     # http://localhost:5174/portal/ en modo demostracion
yarn dev:con-plataforma      # lo mismo, leyendo de la plataforma (Keycloak + backend)
yarn verificar               # lint, tipos, i18n y pruebas de vitest. Sin navegador
yarn build                   # el bundle en dist/; FALLA si algun trozo de JavaScript pasa de 500 kB
yarn e2e:navegador           # una vez: descarga el Chromium que pide la version de Playwright del yarn.lock
yarn e2e                     # construye el bundle, lo sirve y lo recorre en Chromium (Playwright)
```

`yarn e2e` mide **los bundles construidos** (`vite build` + `vite preview`), no `yarn dev`. Construye y
sirve **dos**: el de demostracion, que recorre el artboard, y el de produccion —o sea, el de
plataforma—, que recorre `e2e/recorrido-con-plataforma.spec.ts` contra un backend falso que pone el
propio arnes (`page.route`: el emisor de identidad y `GET /portal/situacion`). Su puerto sale
de la ruta del arbol —lo anuncia al empezar, y si esta ocupado dice quien lo tiene—; en CI es el 4173, y
`KAMAYUK_E2E_PUERTO=<n> yarn e2e` pide otro. El informe, con las trazas de lo que falle y las capturas
de la vista de impresion, queda en `frontend/playwright-report/`.

La CI (`.github/workflows/frontend.yml`) corre `verificar` —`yarn verificar` y `yarn build`— y, si pasa,
`arnes` —`yarn e2e` en Chromium, con el informe como artefacto `informe-del-arnes`—.

## Pantallas y artboard

La referencia de diseno es `frontend/diseno/Ciudadano.dc.html`. Cada pantalla es un trozo del bundle
(`frontend/src/pasos/pantallas.tsx`) y cuelga de una ruta hash:

| Ruta | Pantalla | Codigo | Artboard (lineas de la plantilla) |
|---|---|---|---|
| — | Barra, franja de pasos y pie | `src/marco/` | 59-101 (barra), 103-116 (franja), 675-684 (pie) |
| `#/entrar` | 1 · Entrar (**solo con plataforma**) | `src/pasos/entrar/Entrar.tsx` | — (no esta en el artboard) |
| `#/buscar` | 1 · Buscar mi deuda (**solo en demostracion**) | `src/pasos/buscar/Buscar.tsx` | 121-180 «1 · BUSCAR» |
| `#/deudas` | 2 · Elegir qué pago | `src/pasos/deudas/Deudas.tsx`, y `LaConsulta.tsx` con plataforma | 182-309 «2 · DEUDAS» |
| `#/identificar` | 3 · Mis datos (**solo en demostracion**) | `src/pasos/identificar/Identificar.tsx` | 311-354 «3 · IDENTIFICAR» |
| `#/pagar` | 4 · Pagar | `src/pasos/pagar/Pagar.tsx` | 356-475 «4 · PAGAR» |
| `#/comprobante` | 5 · Comprobante | `src/pasos/comprobante/Comprobante.tsx` | 477-565 «5 · LISTO» |
| `#/historial` | Mis pagos (con sesion) | `src/pasos/historial/Historial.tsx` | 567-671 «HISTORIAL (con sesión)» |

El estado del recorrido vive en memoria: escribir `#/pagar` sin haber buscado lleva a `#/buscar` —o a
`#/entrar`, con plataforma—. Y con plataforma, `#/buscar` y `#/identificar` no son alcanzables: el
backend ya no ofrece buscar por documento (ADR-0020) y a quien entro con su cuenta no se le vuelve a
preguntar quien es.
