# Medidas: respuestas reales de la plataforma, tal cual llegaron

Lo que hay aquí **no es diseño**: son respuestas del backend **medidas** contra la plataforma local,
guardadas byte a byte para que el adaptador se escriba contra lo que el servidor contesta y no
contra lo que el contrato promete. Cuando las dos cosas no cuadran, **gana lo medido**.

Viven al lado del artboard, en `frontend/diseno/`, por la misma razón que él: viajan en el árbol y
no se descargan al verificar. Una prueba que dependiera de la red no es una prueba.

## `situacion-2026-09-16.json`

`GET /rentas/api/v1/portal/situacion`, HTTP **200**, el 16 de setiembre de 2026, contra la
plataforma local.

Cómo se obtuvo:

- usuario **`dni-00000014`** del realm del ciudadano;
- cliente OIDC **`kamayuk-verificacion`**, del que salió el token que se mandó en `Authorization`;
- backend de `rentas` arrancado con las variables **`KAMAYUK_PORTAL_OIDC_*`** puestas (sin ellas la
  cadena del portal no acredita a nadie y el endpoint no llega a responder 200).

El contenido, entero:

```json
{"tipoDocumento":"DNI","numeroDocumento":"00000014","aLaFecha":"2026-09-16",
 "municipalidadesRecorridas":1,"totalConsolidado":null,
 "notaDelTotal":"No se pudo consultar Municipalidad Provincial de Sullana, asi que no se puede dar un total de todo.",
 "sinRegistros":true,"municipalidades":[]}
```

### Por qué llega vacía, y por qué no se arregla en este repositorio

`rentas` resuelve los predios llamando a `catastro` y **reenvía el token del ciudadano**
(`rentas:backend/kamayuk-rentas-catastro/src/main/java/kamayuk/rentas/catastro/infraestructura/ClienteHttpDeCatastro.java:350`).
Pero en `catastro` la cadena de seguridad del portal solo cubre `/catastro/api/v1/portal/**`
(`catastro:backend/kamayuk-catastro-plataforma/.../SeguridadWeb.java:170-173`) y la ruta que se
llama es de funcionario: contesta **401 siempre**. `rentas` trata esa municipalidad como rama no
leída, y por eso responde `totalConsolidado: null` con `notaDelTotal`, `sinRegistros: true` y
`municipalidades: []`.

Es un hueco del **backend**, en otros repositorios: aquí no se arregla ni se disimula. El portal
tiene que saber dibujar esta respuesta, que es justo lo que el adaptador clasifica como
`no-se-pudo-consultar` (`frontend/src/datos/deLaSituacion.ts`, issue 26).

### Quién la lee

`frontend/src/datos/deLaSituacion.test.ts`: la lee del disco —no una copia pegada en la prueba— y
exige que el adaptador la clasifique como `no-se-pudo-consultar`, sin deudas y sin inventar
cifras. Si alguien retoca este archivo, esa prueba lo dice.
