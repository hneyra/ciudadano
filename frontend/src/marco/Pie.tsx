import { useTranslation } from 'react-i18next';

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
 */
export function Pie() {
  const { t } = useTranslation();
  return (
    <footer data-noprint="1" className="border-t border-linea bg-superficie">
      <div className="mx-auto flex max-w-[1020px] flex-wrap items-center gap-4 p-[18px]">
        <p className="m-0 min-w-[220px] flex-1 text-[13px] leading-[1.55] text-pretty text-tinta-3">
          {t(
            '{{entidad}} — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00. Los datos de esta pantalla son de demostración.',
            { entidad: t('Municipalidad Distrital de Catacaos') },
          )}
        </p>
        <span className="flex flex-wrap gap-4 text-[13px]">
          <a href="#/">{t('Preguntas frecuentes')}</a>
          <a href="#/">{t('Reclamos')}</a>
          <a href="#/">{t('Términos')}</a>
        </span>
      </div>
    </footer>
  );
}
