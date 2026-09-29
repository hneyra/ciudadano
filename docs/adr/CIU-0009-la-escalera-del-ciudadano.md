# CIU-0009 — La escalera de identidad, dicha al ciudadano

- **Estado**: Aceptada (2026-09-16, issue 13 / PR #29; el 409 y el orden no admitido, issue 33 / PR #41;
  la respuesta ilegible, issue 34 / PR #44)
- **Dónde vive**: `frontend/src/api/escalera.ts` (`TEXTOS_DEL_PORTAL`, `peldanoDelPortal`) y los finales
  de la consulta (`frontend/src/pasos/deudas/FinalesDeLaConsulta.tsx`)

## Contexto

`peldanoDe` de `@kamayuk/sesion` clasifica un fallo de la API —en qué peldaño se quedó la petición, si
hay que volver a la puerta y si es avería— por el `codigo` del contrato, igual en los cinco sistemas del
producto. Sus textos están escritos para quien atiende en ventanilla: «avise a soporte», «lo asigna el
administrador del sistema», «pida el permiso a quien administre los perfiles». A quien entra a pagar su
predial no hay soporte al que avisar, ni administrador que conozca, ni perfiles que pedir: hay una
ventanilla a la que ir con el DNI.

## Decisión

- De la librería se toma **la clasificación** (`clave`, `pideIdentidad`, `esAveria`); los **textos** son
  del portal, en `TEXTOS_DEL_PORTAL`, completos por el tipo (`Record<ClaveDelPeldano, …>`): un peldaño
  nuevo de la librería no compila hasta que aquí se decide qué decir.
- Los textos son dato y los traduce quien los dibuja: `peldanoDelPortal` recibe `t()` y devuelve el
  peldaño ya traducido, y el locale los deriva de `clavesDeLaEscalera()`.
- Lo que escribió el backend (`mensaje`) no se enseña, ni los tres miembros que `ErrorDeLaApi` conserva
  desde kamayuk-lib#96 (`incidencia`, `detalles`, `parametroQueFalta`): no hay soporte al que dar una
  incidencia ni telemetría donde registrarla, el ciudadano no pidió ningún orden, y la hoja de
  Publicación de `normativa` no es de este portal.
- Un peldaño **del portal** que no dará ninguna librería: `respuesta-ilegible` (CIU-0004), que
  `peldanoDelPortal` reconoce **antes** de preguntar a `peldanoDe`, que lo tomaría por un corte de red.
- El 409 (`conflicto`) y el 422 `ORDEN_NO_ADMITIDO` tienen texto propio que **no promete que insistir
  arregle nada** (issue 33).

## Consecuencias

- `ClaveDelPeldano` es `Peldano['clave'] | 'respuesta-ilegible'`: un superconjunto, así que la tabla sigue
  completa respecto de la librería.
- `escalera.test.ts` mide los peldaños que la librería enlazada distingue llamando a `peldanoDe`, y exige
  que lo único sin distinguir sean los del portal.

## Qué se midió

- El issue 33 decidió `conflicto` y `orden-no-admitido` **antes** de que la librería los diera: la unión
  del portal los nombraba como literales propios, y kamayuk-lib#96 se mezcló pareado con esa rama. Con
  la librería mezclada (`a6ea6fa`, ancestro del SHA fijado `2e078e4`), el issue 64 quitó los dos
  literales, que ya eran redundantes: `typecheck` y las pruebas en verde, y la tabla sin `conflicto` sigue
  sin compilar («Property 'conflicto' is missing … in type 'Readonly<Record<ClaveDelPeldano, TextosDelPeldano>>'»).
- Hasta #96 el 409 caía en `averia` —«vuelva a intentarlo en unos minutos», el remedio contrario: volver
  a pedir lo mismo trae el mismo 409—, y el 422 `ORDEN_NO_ADMITIDO` compartía texto con `no-valido`
  —«revise lo que escribió», cuando el orden lo pidió la pantalla—.

## Qué se descartó

- **Los textos de la librería**: hablan como la ventanilla.
- **Un respaldo para el peldaño que falte**: saldría con el texto de funcionario, o con `undefined`; el
  tipo completo lo evita.
