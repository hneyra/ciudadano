import { Boton, avisar, cn } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

import { useModo } from '../../modo/useModo.ts';
import { botonConContorno } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { laDemostracion, vivasDelArtboard } from '../../recorrido/recorrido.ts';
import { ConceptoDelArtboard } from './ConceptoDelArtboard.tsx';
import { ElTotal } from './ElTotal.tsx';
import { LaConsulta } from './LaConsulta.tsx';
import { BarraDePago, Bloque, ListaDeConceptos, Parrafo, QuienEs } from './piezas.tsx';
import { quienEsDeLaDemostracion } from './vista.ts';

/**
 * **Paso 2 · Elegir qué pago** (`diseno/Ciudadano.dc.html`: plantilla 182-309, logica 1102-1176).
 *
 * Lo primero que se ve es el total, porque es lo que se viene a saber; cada concepto se abre para ver
 * de donde sale la cifra.
 *
 * <h2>Como esta partido (issue 60)</h2>
 *
 * · **`vista.ts`**, el modelo de vista: funciones puras del estado que devuelven lo que se dibuja
 *   —textos ya dichos, cifras ya elegidas—, probadas solas en `vista.test.ts`.
 * · **`piezas.tsx`**, lo que los dos modos dibujan igual: quien es, la lista, la fila de un concepto,
 *   la barra de pago y el bloque con su titulo.
 * · Lo de cada modo: `ElTotal.tsx` y `ConceptoDelArtboard.tsx` en demostracion; `LaConsulta.tsx` (con
 *   `FinalesDeLaConsulta.tsx` y `ConceptoDelServidor.tsx`) con plataforma.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * El total, lo que queda con la amnistia, las cuatro cifras y la nota salen de `resumen` (la deuda
 * viva); lo marcado, de `cuenta` y `seleccion`; el total y el recargo de cada concepto, de `totalDe` y
 * `recargoDe`. Todo eso esta en `src/datos/cuentas.ts` y `src/recorrido/recorrido.ts`. `vista.ts` solo
 * PREGUNTA si un importe es mayor que cero (`compararImportes`, de `@kamayuk/formato`) para decidir si
 * se dice «incluye … de recargo» o el ahorro. Que la pantalla pinta lo que las cuentas dicen, y no lo
 * que ella sumaria, lo demuestra `Deudas.cuentas.test.tsx` sustituyendo las cuentas por otras.
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · **«Lo que debe, por concepto» es el `h1`**; en el artboard, un `h2`. Es el titulo del paso (el
 *   marcador del issue 4 ya lo usaba) y la pagina no tiene otro: sin el, el paso no tendria encabezado
 *   principal por el que llegar.
 * · **El boton de pagar sin nada marcado** se pinta con `--linea` y `--tinta-2`, no blanco sobre
 *   `#BBB` (1.92:1): sigue siendo pulsable —avisa—, y lo que dice se tiene que leer (`botonApagado`).
 * · **La ayuda «Marque al menos un concepto…» (linea 298) solo sale si queda deuda.** En el artboard
 *   cuelga de `seleccion.vacio`, que tambien es cierto sin deuda viva, y saldria encima de «No le queda
 *   nada por pagar» pidiendo marcar lo que ya no existe.
 * · **«Va a pagar los N conceptos» con un solo concepto vivo** dice «Va a pagar 1 concepto» (forma
 *   `_one`), y no «los 1 conceptos».
 * · Los colores que no son token, con su porque, en `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 *
 * <h2>De donde sale el contribuyente</h2>
 *
 * De la demostracion que aporta la fuente (`LaDemostracion.contribuyente`, issue 58), como la deuda
 * sale de ella en el reductor: el recorrido trabaja sobre los datos de la demostracion y la busqueda
 * no guarda otra situacion. Hasta el issue 58 se importaba de `demostracion.ts`, y con eso viajaba en
 * el paquete de produccion.
 */

/** Sin deuda viva no hay lista que pintar: queda la constancia (lineas 301-307). */
function SinDeuda() {
  const { t } = useTranslation();
  return (
    <Bloque titulo={t('No le queda nada por pagar')} tono="ok" className="mt-[18px]">
      <Parrafo className="mb-[14px] text-ok-tinta">
        {t('Pagó todos sus conceptos pendientes. Puede pedir su constancia de no adeudo, que acredita que está al día.')}
      </Parrafo>
      <Boton
        type="button"
        onClick={() => avisar(t('Se emitiría su constancia de no adeudo al día de hoy.'))}
        className={cn(botonConContorno({ tono: 'ok' }), 'min-h-[44px] px-5 py-0 text-[14.5px]')}
      >
        {t('Pedir mi constancia de no adeudo')}
      </Boton>
    </Bloque>
  );
}

/** El paso 2 del artboard: la lista de la demostracion, con su desglose y su insignia por concepto. */
function DeudasDeLaDemostracion() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const viva = vivasDelArtboard(estado);

  return (
    <div>
      <QuienEs quien={quienEsDeLaDemostracion(laDemostracion(estado).contribuyente, t)}>
        <Boton
          type="button"
          className="min-h-[40px] flex-[0_0_auto] px-4 py-0 text-[14px]"
          onClick={() => despachar({ tipo: 'noSoyYo' })}
        >
          {t('No soy yo')}
        </Boton>
      </QuienEs>

      {viva.length === 0 ? (
        <SinDeuda />
      ) : (
        <>
          <ElTotal />
          <ListaDeConceptos>
            {viva.map((deuda) => (
              <ConceptoDelArtboard key={deuda.id} deuda={deuda} />
            ))}
          </ListaDeConceptos>
          <BarraDePago />
        </>
      )}
    </div>
  );
}

/**
 * **Paso 2, en los dos modos** (issue 28).
 *
 * La pregunta que la pantalla hace es «¿la deuda se le pide a un servidor?», y la contesta la politica
 * del modo (`useModo().contenido.laDeudaSeConsulta`, issues 59 y 60) —que sale de la fuente inyectada,
 * no de `import.meta.env`—: asi los dos modos se prueban inyectando una fuente en vez de trucando el
 * entorno.
 *
 * Y son **dos pantallas enteras**, no una con condiciones dentro. Lo que el artboard dibuja —cuotas,
 * vencimiento, insignia de estado y desglose de servicios— el servidor no lo trae, y una pantalla
 * sola acabaria con un `?? null` en cada linea: el sitio exacto donde un dia aparece un valor por
 * omision que se lee como un dato. Separadas, la de demostracion es la de siempre y la de plataforma
 * solo puede dibujar lo que le dieron. Lo que las dos dibujan IGUAL esta en `piezas.tsx`, una vez.
 */
export function Deudas() {
  return useModo().contenido.laDeudaSeConsulta ? <LaConsulta /> : <DeudasDeLaDemostracion />;
}
