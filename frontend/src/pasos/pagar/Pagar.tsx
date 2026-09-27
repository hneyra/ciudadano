import { useModo } from '../../modo/useModo.ts';
import { LosMedios } from './LosMedios.tsx';
import { PagarSinMedios } from './PagarSinMedios.tsx';
import { Resumen } from './Resumen.tsx';

/**
 * **Paso 4 · Pagar** (`diseno/Ciudadano.dc.html`: plantilla 356-475, `@media` 24-28 y 37-38, medios
 * 808-885, logica 1202-1272).
 *
 * Elegir como pagar y confirmar. En la demostracion ningun medio cobra: confirmar despacha
 * `confirmarPago`, que SELLA el pago en el estado con los importes de `cuentaDe` y pasa al
 * comprobante; la ruta lo sigue.
 *
 * <h2>Como esta partido (issue 60)</h2>
 *
 * · **`vista.ts`**, el modelo de vista: el resumen, los pasos de un medio y lo que pasa al confirmar,
 *   como funciones puras del estado (probadas en `vista.test.ts`).
 * · **`Resumen.tsx`**, «Lo que va a pagar», el mismo en los dos modos.
 * · **`LosMedios.tsx`** y **`PanelDelMedio.tsx`**, el selector y el panel del artboard;
 *   **`PagarSinMedios.tsx`**, lo que se dibuja con plataforma; y **`confirmar.tsx`**, el boton verde y
 *   lo que hace, que comparten los dos.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * Las filas, los componentes y el total salen de `cuentaPorPagar` y `porPagar` del reductor; el
 * total de cada concepto, de `totalDe`; el importe de las instrucciones, de `pasosConTotal`. Que la
 * pantalla pinta lo que las cuentas dicen, y no lo que ella sumaria, lo demuestra
 * `Pagar.cuentas.test.tsx` sustituyendo las cuentas.
 *
 * <h2>Sin nada que pagar no hay resumen que pagar</h2>
 *
 * «Pagar» se alcanza sin haber buscado: «Iniciar sesión» abre «Mis datos», y «Solo con mi correo»
 * lleva aqui. Con lo marcado por omision el artboard pintaria un resumen de `S/ 3,149.92` que nadie
 * eligio. Por eso todo cuelga de `porPagar` —vacio si no `hayQuePagar`—: el resumen dice
 * «No hay nada que pagar.» sin filas ni totales, el boton de confirmar se pinta apagado y, pulsado,
 * avisa con esa frase del artboard (linea 1255) sin despachar, y en lugar de «Cambiar lo que voy a
 * pagar» se ofrece volver a elegir: a buscar si no se busco (a `deudas` se volveria a llegar aqui sin
 * busqueda) y a elegir qué pago si se busco. El reductor tampoco sella sin `porPagar`.
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · **El medio activo tiene papel `--azul-suave`**, como pide el issue, y no el `#F0F6FB` del artboard
 *   (que es `--info-fondo`, el papel de los avisos informativos). Los grises sin token —la caja del
 *   icono, las cabeceras y los filos del resumen, el hover del boton verde— van con su porque en la
 *   tabla de la paleta.
 * · **Los `@media` de 820 y 520 px son variantes `max-[821px]:` y `max-[521px]:`** de Tailwind y no
 *   reglas por `data-pagar` en `src/estilos.css`: el mismo corte, escrito donde se lee. Con un pixel
 *   mas, porque Tailwind v4 emite `max-[820px]` como `width < 820px`: a 820 px justos no aplicaba y el
 *   `max-width: 820px` del artboard si. Lo destapo el arnes (issue 11, `e2e/se-ve.spec.ts`).
 * · **Sin nada que pagar**, lo de arriba.
 */

/**
 * **El paso de pagar, en los dos modos.**
 *
 * Como en el paso 2 (`Deudas.tsx`), son **dos pantallas** y no una con condiciones dentro: con
 * plataforma no hay medios, ni campos de tarjeta, ni codigos, ni instrucciones. El resumen de la
 * derecha si es el mismo, porque lo que se deberia pagar se cuenta igual. Cual se dibuja lo contesta
 * la politica del modo: si el pago es simulado (`cobro.simulado`).
 */
export function Pagar() {
  const simulado = useModo().cobro.simulado;

  return (
    <div
      data-pagar=""
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,320px)] items-start gap-[18px] max-[821px]:grid-cols-[minmax(0,1fr)]"
    >
      <div className="min-w-0">{simulado ? <PagarSinMedios /> : <LosMedios />}</div>

      <Resumen />
    </div>
  );
}
