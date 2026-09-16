# Capturas del issue 28

El recorrido con plataforma empieza por entrar, y el pago queda simulado y dicho.

Tomadas con Playwright sobre **los bundles construidos**, a 1180 px y de pagina entera
(`e2e/portal.ts` + el backend falso de `e2e/recorrido-con-plataforma.spec.ts`: el emisor de
identidad y `GET /portal/situacion` puestos con `page.route`).

## Demostracion — no cambia nada (`yarn build:arnes`)

| | |
|---|---|
| `demostracion-1-buscar.png` | Paso 1 · Buscar mi deuda, con sus cinco pasos en la franja |
| `demostracion-2-deudas.png` | Paso 2 · Elegir que pago, con cuotas, vencimientos e insignias del artboard |

## Con plataforma (`yarn build`, el paquete de produccion)

| | |
|---|---|
| `plataforma-1-entrar.png` | Paso 1 · **Entrar**, con la franja de CUATRO pasos, «Que puede hacer aqui» y la amnistia |
| `plataforma-2-deuda-del-servidor.png` | Paso 2 · la deuda del servidor: cada importe con SU fecha, el desglose abierto diciendo que el portal no lo publica, y ninguna insignia de estado |
| `plataforma-3-pagar-simulado.png` | Paso 3 · **no hay medio de pago que ofrecer**, y se dice. Sin el numero para yapear ni el codigo de banco del artboard, que son datos accionables |
| `plataforma-4-comprobante-simulado.png` | Paso 4 · «Así se vería su comprobante»: un **comprobante de ejemplo**, sin numero, sin numero de operacion, sin «Enviado a», con «Total que se pagaría», y diciendo que no se cobro nada, no se envio nada y la deuda no cambio |
| `plataforma-5-mis-pagos.png` | «Mis pagos»: el historial que el portal todavia no publica, el pago simulado **que no cuenta como pago**, lo pendiente todavia pendiente y los predios de la consulta |
