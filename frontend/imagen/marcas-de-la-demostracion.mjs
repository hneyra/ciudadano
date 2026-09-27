// Escribe, una por linea, las marcas de los datos del artboard (issue 58, revision).
//
// Uso: node imagen/marcas-de-la-demostracion.mjs > <archivo>
//
// Corre en la etapa `construccion` del `Dockerfile`, que tiene Node, y deja la lista donde la etapa
// `interfaz` —nginx, sin Node— la lee por el `--mount` que ya monta las fuentes: alli
// `lo-servido-esta-limpio.sh` busca cada una en lo que se va a servir. Las marcas NO se escriben aqui:
// salen de `verificaciones/marcas-de-la-demostracion.ts`, que las saca por campo de
// `src/datos/demostracion.ts`, las mismas que busca el arnes. Node 24 lee ese TypeScript quitandole los
// tipos, sin compilar nada.
import process from 'node:process';

import { marcasDeLaDemostracion } from '../verificaciones/marcas-de-la-demostracion.ts';

const marcas = marcasDeLaDemostracion();
if (marcas.length === 0) {
  // Una lista vacia haria verde la busqueda sin buscar nada.
  process.stderr.write('marcas-de-la-demostracion.mjs: no salio ninguna marca\n');
  process.exit(2);
}
process.stdout.write(`${marcas.join('\n')}\n`);
