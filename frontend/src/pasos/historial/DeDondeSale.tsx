import { formatearImporte } from '@kamayuk/formato';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useHistorial, useLaSituacion, useUnidades } from '../../datos/fuente.ts';
import type { PredioDelPortal, Unidad } from '../../datos/tipos.ts';
import { AvisoConFilo } from '../../piezas/AvisoConFilo.tsx';
import { Dato, NotaAlPie, Seccion } from './piezas.tsx';

/**
 * **«De dónde sale lo que paga»** (artboard, lineas 642-669 y 1372-1375): los predios y vehiculos, con
 * los datos sobre los que se calcula cada tributo. Con las unidades publicadas, las de la fuente
 * (`useUnidades`); sin ellas, los predios que trae la consulta, sin cifra (`DeDondeSaleDeLaConsulta`).
 */

/** Un predio o vehiculo, con los datos sobre los que se calcula su tributo (lineas 649-666). */
function UnaUnidad({ unidad }: { readonly unidad: Unidad }) {
  const { t } = useTranslation();
  return (
    <li className="border-b border-linea-2 px-5 py-[15px]">
      <div className="flex flex-wrap items-start gap-[14px]">
        <span className="min-w-[200px] flex-1">
          <span className="block text-[15.5px] font-bold text-pretty">{t(unidad.titulo)}</span>
          <span className="mt-[3px] block text-[13.5px] text-pretty text-tinta-3">{t(unidad.detalle)}</span>
        </span>
        <span className="flex-[0_0_auto] text-right">
          <span className="block text-[12px] tracking-[0.07em] text-tinta-3 uppercase">{t(unidad.baseEtiqueta)}</span>
          <span className="mt-[2px] block text-[16px] font-bold tabular-nums">{formatearImporte(unidad.base)}</span>
        </span>
      </div>
      <ul className="m-0 mt-[11px] flex list-none flex-wrap gap-[9px] p-0">
        {unidad.datos.map((dato) => (
          <Dato key={dato}>{t(dato)}</Dato>
        ))}
      </ul>
      <p className="mt-[11px] mb-0 text-[13px] text-pretty text-tinta-3">{t(unidad.origen)}</p>
    </li>
  );
}

/**
 * Las unidades del contribuyente. «Mis predios y vehículos» lleva a este mismo `#/historial`, y ademas
 * deja el foco en el titulo y lo trae a la vista (`enfocarUnidades`, del reductor). En el artboard, las
 * dos opciones abren el historial igual.
 */
export function DeDondeSale({ enfocar, alEnfocar }: { readonly enfocar: boolean; readonly alEnfocar: () => void }) {
  const { t } = useTranslation();
  const unidades = useUnidades();
  const historial = useHistorial();
  const titulo = useRef<HTMLHeadingElement>(null);

  // «Mis predios y vehículos»: foco y vista en esta seccion, UNA vez, y cuando lo de arriba ya llego
  // (con la tabla de pagos vacia mientras llega, la seccion estaria mas arriba de donde se va a quedar).
  const listo = !unidades.isPending && !historial.isPending;
  useEffect(() => {
    if (!enfocar || !listo || titulo.current === null) return;
    titulo.current.focus({ preventScroll: true });
    titulo.current.scrollIntoView({ block: 'start' });
    alEnfocar();
  }, [enfocar, listo, alEnfocar]);

  return (
    <Seccion
      ocupada={unidades.isPending}
      cabecera={(idDelTitulo) => (
        <div className="border-b border-linea-2 px-5 py-[14px]">
          <h2
            id={idDelTitulo}
            ref={titulo}
            tabIndex={-1}
            className="m-0 scroll-mt-4 text-[17px] font-bold focus:outline-none"
          >
            {t('De dónde sale lo que paga')}
          </h2>
          <p className="mt-[5px] mb-0 max-w-[72ch] text-[14px] leading-[1.55] text-pretty text-tinta-3">
            {t(
              'Sus predios y vehículos, con los datos sobre los que se calcula cada tributo. Si algo no coincide con la realidad, puede pedir que se rectifique.',
            )}
          </p>
        </div>
      )}
    >
      {unidades.isError ? (
        <AvisoConFilo tono="mal" role="alert" className="m-5 px-4 py-3">
          {t('No pudimos traer sus predios y vehículos. Vuelva a intentarlo en unos minutos.')}
        </AvisoConFilo>
      ) : null}
      <ul className="m-0 list-none p-0">
        {(unidades.data ?? []).map((unidad) => (
          <UnaUnidad key={unidad.titulo} unidad={unidad} />
        ))}
      </ul>
      <NotaAlPie>
        {t(
          'El autovalúo lo determina Catastro con el arancel de su calle y los valores unitarios del año; la deuda y las cuotas las lleva Rentas; los pagos se registran en Caja.',
        )}
      </NotaAlPie>
    </Seccion>
  );
}

