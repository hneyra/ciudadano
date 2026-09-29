# CIU-0003 — Recargar no echa: el canje silencioso con `prompt=none` en un marco oculto

- **Estado**: Aceptada (2026-09-23, issue 35 / PR #45; ampliada en el issue 56 / PR #66)
- **Dónde vive**: `frontend/src/api/silencio.ts`, `frontend/public/silencio.html`, `frontend/src/arranque.ts`
  y la variante «quisimos comprobar si ya había entrado» de `frontend/src/aplicacion.tsx`

## Contexto

El token vive **solo en memoria** —la prohibición `token-en-almacenamiento` y
`frontend/verificaciones/el-token-vive-en-memoria.test.ts`—, así que recargar la página lo pierde. En
un portal al que la gente llega de un enlace, recarga, o vuelve del banco, eso se vive como «me echó».
Guardar el token es justo lo prohibido; lo correcto es volver a pedirlo **sin molestar** mientras la
sesión del EMISOR siga viva, que es la que se guarda en su cookie y no en la nuestra.

A diferencia de `rentas` y `catastro`, este portal **no va a la puerta al arrancar**: sin
identificarse hay mucho que enseñar (el recorrido de demostración entero), y a la puerta se va cuando
alguien lo pide.

## Decisión

- Con plataforma, sin vuelta del emisor, sin token, con `crypto.subtle` y **sin haber salido** en esta
  pestaña (`vieneDeSalir()`), `arrancar()` pregunta al emisor **una vez por carga** desde un `<iframe>`
  oculto hacia su autorización con `prompt=none` (OIDC Core §3.1.2.1), `response_mode=query` y PKCE
  S256. El emisor no puede enseñar su formulario: contesta al instante con un `code` o con
  `login_required` (o `interaction_required`, `consent_required`, `account_selection_required`).
- La vuelta cae en `public/silencio.html`, que solo le pasa su búsqueda a la ventana de arriba con
  `postMessage(…, location.origin)`. Se acepta si el **origen** es el propio, la **ventana** es la del
  marco y el **`state`** es el mandado.
- `code` → canje contra el endpoint de token (el único `fetch` de `src/api/`) y `fijarToken(access, id)`,
  lo mismo que deja el canje de la librería. Los cuatro errores de «no hay sesión» → anónimo. Cualquier
  otro error, o `ESPERA_DEL_EMISOR` (8 s) sin contestación → fallo, que la pantalla dice sin afirmar
  «Volvimos», porque nadie fue a ningún sitio. Si preguntar **revienta**, también se dice.
- **Un único plazo** para el reto, el marco y el canje; si ya venció al abrir el marco, ni se abre.
- Se monta **después** de preguntar (el recorrido decide al montar si hay sesión); si tarda más de
  `UMBRAL_DE_ESPERA` (300 ms) se dibuja «Comprobando su sesión…».
- Desde el issue 56, cancelar en el formulario (`?error=access_denied`) tampoco es un error: monta
  anónimo, con la misma función (`leerElError()`) que decide los errores del marco.

## Consecuencias

- El verificador y el `state` viven en la closure de `intentar()`: nada nuevo en `sessionStorage`, y la
  lista de lo que se guarda no crece.
- Se compone aquí y no en `@kamayuk/sesion`, que no trae `prompt=none` y no se toca desde este
  repositorio. Se usa lo que la librería sí expone —`configuracionDeLaPuerta()` y `fijarToken`— y se
  escribe el resto (el reto S256, el base64url y el canje), con las mismas líneas que
  `paquetes/sesion/identidad.ts` de kamayuk-lib `a6ea6fa`. Si la librería publica un canje silencioso,
  `silencio.ts` se borra.
- `silencio.html` es otra página y no la del portal: la del portal, cargada en el marco, arrancaría el
  portal entero ahí dentro. Cabe en los `redirectUris` `…/portal/*` del client `kamayuk-portal`
  (`infrastructure/despliegue/identidad/realm-kamayuk-ciudadano.json`). nginx la sirve `no-store` y con
  `X-Frame-Options: SAMEORIGIN`, la única (CIU-0007).
- Fuera: refrescar el token a mitad de sesión, cerrar la del emisor desde el marco, y los navegadores
  que bloquean las cookies de terceros del emisor (ahí el marco contesta `login_required`: anónimo).

## Qué se midió

- 8 s es la espera de la sonda de `@kamayuk/sesion` (`ESPERA_DE_LA_SONDA`, rentas#112): menos manda a
  la pantalla de error a quien solo iba por un enlace lento; más, y quien mira ya cree que está roto.
  Un marco hacia un emisor apagado no avisa de nada, así que el tope es la única forma de saberlo.
- **El plazo que vence antes del marco** (ronda 2 del PR #45): con el reto S256 tardando 40 ms y un
  plazo de 10, el `abort` ya había pasado cuando el marco se ponía a escucharlo, y la página se quedaba
  en «Comprobando su sesión…». Era la causa de un «Test timed out» intermitente de
  `arranque.plataforma.test.tsx`.
- **Un plazo por etapa** duplicaba el peor caso (el canje estrenaba el suyo tras esperar al marco):
  «el canje siguió esperando después del tope del intento».
- En el arnés, el emisor falso olvida la sesión al cerrar (como el de verdad con `id_token_hint`), así
  que `vieneDeSalir()` se mide contando las preguntas silenciosas: sin él, «Expected: 1 Received: 3».

## Qué se descartó

- **Redirigir la página entera** con `prompt=none` (decisión del 2026-09-23): con el marco la página no
  se va, así que no hay bucle posible —nada vuelve a arrancar el portal—, ni parpadeo de ida y vuelta,
  ni cambio en la barra de direcciones.
- **Guardar el token** para sobrevivir a la recarga: es lo prohibido.
- **Ir a la puerta al arrancar**, como `rentas`: el modo demostración dejaría de existir, y quien entra
  a mirar se encontraría un formulario de Keycloak antes de ver nada.
