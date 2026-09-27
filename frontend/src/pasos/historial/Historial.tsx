import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useModo } from '../../modo/useModo.ts';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { DeDondeSale, DeDondeSaleDeLaConsulta } from './DeDondeSale.tsx';
import { LoQueQuedaPendiente, LoQueQuedaPendienteDeLaConsulta } from './LoQueQuedaPendiente.tsx';
import { PagoReciente, PagosRealizados } from './LosPagos.tsx';

/**
 * **Mis pagos**, con sesion (`diseno/Ciudadano.dc.html`: plantilla 567-671, datos 887-917, logica
 * 1327-1376).
 *
 * Lo que la persona pago, lo que le queda y de donde sale lo que paga. Sin franja de pasos: aqui no hay
 * nada que avanzar (lo decide `Marco`).
 *
 * <h2>De donde sale cada cosa</h2>
 *
 * · **El pago reciente** —la banda y la primera fila de la tabla— sale SOLO de `estado.ultimo`, el pago
 *   sellado, y solo si `recienPagado`: sus conceptos (`pago.conceptos`), su importe, su medio y los
 *   numeros del comprobante. Como en el comprobante, nada de `marcadas` ni de la seleccion.
 * · **Los pagos anteriores y las unidades** se leen de la fuente del portal (`useHistorial`,
 *   `useUnidades`), como los leeria un portal con backend: mientras llegan, su seccion queda
 *   `aria-busy`; si fallan, lo dice un aviso.
 * · **Lo pendiente** es la deuda viva (`pendientes`), y su total, `cuentaPendiente`.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * El total pendiente es `cuentaPendiente(estado).total` (de `cuentaDe`) y el de cada concepto `totalDe`,
 * los dos de `src/datos/cuentas.ts`; la columna «Importe S/» es `cifraSinSimbolo`. Lo mide
 * `Historial.cuentas.test.tsx` sustituyendo las cuentas por otras.
 *
 * <h2>Como esta partido (issue 60)</h2>
 *
 * · **`vista.ts`**, el modelo de vista: el pago reciente, las filas de los pagos, lo pendiente y lo que
 *   dice la consulta, como funciones puras (probadas en `vista.test.ts`).
 * · **`LosPagos.tsx`** (la banda del pago reciente y «Pagos realizados»), **`LoQueQuedaPendiente.tsx`**
 *   y **`DeDondeSale.tsx`**, cada una en sus dos formas; y **`piezas.tsx`**, lo que comparten: la
 *   seccion, las filas de lo pendiente, el pie que ofrece pagarlo, el dato de una unidad.
 *
 * Las piezas de `@kamayuk/ui`: **`Tabla`** y compania para «Pagos realizados», **`Insignia`** tal cual
 * para la situacion de cada concepto pendiente y «Al día», y **`Boton`** para todas las acciones, con
 * las medidas del artboard encima.
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · El titulo de la banda del pago reciente es un `h2` y la banda una region con su nombre; en el
 *   artboard, un `span`. Lo que queda pendiente es una lista (`ul`), y los datos de cada unidad tambien.
 * · El boton «Comprobante» de cada fila se llama «Comprobante <numero>»: seis botones con el mismo
 *   nombre no se distinguen con un lector de pantalla. El nombre empieza por lo que se ve.
 * · «Mis predios y vehículos» lleva a este mismo `#/historial`, y ademas deja el foco en «De dónde sale
 *   lo que paga» y lo trae a la vista (`enfocarUnidades`, del reductor). En el artboard, las dos opciones
 *   abren el historial igual.
 * · Los colores que no son token, con su porque, en `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 */

export function Historial() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  // Que secciones se dibujan lo contesta la politica, pregunta por pregunta (issues 59 y 60): si se
  // publican los pagos, si la deuda se consulta, si se publican las unidades.
  const { publicaLosPagos, laDeudaSeConsulta, publicaLasUnidades } = useModo().contenido;
  const pago = estado.recienPagado ? estado.ultimo : null;
  // Estable mientras lo sea `despachar`: en demostracion, siempre; con plataforma cambia cuando la
  // cache trae otra respuesta (issue 50), y entonces el efecto de `DeDondeSale` vuelve a correr, pero
  // no hace nada: cumple solo con `enfocar` encendido, y lo apaga al cumplir.
  const alEnfocar = useCallback(() => despachar({ tipo: 'unidadesEnfocadas' }), [despachar]);

  return (
    <div>
      <h1 className="mt-0 mb-[6px] text-[24px] font-bold text-azul">{t('Mis pagos')}</h1>
      <p className="mt-0 mb-[18px] max-w-[68ch] text-[15.5px] leading-[1.6] text-pretty text-tinta-2">
        {/*
          Sin pagos publicados no hay «todos sus pagos» ni comprobantes: el backend no publica ninguno
          (issue 49). Se dice lo que la pantalla ensena de verdad.
        */}
        {publicaLosPagos
          ? t('Todos sus pagos, con sus comprobantes. Abajo está lo que le queda pendiente.')
          : t('Lo que le queda pendiente, según la consulta de hoy, y los predios a su nombre. El portal todavía no publica sus pagos.')}
      </p>

      {pago === null ? null : <PagoReciente pago={pago} />}
      <PagosRealizados />
      {laDeudaSeConsulta ? <LoQueQuedaPendienteDeLaConsulta /> : <LoQueQuedaPendiente />}
      {/*
        Sin unidades publicadas salen los predios de la CONSULTA, y no `useUnidades`, que el backend no
        publica. El foco de «Mis predios y vehículos» es de las unidades publicadas: sin ellas el menu
        lleva a esta misma pantalla y la seccion es la de abajo del todo.
      */}
      {publicaLasUnidades ? (
        <DeDondeSale enfocar={estado.enfocarUnidades} alEnfocar={alEnfocar} />
      ) : (
        <DeDondeSaleDeLaConsulta />
      )}
    </div>
  );
}
