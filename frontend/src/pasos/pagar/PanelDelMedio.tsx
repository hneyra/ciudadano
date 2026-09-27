import { Campo, Etiqueta, cn } from '@kamayuk/ui';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { CampoDelMedio, MedioDePago } from '../../datos/tipos.ts';
import { MEDIDAS_DE_CONTROL, Rotulo } from '../../piezas/Rotulo.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { BotonDeConfirmar, useConfirmarElPago } from './confirmar.tsx';
import { ejemploSeTraduce } from './textosDeLosMedios.ts';
import { pasosDelMedio } from './vista.ts';

/**
 * **El panel del medio elegido** (artboard, lineas 380-449 y 1215-1244): sus campos, su codigo y sus
 * pasos, los bancos donde se paga, y el pie con el boton de confirmar. Solo en demostracion.
 *
 * · **Los campos** son `Etiqueta` + `Campo` con el `Rotulo` y las `MEDIDAS_DE_CONTROL` de «Mis datos»;
 *   la ayuda del codigo de seguridad es la `ayuda` de `Etiqueta`, que el campo nombra con
 *   `aria-describedby`.
 * · **Lo que la tarjeta teclea no sale del estado.** Cada campo es controlado por `valores` del
 *   recorrido (`fijarValor`), que vive en `useReducer`: en memoria. Nada lo escribe en el
 *   almacenamiento del navegador (lo mide `Pagar.test.tsx`), y no hay `<form>` que el navegador envie
 *   ni ofrezca guardar.
 */

/** El `autocomplete` de cada campo de la tarjeta: que el navegador sepa que dato es (WCAG 1.3.5). */
const AUTOCOMPLETAR: Readonly<Record<string, string>> = {
  tNum: 'cc-number',
  tNombre: 'cc-name',
  tVence: 'cc-exp',
  tCvv: 'cc-csc',
};

/** Un campo de la tarjeta: su valor vive en `valores` del recorrido (lineas 388-406 y 1219-1228). */
function CampoDeTarjeta({ campo }: { readonly campo: CampoDelMedio }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();

  return (
    <Etiqueta
      rotulo={<Rotulo>{t(campo.etiqueta)}</Rotulo>}
      ayuda={campo.ayuda === undefined ? undefined : t(campo.ayuda)}
      className={cn(
        'min-w-0 p-2 [&_[data-slot=ayuda]]:text-[12.5px] [&_label]:mb-[6px]',
        campo.ancho === 2 ? 'flex-[1_1_100%]' : 'flex-[1_1_168px]',
      )}
    >
      <Campo
        value={estado.valores[campo.clave] ?? ''}
        onChange={(evento) => despachar({ tipo: 'fijarValor', clave: campo.clave, valor: evento.target.value })}
        placeholder={ejemploSeTraduce(campo.ejemplo) ? t(campo.ejemplo) : campo.ejemplo}
        autoComplete={AUTOCOMPLETAR[campo.clave]}
        className={MEDIDAS_DE_CONTROL}
      />
    </Etiqueta>
  );
}

/** El codigo que se lleva al banco o a la aplicacion, y los pasos (lineas 411-427). */
function CodigoDelMedio({ medio }: { readonly medio: MedioDePago }) {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  if (medio.codigo === undefined) return null;
  const pasos = pasosDelMedio(medio, estado, t);

  return (
    <div className="px-5 pt-[18px] pb-5">
      <div className="border border-dashed border-azul bg-info-fondo p-[18px] text-center">
        <p className="m-0 text-[13px] tracking-[0.09em] text-azul uppercase">
          {medio.codigoEtiqueta === undefined ? null : t(medio.codigoEtiqueta)}
        </p>
        <p
          data-codigo=""
          className="mt-2 mb-0 text-[31px] font-bold tracking-[0.1em] text-azul tabular-nums wrap-anywhere max-[821px]:text-[24px] max-[821px]:tracking-[0.04em] max-[521px]:text-[21px]"
        >
          {medio.codigo}
        </p>
        <p className="mt-[9px] mb-0 text-[13.5px] text-pretty text-tinta-2">
          {medio.codigoNota === undefined ? null : t(medio.codigoNota)}
        </p>
      </div>
      {pasos.length === 0 ? null : (
        <ol className="mt-4 mb-0 list-decimal pl-[22px] text-[14.5px] leading-[1.7] text-tinta-2">
          {pasos.map((paso) => (
            <li key={paso} className="mb-[5px] text-pretty">
              {paso}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** «Dónde puede pagarlo»: los seis bancos (lineas 430-442). */
function Bancos({ medio }: { readonly medio: MedioDePago }) {
  const { t } = useTranslation();
  const idDelTitulo = useId();
  const bancos = medio.bancos ?? [];
  if (bancos.length === 0) return null;

  return (
    <div className="px-5 pt-1 pb-[18px]">
      <p id={idDelTitulo} className="mt-[14px] mb-[10px] text-[13px] font-bold tracking-[0.07em] text-tinta-3 uppercase">
        {t('Dónde puede pagarlo')}
      </p>
      <ul
        aria-labelledby={idDelTitulo}
        data-bancos=""
        className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(186px,1fr))] border border-linea p-0 max-[521px]:grid-cols-[minmax(0,1fr)]"
      >
        {bancos.map((banco, i) => (
          <li key={banco.nombre} className={cn('px-[15px] py-[13px]', i === 0 ? null : 'border-t border-linea-2')}>
            <span className="block text-[14.5px] font-bold">{banco.nombre}</span>
            <span className="mt-[3px] block text-[13px] text-tinta-3">{t(banco.canales)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PanelDelMedio({ medio }: { readonly medio: MedioDePago }) {
  const { t } = useTranslation();
  const idDelTitulo = useId();
  const { nada, confirmar } = useConfirmarElPago();
  const campos = medio.campos ?? [];

  return (
    <section aria-labelledby={idDelTitulo} className="border border-linea bg-superficie">
      <div className="border-b border-linea-2 px-5 py-[14px]">
        <h2 id={idDelTitulo} className="m-0 text-[17px] font-bold">
          {t(medio.titulo)}
        </h2>
        <p className="mt-[5px] mb-0 max-w-[66ch] text-[14px] leading-[1.55] text-pretty text-tinta-3">
          {t(medio.detalleNota)}
        </p>
      </div>

      {campos.length === 0 ? null : (
        <div className="flex flex-wrap px-3 pt-2 pb-4">
          {campos.map((campo) => (
            <CampoDeTarjeta key={campo.clave} campo={campo} />
          ))}
        </div>
      )}

      <CodigoDelMedio medio={medio} />
      <Bancos medio={medio} />

      <div className="flex flex-wrap items-center gap-3 border-t border-linea-2 bg-sup px-5 py-4">
        <p className="m-0 min-w-[180px] flex-1 text-[13.5px] leading-[1.55] text-pretty text-tinta-3">
          {t(medio.aviso)}
        </p>
        <BotonDeConfirmar rotulo={t(medio.boton)} nada={nada} alConfirmar={confirmar} />
      </div>
    </section>
  );
}
