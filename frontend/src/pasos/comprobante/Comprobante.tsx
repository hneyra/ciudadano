import { AvisoDePagoSimulado } from '../../piezas/AvisoDePagoSimulado.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { esSimulado } from '../../recorrido/recorrido.ts';
import { Acciones, Invitacion } from './Acciones.tsx';
import { BandaDeExito, BandaSimulada } from './Bandas.tsx';
import { Recibo } from './Recibo.tsx';

/**
 * **Paso 5 · Comprobante** (`diseno/Ciudadano.dc.html`: plantilla 477-565, `@media` 29-44, `print`
 * 45-49, logica 1273-1326).
 *
 * La constancia de pago: lo que la persona conserva y presenta si la deuda volviera a aparecer. Por
 * eso **se imprime sola**: todo lo que no es el recibo lleva `data-noprint` —la banda de exito, las
 * acciones y la invitacion, aqui; la barra, la franja, el pie y los avisos, en `src/marco/`— y la
 * regla `@media print` de `src/estilos.css` lo oculta. Que la regla este y que en la pantalla no
 * quede nada fuera del recibo sin marcar lo miden `verificaciones/lo-no-imprimible-no-se-imprime.test.ts`
 * y `Comprobante.test.tsx`.
 *
 * <h2>El recibo se dibuja SOLO con el pago sellado</h2>
 *
 * Todo sale de `estado.ultimo`, que `confirmarPago` sello: los conceptos (`pago.conceptos`), los
 * importes, el medio, el destino y los numeros del comprobante. Nada de `marcadas`, `seleccion` ni
 * `cuenta`: volver a elegir qué pago y regresar aqui ensena el mismo recibo. Lo unico que se lee del
 * estado vivo es lo que el artboard tambien lee vivo (1283-1286): si hay sesion —que acciones se
 * ofrecen— y si queda deuda viva —«Pagar otra deuda»—.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * El importe de cada fila es `aCobrarDe` (con la amnistia del artboard, `conAmnistiaDe`: insoluto +
 * gastos) y la cifra sin «S/ » es `cifraSinSimbolo`, de `src/datos/cuentas.ts`; el condonado y el
 * total, los del sello, por `aCobrar`. **Con plataforma no hay amnistia** (issue 49): cada fila y el
 * total son el saldo entero, y la fila del interes condonado no se dibuja.
 *
 * <h2>Como esta partido (issue 60)</h2>
 *
 * · **`vista.ts`**, el modelo de vista: lo que dicen las bandas y el recibo entero, como funciones
 *   puras del estado y del sello (probadas en `vista.test.ts`).
 * · **`Bandas.tsx`** (la de exito y la simulada), **`Recibo.tsx`** y **`Acciones.tsx`** (las acciones
 *   y la invitacion), cada una con las piezas de `@kamayuk/ui` que usa y lo que se les ajusta.
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · «Su pago se registró» es el `h1` (el marcador del issue 4 ya lo usaba) y «Constancia de pago» el
 *   `h2` que da nombre a la region del recibo: en el artboard, dos `span`.
 * · La meta es una lista de definiciones (`dl`), no seis `div`.
 * · Los `@media` de 700 y 520 px son variantes `max-[701px]:` y `max-[521px]:`: Tailwind v4 las
 *   emite como `width < 701px`, que es el `max-width: 700px` del artboard (como `Barra.tsx`).
 * · Los colores que no son token, con su porque, en `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 */

export function Comprobante() {
  const { estado } = useRecorrido();
  const pago = estado.ultimo;
  // Sin sello no se llega aqui por ninguna accion (`confirmarPago` es quien pasa al comprobante); solo
  // un estado inicial escrito a mano. No hay recibo que dibujar con otra cosa que el sello.
  if (pago === null) return null;

  return (
    <div>
      {/*
        Un pago simulado NO acredita ningun pago: no hay cobro detras (issue 28). El aviso va arriba
        del todo, y la banda no dice «Su pago se registró». **El aviso y la banda cuelgan de la MISMA
        pregunta** (issue 59): hasta entonces la banda se elegia por el sello y el aviso por el modo,
        y en demostracion con un sello nulo salia un recibo con banda simulada y sin aviso. Ahora un
        pago registrado siempre tiene sello —lo dice su tipo— y el reductor sella uno u otro segun
        la politica del modo (`cobro.simulado`).
      */}
      {esSimulado(pago) ? (
        <>
          <AvisoDePagoSimulado />
          <BandaSimulada pago={pago} />
        </>
      ) : (
        <BandaDeExito pago={pago} />
      )}
      <Recibo pago={pago} />
      <Acciones pago={pago} />
      {estado.autenticado ? null : <Invitacion pago={pago} />}
    </div>
  );
}
