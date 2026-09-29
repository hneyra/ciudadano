import { cva } from 'class-variance-authority';

/**
 * **Las clases que varias pantallas repetian, como variantes** (issue 60).
 *
 * Hasta el issue 60 cada pantalla escribia a mano la banda con filo de su tono, el boton apagado y el
 * boton de contorno verde o azul: la misma lista de clases en siete sitios, y en dos de ellos ya con
 * un token distinto. Aqui se escriben una vez, con `cva` —la forma de `Boton` de `@kamayuk/ui`—, y
 * quien las usa solo pone encima sus medidas.
 *
 * Son `.tsx` y no `.ts` a proposito: `verificaciones/tailwind-emite-las-clases.test.ts` lee las clases
 * de los `.tsx` de `src/`, y en un `.ts` estas se quedarian sin comprobar que Tailwind las genera.
 *
 * Ningun color propio: todo son tokens de `clasico`, con su porque en
 * `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 */

/**
 * **La banda con filo izquierdo, por tono**: el aviso de la busqueda y la amnistia (`AvisoConFilo`),
 * los finales de la consulta del paso 2, «No le queda nada por pagar», la banda del comprobante, la
 * del pago reciente de «Mis pagos» y la invitacion a crear una cuenta.
 *
 * El filo tenue de cada tono es el de `Alerta` de `@kamayuk/ui` (`border-mal-borde/40`,
 * `border-atencion-tinta/25`, `border-ok-tinta/25`); `neutro` es el papel blanco con el filo azul de
 * lo que no es ni exito ni aviso —una simulacion, una consulta en curso—, e `info` el papel de los
 * avisos informativos. El grosor: `grueso` (5 px) en las bandas, `fino` (4 px) en los avisos.
 */
export const bandaConFilo = cva('border', {
  variants: {
    tono: {
      neutro: 'border-linea border-l-azul bg-superficie',
      info: 'border-azul/25 border-l-azul bg-info-fondo',
      ok: 'border-ok-tinta/25 border-l-ok-tinta bg-ok-fondo',
      mal: 'border-mal-borde/40 border-l-mal-tinta bg-mal-fondo',
      atencion: 'border-atencion-tinta/25 border-l-atencion-tinta bg-atencion-fondo',
    },
    filo: { fino: 'border-l-4', grueso: 'border-l-[5px]' },
  },
  defaultVariants: { filo: 'grueso' },
});

/**
 * **El boton secundario de contorno, con tono**: la constancia de no adeudo y «Ver el comprobante»
 * en verde; «Crear mi cuenta» y «Entrar y pagar» en azul. Va sobre `Boton` (variante secundaria),
 * que pone el papel y el filo; esto les da el color, la negrita y el hover.
 */
export const botonConContorno = cva('font-bold', {
  variants: {
    tono: {
      ok: 'border-ok-tinta text-ok-tinta hover:border-ok-tinta hover:bg-ok-fondo',
      azul: 'border-azul text-azul hover:border-azul hover:bg-azul-suave',
    },
  },
});

/**
 * **El boton principal cuando no hay nada que hacer** («Pagar» sin nada marcado, confirmar
 * sin nada que pagar). Sigue siendo pulsable —avisa por que no—, asi que no es `disabled`: se pinta
 * con `--linea` y `--tinta-2` (5.49:1), y no blanco sobre `#BBB` (1.92:1) como el artboard.
 */
export const botonApagado = cva('', {
  variants: {
    apagado: { true: 'bg-linea text-tinta-2 hover:bg-linea', false: null },
  },
});

/**
 * **Un blanco de 44 × 44 px alrededor de un control mas chico, sin cambiar su dibujo** (issue 62): un
 * `::after` transparente, centrado en el control, que recibe el toque como el control mismo. Es para
 * las casillas, que el artboard dibuja de 19 y 20 px (lineas 232 y 329): ahi el blanco no puede
 * crecer sin que crezca la marca. Centrado y de medida fija, y no con un margen negativo, porque el
 * `::after` se mide desde dentro del filo y con `-inset-3` una casilla de 20 px quedaba en 42 (medido
 * por el arnes, `lasAreasTactilesLleganA44` en `e2e/portal.ts`).
 */
export const BLANCO_DE_44 =
  'relative after:absolute after:top-1/2 after:left-1/2 after:size-[44px] after:-translate-x-1/2 after:-translate-y-1/2';
