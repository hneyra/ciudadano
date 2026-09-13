import { useTranslation } from 'react-i18next';

/**
 * **El marcador del andamiaje**: la pagina que `yarn dev` sirve mientras no hay pantallas.
 *
 * Dice lo mismo que la barra del artboard (`diseno/Ciudadano.dc.html`, lineas 65-66): el titulo
 * «Pago de tributos en línea» y la entidad, que alli es la prop `entidad` con valor
 * «Municipalidad Distrital de Catacaos» (linea 692). Los dos textos pasan por `t()` —lo demuestra
 * `aplicacion.test.tsx` con el idioma `marcado`— para que la primera pantalla de verdad no herede
 * una cadena escrita a pelo.
 *
 * Sin clases de color a proposito: el tema de este portal es el issue 2.
 */
export function Aplicacion() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('Pago de tributos en línea')}</h1>
      <p>{t('Municipalidad Distrital de Catacaos')}</p>
    </main>
  );
}
