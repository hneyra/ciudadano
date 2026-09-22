import type { core } from 'zod';

/**
 * **El servidor contesto, y lo que contesto no tiene la forma del contrato** (issue 34).
 *
 * Es el fallo con nombre de la frontera: lo lanza `leerLaSituacion` (`contrato.ts`) cuando la
 * respuesta de `GET /portal/situacion` no cuadra, y lo reconoce la escalera (`src/api/escalera.ts`)
 * **antes** que la libreria, para darle su peldano propio, `respuesta-ilegible`.
 *
 * <h2>Por que un error propio y no uno cualquiera</h2>
 *
 * Sin nombre, una respuesta rota no se ve como «el servidor mando algo que no entiendo» sino como
 * un `TypeError` suelto en mitad de una pantalla —`Cannot read properties of undefined`—, o peor,
 * como una cifra ausente que parece un cero. Con nombre, la pantalla sabe que decir y la escalera no
 * lo confunde con un corte de red: aqui el servidor SI contesto.
 *
 * <h2>Vive en su propio archivo, sin `zod` en tiempo de ejecucion</h2>
 *
 * La escalera lo importa para `instanceof`, y la escalera la usa cualquier pantalla que pinte un
 * fallo. Si viviera en `contrato.ts`, cada una arrastraria el esquema entero para preguntar una
 * cosa. Aqui solo entra el TIPO de los fallos de `zod`, que se borra al compilar.
 *
 * <h2>`fallos` es para depurar y probar, nunca para la pantalla</h2>
 *
 * Son las rutas y los motivos de `zod` (`municipalidades.0.obligaciones.0.ejercicio: expected
 * number`): nombres de campos del JSON, redactados para quien programa. El `message` los lleva
 * tambien, para que un rojo o una consola los ensenen. Lo que el ciudadano lee sale de la tabla de la
 * escalera, y `escalera.test.ts` mide que ni el mensaje ni una ruta asomen por alli.
 */
export class RespuestaQueNoEntiendo extends Error {
  override readonly name = 'RespuestaQueNoEntiendo';

  /**
   * @param peticion lo que se pidio, `GET /portal/situacion`: el dia que haya dos lecturas, el
   *   mensaje tiene que decir cual contesto mal.
   * @param fallos los `issues` del `safeParse` que no paso.
   */
  constructor(
    readonly peticion: string,
    readonly fallos: readonly core.$ZodIssue[],
  ) {
    super(
      `La respuesta de ${peticion} no tiene la forma del contrato: ${fallos
        .map((fallo) => `${fallo.path.map(String).join('.') || '(la raiz)'}: ${fallo.message}`)
        .join('; ')}`,
    );
  }
}
