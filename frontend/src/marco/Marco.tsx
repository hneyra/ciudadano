import { Avisos, useTema } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import { useRecorrido } from '../recorrido/ProveedorDelRecorrido.tsx';
import { useLaRutaSigueAlPaso } from '../recorrido/rutas.ts';
import { Barra } from './Barra.tsx';
import { FranjaDePasos } from './FranjaDePasos.tsx';
import { Pie } from './Pie.tsx';

/**
 * **El marco comun a todos los pasos**: barra, franja, contenido, pie y avisos
 * (`diseno/Ciudadano.dc.html`, lineas 53-120 y 675-689).
 *
 * · El contenido va en `max-width: 1020px` con `padding: 24px 18px 60px` sobre `--fondo` (lineas
 *   118-119).
 * · **La franja no aparece en el historial** (linea 1064): alli no hay nada que avanzar.
 * · **Los avisos** son `Avisos` de `@kamayuk/ui` (sonner) en lugar del `toast` del estado del
 *   prototipo (lineas 686-688 y 945-952): la region viva, el cierre a los segundos y la tinta sobre
 *   `--tinta` los pone la libreria. Su rotulo accesible pasa por `t()`, y el modo es el del tema.
 * · **Al imprimir solo queda el recibo** (issue 9): la barra, la franja, el pie y los avisos llevan
 *   `data-noprint`, que la regla `@media print` de `src/estilos.css` oculta, y el lienzo pasa a
 *   `--superficie` (el `html, body { background: #fff }` de la linea 47 del artboard).
 */
export function Marco() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const { modo } = useTema();
  useLaRutaSigueAlPaso();

  return (
    <div className="flex min-h-screen flex-col bg-fondo print:bg-superficie">
      <Barra />
      {estado.paso === 'historial' ? null : <FranjaDePasos />}
      <main className="flex-1 px-[18px] pt-6 pb-[60px]">
        <div className="mx-auto max-w-[1020px]">
          <Outlet />
        </div>
      </main>
      <Pie />
      {/* Los avisos tampoco se imprimen: un «Pago registrado…» abierto saldria encima del recibo. */}
      <div data-noprint="1">
        <Avisos modo={modo} rotulo={t('Avisos')} />
      </div>
    </div>
  );
}
