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
| `plataforma-3-pagar-simulado.png` | Paso 3 · Pagar, con el aviso permanente y el boton «Simular el pago: no se cobra nada» |
| `plataforma-4-comprobante-simulado.png` | Paso 4 · Comprobante, con el mismo aviso y el contribuyente que dijo el servidor |
| `plataforma-5-mis-pagos.png` | «Mis pagos»: el historial que el portal todavia no publica, lo pendiente sin insignia y los predios de la consulta |
