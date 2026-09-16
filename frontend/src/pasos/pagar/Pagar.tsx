import type { Importe as ImporteDecimal } from '@kamayuk/formato';
import { Boton, Campo, Etiqueta, Importe, avisar, cn } from '@kamayuk/ui';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { pasosConTotal, totalDe } from '../../datos/cuentas.ts';
import { FECHA_DE_CORTE, MEDIOS } from '../../datos/demostracion.ts';
import type { CampoDelMedio, MedioDePago } from '../../datos/tipos.ts';
import { MEDIDAS_DE_CONTROL, Rotulo } from '../../piezas/Rotulo.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { cuentaPorPagar, destinoDelComprobante, porPagar } from '../../recorrido/recorrido.ts';
import { ejemploSeTraduce } from './textosDeLosMedios.ts';

/**
 * **Paso 4 · Pagar** (`diseno/Ciudadano.dc.html`: plantilla 356-475, `@media` 24-28 y 37-38, medios
 * 808-885, logica 1202-1272).
 *
 * Elegir como pagar y confirmar. En la demostracion ningun medio cobra: confirmar despacha
 * `confirmarPago`, que SELLA el pago en el estado con los importes de `cuentaDe` y pasa al
 * comprobante; la ruta lo sigue.
 *
 * <h2>Ninguna cifra se calcula aqui</h2>
 *
 * Las filas, los tres componentes y el total salen de `cuentaPorPagar` y `porPagar` del reductor; el
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
 * <h2>Lo que la tarjeta teclea no sale del estado</h2>
 *
 * Cada campo es controlado por `valores` del recorrido (`fijarValor`), que vive en `useReducer`: en
 * memoria. Nada lo escribe en `localStorage` ni en `sessionStorage` (lo mide `Pagar.test.tsx`), y no
 * hay `<form>` que el navegador envie ni ofrezca guardar.
 *
 * <h2>Las piezas, y lo que se construye aqui</h2>
 *
 * · **El selector de medio** no tiene pieza en `@kamayuk/ui`: son `<button aria-pressed>` con `cn` y
 *   tokens. Su nombre accesible es el rotulo, y la nota lo describe (`aria-describedby`).
 * · **Los campos** son `Etiqueta` + `Campo` con el `Rotulo` y las `MEDIDAS_DE_CONTROL` de «Mis datos»;
 *   la ayuda del codigo de seguridad es la `ayuda` de `Etiqueta`, que el campo nombra con
 *   `aria-describedby`.
 * · **Los importes** son `Importe` con `fechaCalculo={FECHA_DE_CORTE}` y `fechaImplicita`.
 * · **Confirmar** es `Boton` con `--ok-tinta` de fondo y `--sobre-azul` de texto (5.45:1 en claro y 12.12:1 en oscuro;
 *   calculados en `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`).
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

/** El `autocomplete` de cada campo de la tarjeta: que el navegador sepa que dato es (WCAG 1.3.5). */
const AUTOCOMPLETAR: Readonly<Record<string, string>> = {
  tNum: 'cc-number',
  tNombre: 'cc-name',
  tVence: 'cc-exp',
  tCvv: 'cc-csc',
};

/** El medio elegido. `MEDIOS` trae los cuatro ids del tipo (lo mide `demostracion.test.ts`). */
function medioElegido(id: MedioDePago['id']): MedioDePago {
  const medio = MEDIOS.find((m) => m.id === id);
  if (medio === undefined) throw new Error(`MEDIOS no trae el medio «${id}».`);
  return medio;
}

/** `Importe` sin su fecha, con la letra que el artboard pide en ese sitio (como en el paso 2). */
function Cifra({ valor, className }: { readonly valor: ImporteDecimal; readonly className?: string }) {
  return (
    <span className={cn('[&_span]:font-normal', className)}>
      <Importe valor={valor} fechaCalculo={FECHA_DE_CORTE} fechaImplicita />
    </span>
  );
}

