# Capturas del issue 27 — el portal contra la plataforma local

Medidas el **2026-09-16** con `yarn dev:con-plataforma` (`http://localhost:5174/portal/`), la
plataforma local levantada (Keycloak en `:18180`, realm `kamayuk-ciudadano`, client
`kamayuk-portal`; Traefik en `:18080`) y la cuenta de prueba `dni-00000014`.

| archivo | qué se ve |
| --- | --- |
| `1-con-plataforma-sin-sesion.png` | Con plataforma y sin sesión: la consulta sale sin token, el backend contesta **401** y el paso 1 dibuja el peldaño del ciudadano —«Su sesión ya no está abierta»— con su botón «Entrar». Debajo sigue el formulario de siempre. |
| `2-keycloak-realm-del-ciudadano.png` | «Entrar» lleva al formulario del realm `kamayuk-ciudadano` (código de autorización con PKCE S256). |
| `3-con-sesion-401-del-backend.png` | De vuelta, **con** token: la barra ya dice quién entró y la consulta sigue en 401 — el backend de `rentas` rechaza hoy el token del client `kamayuk-portal`. Es el hueco de backend que este repositorio no arregla. |
| `4-la-barra-con-los-claims.png` | El nombre y el documento de la barra salen de los claims del token (`DEMO Querevalu Eche`, `DNI 00000014`), no de `USUARIO` del artboard. |

## Lo medido en la red, tal cual

```
PETICION  GET /rentas/api/v1/portal/situacion   authorization: (NO VA)
RESPUESTA 401 {"status":401,"title":"La peticion no trae un token valido","codigo":"NO_AUTENTICADO",…}

PETICION  GET /rentas/api/v1/portal/situacion   authorization: Bearer eyJhbGciOiJSUzI1NiIsInR… (1578 car.)
RESPUESTA 401 {"status":401,"title":"La peticion no trae un token valido","codigo":"NO_AUTENTICADO",…}
```

O sea: el portal **manda el token**, y aun así el backend contesta 401. La respuesta 200 vendorizada
en `frontend/diseno/medidas/situacion-2026-09-16.json` se obtuvo con otro client
(`kamayuk-verificacion`) y con las variables `KAMAYUK_PORTAL_OIDC_*` puestas en el backend de
`rentas`. Con el client del portal, hoy, no se llega al 200.
