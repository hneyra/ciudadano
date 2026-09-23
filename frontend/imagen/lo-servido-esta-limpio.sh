#!/bin/sh
#
# Lo que nginx va a servir no lleva el artboard, ni las capturas, ni mapas, ni nada de `src/` (issue 37).
#
# Uso: sh imagen/lo-servido-esta-limpio.sh <lo servido> <el frontend>
#
#   · <lo servido>   el directorio que se publica: en la imagen, `/usr/share/nginx/html` ENTERO, no
#                    solo `portal/` —lo que se copie al lado tambien se sirve—.
#   · <el frontend>  un arbol con `src/` y `diseno/` contra el que comparar: en la imagen, la etapa de
#                    construccion montada; en local, `frontend/`.
#
# Sale con 0 si esta limpio, con 1 nombrando cada cosa que encontro, y con 2 si no puede comparar.
#
# ## Por que un guion, y por que corre DENTRO de la imagen
#
# La leccion de rentas#44: una comprobacion sobre un artefacto intermedio no afirma nada del que se
# publica. Alli, con la comprobacion en la etapa de construccion, un `COPY` de `src/` en la ultima
# etapa servia `/src/api/identidad.ts` con 200 y el `docker build` salia en VERDE. Asi que esto corre
# en la etapa `interfaz`, despues de su ultimo `COPY`, y una imagen sucia no se construye.
#
# Y es un guion, y no una lista de `grep` en el `Dockerfile` como en `rentas`, para poder demostrar
# que muerde sin Docker: `verificaciones/lo-servido-esta-limpio.test.ts` lo corre sobre muestras
# sucias, y `e2e/el-dist-de-la-imagen-esta-limpio.spec.ts` sobre un paquete construido como la imagen.
#
# ## Lo que busca, y por que por CONTENIDO y no solo por nombre
#
#   1. Mapas de simbolos (`*.map`) y comentarios que apuntan a uno: llevan el codigo fuente entero.
#   2. Codigo fuente por su extension (`.ts`, `.tsx`, `.mts`, `.cts`) y directorios que solo existen
#      en el arbol de trabajo (`src`, `diseno`, `e2e`, `verificaciones`, `node_modules`).
#   3. **Copias byte a byte** de cualquier archivo de `src/` o de `diseno/` —el artboard, el escudo,
#      las capturas de `diseno/medidas/`—, se llamen como se llamen: Vite renombra lo que emite
#      (`escudo-catacaos-<huella>.png`), asi que buscar por nombre no ve una copia renombrada.
#   4. **Contenido pegado** dentro de otro archivo: un `import … from '…dc.html?raw'` metería el
#      artboard entero dentro de un `.js` con otra huella. Para eso, las MARCAS de abajo: una cadena
#      que solo existe en su origen. El guion comprueba antes que la marca SIGA en su origen —una
#      marca que ya no esta en el artboard busca algo que no existe, y es una guarda que no puede
#      fallar (paso en `rentas` con «SULLON VILCHEZ»)—.
#
# Lo que NO busca: los datos del artboard que `src/datos/demostracion.ts` porta. Hoy SI viajan en el
# paquete de produccion —el recorrido arranca con ellos, ver `la-demostracion-no-viaja-al-bundle.test.ts`—
# y sacarlos es otra entrega. Esto vigila los ARCHIVOS de diseno, no los datos que se copiaron de ellos.
#
# POSIX y busybox: corre en `nginx:*-alpine` y en la maquina de quien verifica.
set -eu

servido=${1:?uso: lo-servido-esta-limpio.sh <lo servido> <el frontend>}
fuente=${2:?uso: lo-servido-esta-limpio.sh <lo servido> <el frontend>}

[ -d "$servido" ] || { echo "lo-servido-esta-limpio.sh: «$servido» no es un directorio" >&2; exit 2; }

# Sin fuentes no hay con que comparar, y «no hay ninguna copia de src/» seria verdad de la peor
# manera. Se exige `src/main.tsx`, que es por donde entra el paquete.
if [ ! -f "$fuente/src/main.tsx" ] || [ ! -d "$fuente/diseno" ]; then
  echo "lo-servido-esta-limpio.sh: no hay fuentes con las que comparar en «$fuente» (falta src/main.tsx o diseno/)" >&2
  exit 2
fi

