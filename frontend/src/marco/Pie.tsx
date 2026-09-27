import { useTranslation } from 'react-i18next';

import { useModo } from '../modo/useModo.ts';

/**
 * **El pie del portal** (`diseno/Ciudadano.dc.html`, lineas 675-684).
 *
 * El texto lleva la entidad dentro, como el `{{ entidad }}` del artboard: una sola frase con su hueco
 * y no dos cadenas pegadas, para que un traductor decida donde cae la entidad.
 *
 * El gris `#777` del artboard es `--tinta-3` (no llega a AA; ver la tabla de
 * `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`) y el azul de enlace, `--azul`, que ya
 * pone `src/estilos.css` a todo `a`.
 *
 * **Los tres enlaces no llevan a ninguna parte**, como en el artboard (`href="#"`): la demostracion no
 * tiene esas paginas. Apuntan a `#/`, que el enrutador devuelve al paso en que se esta, en vez de a
 * `#`, que ademas de lo mismo es un enlace invalido para `jsx-a11y`.
 *
 * **Solo con datos de ejemplo, «Los datos de esta pantalla son de demostración.»** (issues 49 y 59,
 * `contenido.sonDatosDeEjemplo` de la politica). Con plataforma no: alli los datos
 * son los de la persona, y la frase viajaba en la imagen de produccion diciendo lo contrario. Lo que
 * con plataforma SI es de demostracion —pagar y el comprobante— lo dice su aviso, en su pantalla.
 */
const ENLACE_DEL_PIE = 'inline-flex min-h-[44px] items-center';

export function Pie() {
  const { t } = useTranslation();
  const { sonDatosDeEjemplo } = useModo().contenido;
  const entidad = t('Municipalidad Distrital de Catacaos');
  return (
    <footer data-noprint="1" className="border-t border-linea bg-superficie">
      <div className="mx-auto flex max-w-[1020px] flex-wrap items-center gap-4 p-[18px]">
        <p className="m-0 min-w-[220px] flex-1 text-[13px] leading-[1.55] text-pretty text-tinta-3">
          {sonDatosDeEjemplo
            ? t(
                '{{entidad}} — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00. Los datos de esta pantalla son de demostración.',
                { entidad },
              )
            : t('{{entidad}} — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00.', {
                entidad,
              })}
        </p>
        {/* Cada enlace, 44 px de alto (issue 62): el artboard no les fija medida y con la del texto
            median 20, un blanco de dedo muy chico en un telefono. */}
        <span className="flex flex-wrap gap-x-4 text-[13px]">
          <a href="#/" className={ENLACE_DEL_PIE}>
            {t('Preguntas frecuentes')}
          </a>
          <a href="#/" className={ENLACE_DEL_PIE}>
            {t('Reclamos')}
          </a>
          <a href="#/" className={ENLACE_DEL_PIE}>
            {t('Términos')}
          </a>
        </span>
      </div>
    </footer>
  );
}