/**
 * Un predio **del servidor**: lo que el contrato publica de el, y nada mas (issue 28).
 *
 * El contrato trae tipo, direccion, codigo catastral y porcentaje de titularidad; **no trae el
 * autovaluo, ni los metros de frontis, ni el arancel de la calle**, que es lo que el artboard pinta
 * como «Autovalúo 2026 · S/ 38,420.50». Asi que aqui no hay cifra: dibujar un importe donde el
 * servidor no dio ninguno es exactamente lo que este portal no hace.
 */
function UnPredioDelServidor({ predio, municipalidad }: { readonly predio: PredioDelPortal; readonly municipalidad: string }) {
  const { t } = useTranslation();
  return (
    <li className="border-b border-linea-2 px-5 py-[15px]">
      <div className="flex flex-wrap items-start gap-[14px]">
        <span className="min-w-[200px] flex-1">
          <span className="block text-[15.5px] font-bold text-pretty">{predio.tipo}</span>
          <span className="mt-[3px] block text-[13.5px] text-pretty text-tinta-3">{predio.direccion}</span>
        </span>
      </div>
      <ul className="m-0 mt-[11px] flex list-none flex-wrap gap-[9px] p-0">
        <Dato>{t('Código catastral {{codigo}}', { codigo: predio.codigoCatastral })}</Dato>
        <Dato>{t('{{porcentaje}} % de titularidad', { porcentaje: predio.porcentajeDeTitularidad })}</Dato>
      </ul>
      <p className="mt-[11px] mb-0 text-[13px] text-pretty text-tinta-3">{municipalidad}</p>
    </li>
  );
}

/**
 * «De dónde sale lo que paga» **sin unidades publicadas**: los predios que devolvio la consulta. Y **no
 * hay vehiculos**: el contrato no publica la lista. Lo dice la nota de la seccion, en vez de dejar
 * pensar que no tiene ninguno.
 */
export function DeDondeSaleDeLaConsulta() {
  const { t } = useTranslation();
  const consulta = useLaSituacion();
  const predios = (consulta.data?.municipalidades ?? []).flatMap((municipalidad) =>
    municipalidad.predios.map((predio) => ({ predio, municipalidad: municipalidad.nombre })),
  );

  return (
    <Seccion
      ocupada={consulta.isPending}
      cabecera={(idDelTitulo) => (
        <div className="border-b border-linea-2 px-5 py-[14px]">
          <h2 id={idDelTitulo} className="m-0 scroll-mt-4 text-[17px] font-bold">
            {t('De dónde sale lo que paga')}
          </h2>
          <p className="mt-[5px] mb-0 max-w-[72ch] text-[14px] leading-[1.55] text-pretty text-tinta-3">
            {t(
              'Los predios que el portal publica a su nombre. El autovalúo, los metros de frontis y la tabla que se le aplica no viajan en la respuesta: se los detallan en la ventanilla.',
            )}
          </p>
        </div>
      )}
    >
      <ul className="m-0 list-none p-0">
        {predios.map(({ predio, municipalidad }) => (
          <UnPredioDelServidor key={predio.codigoCatastral} predio={predio} municipalidad={municipalidad} />
        ))}
      </ul>
      <NotaAlPie>{t('El portal todavía no publica sus vehículos: aquí solo están los predios.')}</NotaAlPie>
    </Seccion>
  );
}