/** El icono de un medio: sus trazos, en una caja de 30 px (artboard, lineas 367-373 y 1210). */
function IconoDelMedio({ trazos, activo }: { readonly trazos: readonly string[]; readonly activo: boolean }) {
  return (
    <span
      className={cn(
        'grid size-[30px] flex-[0_0_auto] place-items-center rounded-sm',
        activo ? 'bg-azul text-sobre-azul' : 'bg-fondo text-tinta-3',
      )}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {trazos.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

/** Un boton del selector (lineas 365-377 y 1204-1214). */
function BotonDeMedio({ medio }: { readonly medio: MedioDePago }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const id = useId();
  const activo = estado.medio === medio.id;

  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-labelledby={`${id}-rotulo`}
      aria-describedby={`${id}-nota`}
      onClick={() => despachar({ tipo: 'elegirMedio', medio: medio.id })}
      className={cn(
        'block min-h-[88px] w-full cursor-pointer rounded-sm text-left',
        activo ? 'border-2 border-azul bg-azul-suave px-[14px] py-[13px]' : 'border border-linea bg-superficie px-[15px] py-[14px]',
      )}
    >
      <span className="flex items-center gap-[10px]">
        <IconoDelMedio trazos={medio.icono} activo={activo} />
        <span id={`${id}-rotulo`} className="min-w-0 flex-1 text-left text-[15px] font-bold">
          {t(medio.rotulo)}
        </span>
      </span>
      <span id={`${id}-nota`} className="mt-[7px] block text-left text-[13px] leading-[1.5] text-pretty text-tinta-3">
        {t(medio.nota)}
      </span>
    </button>
  );
}

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
  const pasos = pasosConTotal(
    (medio.pasos ?? []).map((paso) => t(paso)),
    cuentaPorPagar(estado).conAmnistia,
  );

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

/** El panel del medio elegido, con su pie y el boton de confirmar (lineas 380-449 y 1215-1244). */
function PanelDelMedio({ medio }: { readonly medio: MedioDePago }) {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelTitulo = useId();
  const nada = porPagar(estado).length === 0;
  const campos = medio.campos ?? [];

  const confirmar = () => {
    if (nada) {
      avisar(t('No hay nada que pagar.'));
      return;
    }
    // El destino se lee ANTES de despachar: es el que el reductor sella en `ultimo`.
    const destino = destinoDelComprobante(estado) ?? t('su correo');
    despachar({ tipo: 'confirmarPago' });
    avisar(t('Pago registrado. Le enviamos el comprobante a {{destino}}.', { destino }));
  };

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
        <Boton
          type="button"
          variante="primario"
          aria-disabled={nada}
          onClick={confirmar}
          className={cn(
            // El verde del artboard es `--ok-tinta`; su hover (`#326032`) no es token: se oscurece el mismo.
            'min-h-[48px] px-7 py-0 text-[16px] bg-ok-tinta hover:bg-ok-tinta hover:brightness-90',
            nada && 'bg-linea text-tinta-2 hover:bg-linea hover:brightness-100',
          )}
        >
          {t(medio.boton)}
        </Boton>
      </div>
    </section>
  );
}

/**
 * Una fila de los totales del resumen (lineas 459-464 y 1235-1244). El color es del importe, no del
 * rotulo: el artboard solo pinta `t.color` en la cifra.
 */
function Total({
  rotulo,
  children,
  className,
  tintaDeLaCifra,
}: {
  readonly rotulo: string;
  readonly children: ReactNode;
  readonly className: string;
  readonly tintaDeLaCifra?: string;
}) {
  return (
    <div className={cn('flex items-baseline gap-3 px-[18px]', className)}>
      <dt className="min-w-0 flex-1">{rotulo}</dt>
      <dd className={cn('m-0 flex-[0_0_auto] tabular-nums', tintaDeLaCifra)}>{children}</dd>
    </div>
  );
}

/** «Lo que va a pagar», pegado arriba; a ≤ 820 px, encima y sin pegar (lineas 447-473). */
function Resumen() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelTitulo = useId();
  const conceptos = porPagar(estado);
  const lo = cuentaPorPagar(estado);
  const destino = destinoDelComprobante(estado) ?? t('su correo');

  return (
    <section
      aria-labelledby={idDelTitulo}
      data-resumen=""
      className="sticky top-[14px] border border-linea bg-superficie max-[821px]:static max-[821px]:-order-1"
    >
      <div className="border-b border-linea-2 bg-sup px-[18px] py-[14px]">
        <h2 id={idDelTitulo} className="m-0 text-[15.5px] font-bold">
          {t('Lo que va a pagar')}
        </h2>
      </div>

      {conceptos.length === 0 ? (
        <p className="m-0 px-[18px] py-[14px] text-[14px] text-pretty text-tinta-2">{t('No hay nada que pagar.')}</p>
      ) : (
        <>
          <ul className="m-0 list-none p-0">
            {conceptos.map((deuda) => (
              <li key={deuda.id} className="flex items-baseline gap-3 border-b border-linea-2 px-[18px] py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-pretty">{deuda.concepto}</span>
                  <span className="mt-[2px] block text-[12.5px] text-tinta-3">{deuda.cuotas}</span>
                </span>
                <Cifra valor={totalDe(deuda)} className="flex-[0_0_auto] text-[14px]" />
              </li>
            ))}
          </ul>
          <dl className="m-0 text-[14px]">
            <Total rotulo={t('Impuesto y arbitrios')} className="py-[9px]">
              <Cifra valor={lo.insoluto} />
            </Total>
            <Total
              rotulo={t('Interés condonado')}
              className="border-t border-linea-2 py-[9px]"
              tintaDeLaCifra="text-ok-tinta"
            >
              {'− '}
              <Cifra valor={lo.interes} className="[&_span]:text-ok-tinta" />
            </Total>
            <Total rotulo={t('Gastos y costas')} className="border-t border-linea-2 py-[9px]">
              <Cifra valor={lo.gastos} />
            </Total>
            <Total
              rotulo={t('Total a pagar')}
              className="border-t-2 border-linea bg-sup py-[14px] text-[19px] font-bold"
              tintaDeLaCifra="text-azul"
            >
              <Cifra valor={lo.conAmnistia} className="[&_span]:font-bold [&_span]:text-azul" />
            </Total>
          </dl>
        </>
      )}

      <div className="border-t border-linea-2 px-[18px] py-[13px]">
        <p className="m-0 text-[12.5px] leading-[1.55] text-pretty text-tinta-3">
          {t('El comprobante se enviará a {{destino}}.', { destino })}
        </p>
        <Boton
          type="button"
          variante="fantasma"
          onClick={() => despachar({ tipo: 'irA', paso: estado.numero === '' ? 'buscar' : 'deudas' })}
          className="mt-[10px] min-h-0 p-0 text-[13.5px] underline hover:bg-transparent print:hidden"
        >
          {conceptos.length > 0
            ? t('Cambiar lo que voy a pagar')
            : estado.numero === ''
              ? t('Buscar mi deuda')
              : t('Elegir qué pago')}
        </Boton>
      </div>
    </section>
  );
}

export function Pagar() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();
  const medio = medioElegido(estado.medio);

  return (
    <div
      data-pagar=""
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,320px)] items-start gap-[18px] max-[821px]:grid-cols-[minmax(0,1fr)]"
    >
      <div className="min-w-0">
        <h1 className="m-0 mb-[6px] text-[24px] font-bold text-pretty text-azul">{t('¿Cómo quiere pagar?')}</h1>
        <p className="mt-0 mb-[18px] max-w-[62ch] text-[15.5px] leading-[1.6] text-pretty text-tinta-2">
          {t(
            'Elija un medio de pago. Con tarjeta, Yape o pagalo.pe el pago se aplica al instante; con código de banco se aplica al día siguiente hábil.',
          )}
        </p>

        <div
          data-medios=""
          className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-3 max-[521px]:grid-cols-[minmax(0,1fr)]"
        >
          {MEDIOS.map((m) => (
            <BotonDeMedio key={m.id} medio={m} />
          ))}
        </div>

        <PanelDelMedio medio={medio} />
      </div>

      <Resumen />
    </div>
  );
}
