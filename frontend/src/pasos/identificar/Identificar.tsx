import { useTranslation } from 'react-i18next';

import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { ConMiCuenta } from './ConMiCuenta.tsx';
import { SoloConMiCorreo } from './SoloConMiCorreo.tsx';
import { laIntroduccion } from './vista.ts';

/**
 * **Paso 3 · Mis datos** (`diseno/Ciudadano.dc.html`: plantilla 311-354, logica 1177-1201).
 *
 * Antes de cobrar, a donde se envia el comprobante: solo un correo, o entrar con la cuenta para que el
 * pago quede en el historial. La cuenta es de demostracion: cualquier documento y clave entran.
 *
 * <h2>Dos formularios, cada uno con su error</h2>
 *
 * Cada tarjeta es un `Formulario` de `@kamayuk/ui` con su `useForm` y su esquema de `zod`: enviar una
 * no valida la otra, y el error sale en la suya. Como en «Buscar mi deuda», el mensaje no es el que
 * `CampoDelFormulario` pega al campo (11.5 px, sin `role`): el artboard lo pinta en 13.5 px con
 * `role="alert"` (lineas 326 y 347). Asi que cada campo se compone con `Controller` y `Etiqueta` —las
 * dos piezas con que `CampoDelFormulario` esta hecho— y apunta al mensaje con `aria-describedby` y
 * `aria-invalid`, que `CONTROL` pinta con filo `--mal-borde` y papel `--mal-campo` (el `IN_MAL` del
 * artboard).
 *
 * El error se borra al escribir y no se recalcula (`reValidateMode: 'onSubmit'`), como `onCorreo`,
 * `onLoginDoc` y `onLoginClave` del artboard.
 *
 * <h2>Como esta partido (issue 60)</h2>
 *
 * Una tarjeta por archivo —`SoloConMiCorreo.tsx` y `ConMiCuenta.tsx`—, lo que comparten en
 * `piezas.tsx`, y lo que se decide y se dice sin React en `vista.ts` (probado en `vista.test.ts`).
 *
 * <h2>Lo que las acciones deciden, y lo que no</h2>
 *
 * La pantalla despacha `continuarConCorreo` o `entrar`; a donde lleva cada una lo dice el reductor.
 * Entrar sin nada que pagar lleva al historial y no a un «Pagar» vacio (`destinoAlEntrar`, nota del
 * revisor del issue 7), y por lo mismo el parrafo no dice «Va a pagar S/ …» sin seleccion
 * (`hayQuePagar`). El importe es `conAmnistia` de `cuenta`: aqui no se suma nada.
 *
 * **La clave no sale del formulario**: `entrar` no la lleva, y nada la escribe en `localStorage` ni
 * en `sessionStorage` (lo mide `Identificar.test.tsx`).
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · **El filo granate de «Con mi cuenta»** (`#A6093D`) no es token de `clasico`: es `--mal-tinta`, el
 *   mas cercano, calculado. Y el acero de «Solo con mi correo» es `--azul`. Los dos, con su porque, en
 *   `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 * · **Los campos vacios de la cuenta se pintan invalidos**; el artboard los deja con `IN`. Es el
 *   `aria-invalid` de arriba: sin el, el mensaje no pertenece a ningun campo.
 * · **«Olvidé mi clave · Crear una cuenta» son botones que avisan**, no `<a href="#">`: un enlace que
 *   no lleva a ningun sitio no es un enlace (jsx-a11y), y en la demostracion no hay a donde ir.
 * · **La casilla es `Casilla`** (Radix) sin su caja, dentro de un `<label>` que envuelve tambien el
 *   texto, como el del artboard: pulsar el texto la alterna.
 * · **Sin seleccion, el parrafo cambia** (nota del revisor): «Todavía no ha elegido qué pagar…».
 *
 * El ejemplo del documento y los puntos de la clave son DATO, como los ejemplos de «Buscar mi deuda»:
 * no pasan por `t()`. El documento es el DNI del contribuyente del artboard, asi que llega con la
 * demostracion (`LaDemostracion.ejemplos`, issue 58) y no se escribe aqui. `nombre@example.com` si, porque se lee como una plantilla («nombre@…»), no como un dato
 * opaco (issue 51: el dominio de ejemplo era antes real y registrable; ahora es el reservado
 * `example.com` — RFC 2606 —, y la palabra que lo delataba como legible sigue siendo «nombre»).
 */

export function Identificar() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();

  return (
    <div>
      <h1 className="m-0 mb-[6px] text-[24px] font-bold text-pretty text-azul">
        {t('¿A dónde le enviamos el comprobante?')}
      </h1>
      <p className="mt-0 mb-5 max-w-[66ch] text-[16px] leading-[1.6] text-pretty text-tinta-2">
        {laIntroduccion(estado, t)}
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(316px,1fr))] gap-[18px]">
        <SoloConMiCorreo />
        <ConMiCuenta />
      </div>
    </div>
  );
}
