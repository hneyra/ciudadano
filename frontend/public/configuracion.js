/*
 * Las senias del ambiente, servidas y no horneadas. Ver `src/api/configuracion.ts`.
 *
 * ESTE ARCHIVO VIAJA VACIO A PROPOSITO, y esa es toda su razon de ser. Portado de
 * `rentas/frontend/public/configuracion.js` (rentas#44), con el global de ESTE portal.
 *
 * Es el que la imagen —el dia que la haya— trae dentro. En un despliegue, un `ConfigMap` se monta
 * ENCIMA de el y lo reemplaza con las senias de la municipalidad; en `yarn dev`, en el arnes y en
 * las pruebas se sirve este, no fija ninguna llave, y la cadena de `configuracion()` cae al
 * escalon siguiente.
 *
 * Que exista aunque este vacio es la decision. La alternativa —no ponerlo, y que el servidor
 * conteste 404 mientras nadie monte el `ConfigMap`— cuesta dos cosas: un error en la consola del
 * navegador en cada carga, que es ruido que acaba no mirandose (y que el arnes, que exige la
 * consola limpia, convertiria en un rojo que no habla de lo que pasa); y, peor, un 404 que el
 * `try_files` de un servidor mal configurado convierte en el `index.html` servido como si fuera un
 * guion — el fallo mas ruidoso posible disfrazado del mas silencioso.
 *
 * NO se le ponen valores por omision aqui. Los tiene `src/api/configuracion.ts`, en un solo sitio
 * y con su tipo: dos copias de «el emisor local es localhost:18180» se separan, y la que se
 * separaria es esta, que no la lee ningun compilador.
 *
 * Guion clasico y no modulo: `index.html` lo carga antes que el paquete, y un `type="module"` se
 * difiere hasta despues del analisis del documento — o sea que llegaria TARDE, cuando la puerta
 * de identidad ya hubiera leido las senias.
 */
window.__KAMAYUK_CIUDADANO__ = window.__KAMAYUK_CIUDADANO__ || {};
