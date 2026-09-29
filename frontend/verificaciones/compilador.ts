import { join } from 'node:path';

import ts from 'typescript';

import { RAIZ } from './artboards.ts';

/**
 * **Las opciones del compilador de este arbol**, leidas de `tsconfig.json` (issue 63).
 *
 * Las guardas que leen el codigo con TypeScript —los tipos del modo, el texto en el DOM, el grafo de
 * `import`— tienen que resolverlo como lo resuelve `tsc`: con `preserveSymlinks`, `moduleResolution`
 * y las extensiones `.ts` que este arbol escribe. Una copia de estas lineas por guarda es una copia
 * que se queda atras el dia que el `tsconfig.json` cambie; aqui se leen una vez, y cada guarda anade
 * encima solo lo suyo (`allowJs` para `public/`, por ejemplo).
 */
export function opcionesDelProyecto(ademas: ts.CompilerOptions = {}): ts.CompilerOptions {
  const leido = ts.getParsedCommandLineOfConfigFile(join(RAIZ, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  if (leido === undefined) throw new Error('No se pudo leer tsconfig.json');
  return { ...leido.options, noEmit: true, ...ademas };
}
