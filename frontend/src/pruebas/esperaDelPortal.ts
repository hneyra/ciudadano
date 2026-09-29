import { configure } from '@testing-library/react';

import { ESPERA_DEL_PORTAL } from './plazos.ts';

/**
 * **La espera de Testing Library del proyecto `portal`** (issue 63): la preparacion que
 * `vitest.config.ts` le pone solo a ese proyecto, despues de la comun (`vitest.setup.ts`).
 *
 * `configure` vive en el modulo de Testing Library, que con `isolate` es uno por archivo: puesta aqui,
 * vale para cada archivo del proyecto y para ninguno de los otros dos. El plazo del caso no hace falta
 * ponerlo a mano: es el `testTimeout` del proyecto.
 */
configure({ asyncUtilTimeout: ESPERA_DEL_PORTAL });
