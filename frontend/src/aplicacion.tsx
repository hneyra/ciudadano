import { ProveedorDeTema, type ConfiguracionDeTema } from '@kamayuk/ui';
import { RouterProvider } from 'react-router-dom';

import type { Enrutador } from './enrutador.tsx';
import { ProveedorDelRecorrido } from './recorrido/ProveedorDelRecorrido.tsx';
import type { EstadoDelRecorrido } from './recorrido/recorrido.ts';

/**
 * **El tema de este portal** (issue 2): dos decisiones, y ningun color.
 *
 * · `identidadPorOmision: 'clasico'`: la paleta del artboard —azul `#0D5FA8`, Arial, filos grises,
 *   las insignias de siempre— vive en `@kamayuk/ui` como identidad `clasico` (`kamayuk-lib`#56). El
 *   portal la ELIGE; no la escribe. Que siga siendo la del artboard lo mide
 *   `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`, y que aqui no se escriba ningun
 *   color, `verificaciones/sin-colores-propios.test.ts`.
 * · `prefijoDeClaves: 'kamayuk.ciudadano'`: el mismo motivo que en `rentas` (rentas#111). Las
 *   interfaces del producto pueden servirse del mismo origen y compartir el almacenamiento del
 *   navegador; sin prefijo propio, elegir un tema en otra se lo cambiaria a esta.
 *
 * **El modo no se declara**, como en `rentas`: ausente es «el del equipo», y el oscuro sale derivado
 * por la libreria. Un oscuro a medida esta fuera del alcance del issue.
 */
const TEMA: ConfiguracionDeTema = {
  identidadPorOmision: 'clasico',
  prefijoDeClaves: 'kamayuk.ciudadano',
};

/**
 * **El portal**: el tema, el estado del recorrido y el enrutador, en ese orden.
 *
 * · **El proveedor del tema envuelve TODO**, y es lo primero que se monta: lo que se dibuje sin el
 *   se dibuja con la paleta de `institucional`, que es la del `:root`.
 * · **El recorrido va por encima del enrutador** (issue 4): cambiar de ruta no lo desmonta, asi que
 *   ir de `#/pagar` a `#/deudas` y volver no pierde lo marcado ni lo pagado.
 * · **El enrutador llega hecho**, como el cliente de consultas: se crea una vez fuera del render
 *   (`main.tsx`), y cada prueba crea el suyo (`crearEnrutador`, en `src/enrutador.tsx`).
 *
 * La barra, la franja y el pie son `src/marco/`; cada paso, por ahora, un marcador con su titulo.
 * `inicial` es para las pruebas: empezar con sesion o en un paso dado sin recorrerlo entero.
 */
export interface AplicacionProps {
  readonly enrutador: Enrutador;
  readonly inicial?: EstadoDelRecorrido;
}

export function Aplicacion({ enrutador, inicial }: AplicacionProps) {
  return (
    <ProveedorDeTema configuracion={TEMA}>
      <ProveedorDelRecorrido inicial={inicial}>
        <RouterProvider router={enrutador} />
      </ProveedorDelRecorrido>
    </ProveedorDeTema>
  );
}