# Los nombres de archivo de un `dist/` no llevan espacios, pero los de `diseno/` podrian: se parte
# por lineas y no por blancos.
IFS='
'
informe=''
anota() {
  informe="${informe}  $1
"
}
relativo() {
  printf '%s' "${1#"$servido"/}"
}

# ── 1. Mapas, y comentarios que apuntan a uno ────────────────────────────────────────────────
for f in $(find "$servido" -type f -name '*.map'); do
  anota "mapa de simbolos: $(relativo "$f")"
done
for f in $(grep -rlE '^(//|/\*)# sourceMappingURL=' "$servido" || true); do
  anota "apunta a un mapa: $(relativo "$f")"
done

# ── 2. Codigo fuente por su extension, y directorios del arbol de trabajo ───────────────────
for f in $(find "$servido" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.cts' \)); do
  anota "codigo fuente: $(relativo "$f")"
done
for d in $(find "$servido" -type d \( -name src -o -name diseno -o -name e2e -o -name verificaciones -o -name node_modules \)); do
  anota "directorio que no se sirve: $(relativo "$d")"
done

# ── 3. Copias byte a byte de `src/` y de `diseno/` ──────────────────────────────────────────
#
# La UNICA exencion: el escudo, que la barra y el recibo importan y Vite emite tal cual con su huella.
# `verificaciones/lo-servido-esta-limpio.test.ts` exige que algun archivo de `src/` lo siga
# importando: una exencion que ya nadie usa es una puerta abierta.
eximidos=''
exime() {
  eximidos="${eximidos}$1
"
}
exime 'diseno/escudo-catacaos.png'

# Una sola pasada de `sha256sum` por lado y un `awk` que las cruza: un `sha256sum` por archivo de
# `src/` —mas de cien— tardaba segundo y medio por llamada, y la prueba la llama doce veces.
temporal=$(mktemp -d)
trap 'rm -rf "$temporal"' EXIT
printf '%s' "$eximidos" > "$temporal/eximidos"
(cd "$fuente" && find src diseno -type f -size +0c -exec sha256sum {} +) > "$temporal/fuente"
find "$servido" -type f -exec sha256sum {} + > "$temporal/servido"
for linea in $(awk -v servido="$servido/" -v eximidos="$temporal/eximidos" -v fuentes="$temporal/fuente" '
  # `sha256sum` escribe «<huella>  <ruta>»: la ruta es lo que queda tras los dos espacios.
  function ruta(l) { return substr(l, index(l, "  ") + 2) }
  FILENAME == eximidos { if ($0 != "") eximido[$0] = 1; next }
  FILENAME == fuentes  { r = ruta($0); if (!(r in eximido) && !($1 in de)) de[$1] = r; next }
  ($1 in de) {
    r = ruta($0)
    if (index(r, servido) == 1) r = substr(r, length(servido) + 1)
    print "copia de " de[$1] ": " r
  }
' "$temporal/eximidos" "$temporal/fuente" "$temporal/servido"); do
  anota "$linea"
done

# ── 4. Contenido pegado dentro de otro archivo: las marcas ──────────────────────────────────
marca() {
  origen=$1
  texto=$2
  if ! grep -qF -- "$texto" "$fuente/$origen"; then
    echo "lo-servido-esta-limpio.sh: la marca «$texto» ya no esta en $origen; busca algo que no existe y no puede fallar. Elige otra." >&2
    exit 2
  fi
  for f in $(grep -rlF -- "$texto" "$servido" || true); do
    anota "contenido de $origen («$texto»): $(relativo "$f")"
  done
}
# El bloque del artboard que `los-artboards-estan.test.ts` exige, y su andamiaje del entorno de diseno.
marca 'diseno/Ciudadano.dc.html' '<x-dc'
marca 'diseno/Ciudadano.dc.html' 'DCLogic'
# La nota que el backend devolvio el 2026-09-16: es prosa del servidor, no la escribe el portal.
marca 'diseno/medidas/situacion-2026-09-16.json' 'no se puede dar un total de todo'

if [ -n "$informe" ]; then
  printf 'LO SERVIDO NO ESTA LIMPIO. En «%s»:\n%s' "$servido" "$informe" >&2
  exit 1
fi
echo "lo servido esta limpio: sin mapas, sin codigo fuente, sin copias de src/ ni de diseno/ (salvo el escudo) y sin el artboard ni la captura dentro"
