#!/bin/sh
#
# Retira los mapas de simbolos de un `dist/`, y los comentarios que apuntarian a ellos (issue 37).
#
# Uso: sh imagen/sin-mapas.sh <dist>
#
# Portado del `RUN find dist -name '*.map' -delete …` de `rentas/frontend/Dockerfile` (rentas#44), y
# sacado a un guion por una sola razon: que la imagen y el arnes hagan LO MISMO. La imagen lo corre
# despues de `yarn build`; `e2e/el-dist-de-la-imagen-esta-limpio.spec.ts` lo corre sobre un paquete
# construido igual, y con dos copias del mismo `find` la que se quedaria vieja es la del arnes.
#
# `vite.config.ts` pide `build.sourcemap: true` y no se toca: que el paquete se pueda depurar en
# local importa, y todo lo que ya se mide contra `yarn build` tiene que seguir dando lo mismo. Pero un
# `.map` lleva el codigo fuente ENTERO dentro, y en un portal publico eso es regalarselo a cualquiera
# que abra las herramientas del navegador. Asi que se quitan aqui, que es donde importa.
#
# Y el comentario `sourceMappingURL` se va con ellos: dejarlo apuntando a un archivo que ya no esta
# daria un 404 en la consola de cada navegador que abriera las herramientas.
#
# POSIX y busybox: corre en `node:*-alpine`, en `nginx:*-alpine` y en la maquina de quien verifica.
set -eu

dist=${1:?uso: sin-mapas.sh <dist>}
[ -d "$dist" ] || { echo "sin-mapas.sh: «$dist» no es un directorio" >&2; exit 2; }

find "$dist" -type f -name '*.map' -exec rm -f {} +
find "$dist" -type f -name '*.js' -exec sed -i '/^\/\/# sourceMappingURL=/d' {} +
find "$dist" -type f -name '*.css' -exec sed -i '/^\/\*# sourceMappingURL=.*\*\/$/d' {} +
