# syntax=docker/dockerfile:1
#
# `ciudadano-web`: el portal publico de pago de tributos, compilado y servido como archivos estaticos
# bajo `/portal/` (issue 37).
#
# Portado de `rentas/frontend/Dockerfile` (rentas#44, rentas#75), que es el modelo y se lee antes de
# cambiar nada de aqui. Lo que cambia, y por que:
#
#   · **Se sirve BAJO `/portal/`**, no en la raiz: el `dist/` se copia a `html/portal/`. `rentas`
#     confia en que el ingreso quite el prefijo; aqui llega entero, que es lo que pide el issue, y
#     `nginx.conf` contesta 404 —diciendo por que— a todo lo que no cuelgue de `/portal/`.
#   · **La comprobacion de lo servido es un guion** (`imagen/lo-servido-esta-limpio.sh`), no una
#     lista de `grep` aqui dentro, para poder demostrar que muerde sin Docker. Y mira mas que la de
#     `rentas`: copias byte a byte de `src/` y de `diseno/`, el artboard pegado dentro de un `.js` y la
#     captura del backend.
#   · **No hay compose ni workflow de publicacion** que pasen el contexto con nombre: publicar y
#     enrutar la imagen es de `infrastructure`, y la CI de la cuenta esta bloqueada. La orden que la
#     construye esta en el `README.md`.
#
# Se construye desde `frontend/`, con el clon hermano por contexto con nombre:
#
#     docker build -t ciudadano-web --build-context kamayuk-lib=../../kamayuk-lib .
#
# ## Las dos etapas se tratan distinto a proposito (rentas#44)
#
# `construccion` se tira, asi que su base es la etiqueta movil `node:24-alpine`: el parche lo mueve
# Docker, y lo que fija lo que se instala es `yarn.lock` con `--frozen-lockfile`. **La MAYOR no es
# libre**: es la de `.nvmrc`. Un `FROM` no puede leerla —no admite sustitucion sin un `ARG`, y meterlo
# obligaria a pasarlo en cada sitio que construye—, asi que es una copia, y la vigila
# `verificaciones/el-motor-es-uno-solo.test.ts`, que cuenta esta linea como el quinto sitio que dice el
# motor. El issue pedia «Node 22 (la que declara `engines`)»; `engines` dice 24 desde el #39, y lo que
# el issue queria era la de `engines`.
#
# `interfaz` SI se publica, asi que su base va clavada: `nginx:1.31.5-alpine`, la misma de `rentas`.
# Es lo que deja que un escaneo diga de que version habla.

# ---------------------------------------------------------------------------
FROM node:24-alpine AS construccion

# EL `WORKDIR` REPRODUCE LA DISPOSICION DE CLONES HERMANOS, Y NO ES COSMETICO (rentas#75).
#
# `package.json` declara los `@kamayuk/*` como `link:../../kamayuk-lib/paquetes/*`, y yarn resuelve
# eso contra el DISCO. Para que la misma ruta relativa valga aqui dentro:
#
#     /obra/ciudadano/frontend  <- aqui, o sea `../../` = /obra
#     /obra/kamayuk-lib         <- ahi cae el contexto con nombre
#
# Acortarlo a `/obra/frontend` hace que `../../kamayuk-lib` resuelva a `/kamayuk-lib` y el
# `yarn install` falle. La profundidad la deriva `imagen-y-despliegue.test.ts` del `link:` declarado.
WORKDIR /obra/ciudadano/frontend

# EL CLON HERMANO, POR UN CONTEXTO CON NOMBRE DE BUILDKIT (rentas#75).
#
# El contexto principal es `frontend/` y el hermano vive dos niveles por encima, fuera de lo que
# Docker puede copiar. Lo pasa `--build-context kamayuk-lib=…`.
#
# SE COPIA `paquetes/` Y NADA MAS: un contexto con nombre entra por su propia raiz y **ningun
# `.dockerignore` lo acota** —el de aqui solo filtra el contexto principal—. `kamayuk-lib` no trae
# `.dockerignore`, y un `COPY --from=kamayuk-lib .` se llevaria su `node_modules`, su `.git` y
# cualquier `.env`.
COPY --from=kamayuk-lib paquetes/ /obra/kamayuk-lib/paquetes/

