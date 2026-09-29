import { useTranslation } from 'react-i18next';

import { useLaSituacion } from '../../datos/fuente.ts';
import type { SituacionDelServidor } from '../../datos/tipos.ts';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { vivasDelServidor } from '../../recorrido/recorrido.ts';
import { ConceptoDelServidor, LoQueSumoElServidor } from './ConceptoDelServidor.tsx';
import { NoSePudoConsultar, NoSePudoPreguntar, Pidiendo, SinDeudaDelServidor, SinRegistros } from './FinalesDeLaConsulta.tsx';
import { BarraDePago, ListaDeConceptos, QuienEs } from './piezas.tsx';
import { quienEsDelServidor } from './vista.ts';

/**
 * **La deuda que cuenta el servidor, con sus cinco finales** (issues 27 y 28).
 *
 * Con plataforma, la deuda no esta en memoria: se pide. Y pedir tiene cuatro finales que el
 * ciudadano puede encontrarse, mas el rato en que no ha llegado ninguno. Esta pantalla los dibuja
 * los cinco (`FinalesDeLaConsulta.tsx`, y aqui el de con deuda), y **no dibuja ni una cifra que no
 * venga del servidor**. Lo que dibuja igual que la demostracion —quien es, la lista, la fila de un
 * concepto, la barra de pago— esta en `piezas.tsx` (issue 60).
 *
 * <h2>Donde vive, y por que aqui</h2>
 *
 * En el **paso 2**, «Elegir qué pago», que es el sitio que el issue 28 le da: con plataforma el paso
 * 1 es «Entrar» —el sujeto de la consulta sale del token— y esta pantalla es a donde se llega con la
 * sesion abierta. En el issue 27 vivia encima del paso 1 a proposito y con fecha de caducidad
 * escrita: entonces el recorrido de pasos no se podia tocar.
 *
 * `Deudas.tsx` elige entre esta pantalla y la del artboard preguntando a la politica del modo, no al
 * entorno. **En demostracion no se monta**: no hay peticion, y el paso 2 es el de siempre.
 *
 * <h2>La regla que gobierna las cinco ramas: ningun cero de consuelo</h2>
 *
 * Cuando una consulta no se pudo completar, lo que NO se puede hacer es ensenar un total. Un total
 * al que le falta una municipalidad es un importe **plausible y equivocado**, y quien lo lea se ira
 * a la ventanilla creyendo que debe eso. Por eso en `no-se-pudo-consultar` se ensena la **nota del
 * servidor tal cual** —que es quien sabe cual falto—, ni un numero, y un boton para reintentar; y
 * por eso `sin-registros` no se dibuja como «S/ 0.00» sino como lo que es: no encontramos nada a su
 * nombre.
 *
 * <h2>Y la que gobierna la lista: lo que el contrato no da, no se dibuja</h2>
 *
 * `GET /portal/situacion` no trae cuotas, ni fecha de vencimiento, ni estado por concepto, ni el
 * desglose de los servicios del arbitrio (`src/datos/deLaSituacion.ts`, decision 4). Asi que aqui
 * **no hay insignia de estado, no hay linea de vencimiento y no hay tabla de detalle**: el desglose
 * dice que el portal no lo publica. Una insignia «Por vencer» deducida del interes seria un dato
 * inventado que el ciudadano leeria como oficial.
 *
 * Cada importe lleva **su** fecha (`fechaDelImporte`, y `Cifra` con `conSuFecha`), y no una fecha de
 * corte comun: el contrato permite que difieran y aplanarlas seria decidir por el servidor.
 *
 * <h2>Los textos del fallo salen de la escalera, y son los del CIUDADANO</h2>
 *
 * `peldanoDelPortal` (issue 25) clasifica el fallo con la libreria y pone las palabras de este
 * portal: nada de «avise a soporte» ni de «pida el permiso a quien administre los perfiles», que
 * son gente que quien entra a pagar su predial no tiene. El boton de entrar sale **solo** cuando la
 * libreria dice que este peldano pide identidad (el 401): con un 403 `SIN_DOCUMENTO`, volver a la
 * puerta trae el mismo token y el mismo 403 — ahi lo que se ofrece es reintentar.
 */

/**
 * Hay deuda, y es la del servidor: quien es, lo que el sumo, los conceptos y el pago.
 *
 * **Los conceptos son los del recorrido, y el recorrido los lee de la misma cache** (issue 50): no hay
 * efecto que los copie, asi que en el mismo dibujo en que `situacion` llega, `vivasDelServidor` ya
 * los tiene. Hasta el issue 50 habia un dibujo entre medias con la lista vacia —que antes del 49
 * decia «No le queda nada por pagar» delante de una deuda de verdad, y en el 49 se tapo dibujando
 * nada—. Lo mide la sonda de `LaConsulta.unaVerdad.test.tsx`, AC1.
 */
function ConDeuda({ situacion }: { readonly situacion: SituacionDelServidor }) {
  const { t } = useTranslation();
  const { estado } = useRecorrido();

  return (
    <div>
      <QuienEs quien={quienEsDelServidor(situacion, t)} />
      <LoQueSumoElServidor situacion={situacion} />
      <ListaDeConceptos>
        {vivasDelServidor(estado).map((deuda) => (
          <ConceptoDelServidor key={deuda.id} deuda={deuda} />
        ))}
      </ListaDeConceptos>
      <BarraDePago aLaFecha={situacion.aLaFecha} />
    </div>
  );
}

/**
 * **La consulta al portal, con sus cinco finales.**
 *
 * `useLaSituacion` no reintenta (`retry: false`, en `src/datos/fuente.ts`): un 401 reintentado tres
 * veces son tres 401, y el remedio es entrar, no insistir. Quien decide volver a preguntar es la
 * persona, con «Reintentar la consulta», que es un `refetch` y no un reintento automatico.
 *
 * <h2>Una deuda ya leida gana a un error posterior (issue 50)</h2>
 *
 * Si una consulta REPETIDA falla, React Query conserva la respuesta anterior en `data` y solo cambia
 * `status` a `error`. Preguntando antes por `isError`, un 401 a mitad de la eleccion borraba la lista
 * y lo marcado. Ahora, **con deuda ya leida, se sigue viendo la deuda**: cada importe dice a que fecha
 * es, asi que lo que se ve no se hace pasar por mas nuevo de lo que es.
 *
 * Solo con deuda: en los otros finales no hay nada a medio elegir, y el error es lo que la persona
 * necesita leer —un 401 trae el boton «Entrar», que la nota de «no se pudo consultar» no tiene—.
 */
export function LaConsulta() {
  const consulta = useLaSituacion();
  const alReintentar = () => void consulta.refetch();

  if (consulta.isPending) return <Pidiendo />;
  if (consulta.data?.estado === 'con-deuda') return <ConDeuda situacion={consulta.data} />;
  if (consulta.isError) return <NoSePudoPreguntar fallo={consulta.error} alReintentar={alReintentar} />;

  const situacion = consulta.data;
  switch (situacion.estado) {
    case 'no-se-pudo-consultar':
      return <NoSePudoConsultar situacion={situacion} alReintentar={alReintentar} />;
    case 'sin-registros':
      return <SinRegistros situacion={situacion} />;
    case 'sin-deuda':
      return <SinDeudaDelServidor />;
    case 'con-deuda':
      return <ConDeuda situacion={situacion} />;
  }
}