# Primero el manifiesto y el candado, y nada mas: la capa de dependencias se reutiliza mientras esos
# dos no cambien. `--frozen-lockfile`, lo mismo que exige la CI.
#
# Ojo con lo que NO garantiza: un `link:` a un directorio que no existe se instala con codigo 0 y sin
# avisar (medido en el issue 1). Aqui lo detecta `vite.config.ts` al importar `resolucion.ts`, que
# revienta nombrando el `git clone`; en `yarn verificar`, `enlace-con-kamayuk-lib.test.ts`.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# LA DEMOSTRACION, APAGADA Y DICHA (rentas#114; aqui, issue 27).
#
# Vite sustituye `import.meta.env.VITE_*` AL CONSTRUIR, asi que con la bandera en `false` la condicion
# de `src/datos/laFuente.ts` se pliega y el `import()` de la fuente de demostracion se cae del paquete.
#
# Es la primera de TRES vallas, y ninguna sobra: `vite build` no lee `.env.development`, pero «sale
# sin la demostracion porque nadie se acordo de encenderla» se pierde el dia que alguien cree un
# `.env.production`. La segunda es `.dockerignore`, que deja fuera todos los `.env*`. La tercera,
# `import.meta.env.DEV` delante de la bandera: en una construccion no hay modo desarrollo que valga.
ENV VITE_KAMAYUK_SIN_PLATAFORMA=false

RUN yarn build

# LOS MAPAS NO SE PUBLICAN: llevan el codigo fuente entero. El porque, en el guion; que corra aqui y
# despues del build, en `imagen-y-despliegue.test.ts`.
RUN sh imagen/sin-mapas.sh dist

# ---------------------------------------------------------------------------
FROM nginx:1.31.5-alpine AS interfaz

# La base trae su `index.html` de bienvenida y un `50x.html`. Se vacia antes de copiar para que lo
# servido sea EXACTAMENTE el `dist/` y nada mas (rentas#44).
RUN rm -rf /usr/share/nginx/html/*

# A `portal/`, porque `vite.config.ts` construye con `base: '/portal/'` y `nginx.conf` sirve desde
# `root /usr/share/nginx/html`: el `index.html` pide `/portal/assets/…` y nginx lo busca en
# `html/portal/assets/`. Las tres cosas las cruza `imagen-y-despliegue.test.ts`.
COPY --from=construccion /obra/ciudadano/frontend/dist/ /usr/share/nginx/html/portal/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# LO QUE SE SIRVE ESTA LIMPIO, comprobado AQUI y despues del ultimo `COPY` (rentas#44).
#
# Sobre `html/` ENTERO y no solo `portal/`: lo que se copie al lado tambien se sirve. Las fuentes con
# las que se compara, y el propio guion, llegan MONTADOS de la etapa de construccion: existen mientras
# corre este `RUN` y no se quedan en la imagen.
RUN --mount=type=bind,from=construccion,source=/obra/ciudadano/frontend,target=/fuente \
    sh /fuente/imagen/lo-servido-esta-limpio.sh /usr/share/nginx/html /fuente

# Sin root (rentas#44). La base trae `User` vacio: sin esto la interfaz correria como root. Y poner
# `USER` a secas no basta:
#
#   1. `/var/cache/nginx`: el maestro crea ahi sus temporales al arrancar; sin permiso, `[emerg]
#      mkdir() … failed (13: Permission denied)` y el contenedor no levanta.
#   2. `/etc/nginx`: dos guiones del entrypoint escriben ahi en cada arranque.
#   3. El pid, que por omision va a `/run/nginx.pid`: se manda a `/tmp`.
#
# `chown` a `nginx:0` y `chmod g=u`, por GRUPO, para que siga valiendo con un uid arbitrario del grupo
# 0, que es como despliega OpenShift. Y fuera `user nginx;`, que sin root es una directiva muerta que
# el arranque anuncia en cada reinicio.
RUN sed -i \
        -e '/^user  *nginx;/d' \
        -e 's#^pid .*#pid /tmp/nginx.pid;#' \
        /etc/nginx/nginx.conf \
    && chown -R nginx:0 /var/cache/nginx /etc/nginx \
    && chmod -R g=u /var/cache/nginx /etc/nginx

# EL UID EN NUMERO, no `USER nginx` (rentas#44): con `runAsNonRoot: true` el kubelet no puede
# comprobar un nombre y se niega a arrancar el contenedor con `CreateContainerConfigError`, que solo
# aparece al desplegar. El 101 es el del usuario `nginx` de la base.
USER 101
EXPOSE 8080

# Pide `/portal/index.html` POR SU NOMBRE: es lo unico que distingue «nginx levantado» de «nginx
# levantado sobre el `dist/` que se copio, donde se sirve». Si el `COPY` fallara, 404 y `unhealthy`.
# En forma JSON, sin shell: el `wget` de busybox ya sale con 1 ante un 4xx.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "--spider", "-q", "http://127.0.0.1:8080/portal/index.html"]
