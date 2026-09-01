# Matriz de modulos para SaaS cafetero

Este documento define el primer paso para convertir el sistema actual en una plataforma multiempresa sin romper el flujo probado de Finca Anaya.

La idea principal es que el backend y el frontend sigan siendo uno solo, pero cada empresa tenga configuracion propia: modulos activos, permisos, marca visual y reglas operativas.

## Principio base

Antes de activar o desactivar modulos por empresa, cada modulo debe declarar:

- Que datos necesita.
- De que otros modulos depende.
- Que pasa si se apaga.
- Que roles pueden usarlo.
- Si hace parte del nucleo obligatorio.
- Si sus reglas pueden cambiar por empresa.

Esto evita que una empresa tenga una combinacion de modulos que deje pantallas rotas, botones sin datos o flujos incompletos.

## Nucleo obligatorio

Estos modulos deben estar siempre activos para cualquier empresa.

| Modulo | Para que sirve | Depende de | Se puede apagar | Riesgo si se apaga |
| --- | --- | --- | --- | --- |
| Empresas / configuracion | Define la empresa, marca, modulos y reglas | Ninguno | No | No se podria separar datos ni personalizar el sistema |
| Usuarios y roles | Controla acceso por persona | Empresas | No | No habria seguridad ni separacion por empresa |
| Clientes | Base para cotizaciones, ventas y muestras | Empresas | No recomendado | Ventas, cotizaciones y muestras quedarian sin cliente |
| Proveedores | Base para compras, recepcion y lotes | Empresas | No recomendado | Recepcion y compras quedarian incompletas |
| Inventario | Control de lotes, procesos y cafe disponible | Empresas, proveedores, perfiles | No | El sistema pierde su control principal |
| Historiales | Trazabilidad de movimientos y estados | Inventario, ventas, compras | No | No habria auditoria ni soporte operativo |
| Documentos / PDFs | Ordenes, cotizaciones, pedidos e historicos | Modulos que generan documentos | No recomendado | Se pierde soporte fisico y administrativo |

## Modulos comerciales

| Modulo | Para que sirve | Depende de | Puede apagarse | Que pasa si se apaga |
| --- | --- | --- | --- | --- |
| Perfiles de venta | Define cafes vendidos, codigos y recetas de referencia | Inventario | Si | Cotizaciones y pedidos pierden catalogo comercial |
| Listas de precios | Precios por cafe/presentacion/moneda | Perfiles de venta | Si | Cotizaciones deben ingresar precios manuales |
| Cotizaciones | Crear ofertas a clientes | Clientes, perfiles de venta | Si | La empresa solo podria crear pedidos directos si ese modo existe |
| Ordenes de pedido / ventas | Gestionar ventas aceptadas | Clientes, inventario | Si, solo en empresas sin ventas | No hay despacho ni historico de ventas |
| Historico de ventas | Consultar ventas despachadas y pagos | Ordenes de pedido | Si | Contabilidad pierde seguimiento de cobros |
| Pagos de ventas | Registrar pagos parciales o totales | Historico de ventas | Si | No se controla cartera desde el sistema |
| Muestras | Solicitudes y salidas de muestras | Clientes, inventario, perfiles de venta | Si | La empresa no gestiona muestras dentro del sistema |

## Modulos de compra

| Modulo | Para que sirve | Depende de | Puede apagarse | Que pasa si se apaga |
| --- | --- | --- | --- | --- |
| Perfiles de compra | Catalogo de cafes comprados y precio base | Proveedores | Si | Recepcion queda mas manual |
| Recepcion | Entrada de cafe comprado, pasilla, recuperacion y procesos | Proveedores, inventario | Si | La empresa debe cargar inventario por ajustes o importacion |
| Laboratorio | Aprobar/rechazar cafes recibidos | Recepcion | Si, con flujo simplificado | Se elimina el filtro de calidad antes de inventario/liquidacion |
| Liquidaciones | Aceptar compras y calcular pagos | Recepcion, laboratorio, proveedores | Si | Compras no generan cuentas por pagar |
| Ordenes de compra | Documento y soporte de cafe liquidado | Liquidaciones | Si | No hay documento formal de compra |
| Historico aceptados | Consulta de lotes comprados aprobados | Laboratorio/liquidaciones | Si | Menor trazabilidad de compras |
| Historico rechazados | Consulta de lotes rechazados | Laboratorio | Si | Rechazos quedan fuera del sistema |
| Historico retirados | Consulta de cafes retirados manualmente | Inventario | No recomendado | Se mezclan retiros con rechazos y se pierde claridad |

## Modulos operativos

| Modulo | Para que sirve | Depende de | Puede apagarse | Que pasa si se apaga |
| --- | --- | --- | --- | --- |
| Resumen inventario | Vista agregada para decisiones rapidas | Inventario | Si | Usuarios tipo Sergio pierden vista resumida |
| Reservas manuales | Separar cafe para pedidos o motivos internos | Inventario | Si | Todo el cafe libre queda disponible para pedidos |
| Trilladora | Enviar pergamino y recibir excelso | Inventario | Si | No se controla transformacion por trilla |
| Seleccionadora | Enviar cafe a seleccion y recibirlo | Inventario | Si | No se controla salida/regreso por seleccion |
| Lotes en finca | Ver cafe enviado a finca | Inventario | Si | No se controla cafe fuera de bodega por finca |
| Procesos | Control de cafes procesados o ensamblados | Inventario, laboratorio si aplica | Si | Procesos entran como inventario simple |
| Deficit / necesidades | Guia de cantidades por ventas aceptadas | Ventas, perfiles de venta | Si | Bodega pierde guia agregada de necesidades |
| Consecutivos | Control de codigos de lotes/procesos/documentos | Inventario, compras, ventas | No recomendado | Se pueden romper talonarios y trazabilidad |

## Compatibilidad entre modulos

Estas reglas deberian aplicarse desde un panel padre para impedir combinaciones invalidas.

| Si activas | Tambien debe estar activo | Motivo |
| --- | --- | --- |
| Cotizaciones | Clientes, perfiles de venta | Una cotizacion necesita cliente y cafe ofrecido |
| Listas de precios | Perfiles de venta | Los precios pertenecen a cafes/perfiles |
| Ordenes de pedido | Clientes, inventario | Una venta necesita cliente y cafe para descontar |
| Historico de ventas | Ordenes de pedido | Solo deben aparecer ventas despachadas |
| Pagos de ventas | Historico de ventas | Los pagos se registran sobre ventas despachadas |
| Muestras | Clientes, inventario | Se solicitan para clientes y descuentan cafe |
| Recepcion | Proveedores, inventario | Una entrada necesita origen y crea lote |
| Laboratorio | Recepcion | Revisa lotes recibidos |
| Liquidaciones | Recepcion, laboratorio, proveedores | Liquida compras aceptadas |
| Ordenes de compra | Liquidaciones | Documento de compra nace de una liquidacion |
| Trilladora | Inventario, consecutivos | Sale un lote y vuelve con control de codigo |
| Seleccionadora | Inventario, consecutivos | Sale un lote y vuelve con control de codigo |
| Lotes en finca | Inventario, consecutivos | Sale cafe de bodega y debe regresar como proceso |
| Reservas manuales | Inventario | Reservar solo tiene sentido sobre lote existente |
| Deficit / necesidades | Ordenes de pedido, perfiles de venta | Agrupa cantidades pedidas por cafe/perfil |

## Reglas configurables por empresa

Estas reglas no deberian quedar quemadas en el codigo para todas las empresas.

| Regla | Ejemplo Finca Anaya | Puede cambiar por empresa |
| --- | --- | --- |
| Requiere laboratorio antes de alistar | Si | Si |
| Procesos piden solo intensidad | Si | Si |
| Trilla convierte pergamino a excelso | Si | Si |
| Procesos necesitan liquidacion | No | Si |
| Cotizacion aceptada desaparece de cotizaciones | Si | Si |
| Venta solo entra a historico si esta despachada | Si | No recomendado cambiar |
| Se permite reserva manual de inventario | Si | Si |
| Se permite despacho sin cafe descontado | No | Si, pero no recomendado |
| Se usan codigos internos de perfiles | Si | Si |
| Se usa el mismo consecutivo para lotes/procesos | Si | Si |

## Packs recomendados

### Pack minimo operativo

Este seria el minimo sano para que una empresa use el sistema sin flujo de compra complejo.

- Empresas / configuracion
- Usuarios y roles
- Clientes
- Proveedores
- Inventario
- Perfiles de venta
- Cotizaciones
- Ordenes de pedido
- Historico de ventas
- Documentos / PDFs
- Historiales

### Pack comercial

Para una empresa que vende cafe y necesita cotizar, despachar y cobrar.

- Todo el pack minimo operativo
- Listas de precios
- Pagos de ventas
- Muestras
- Resumen inventario
- Reservas manuales
- Deficit / necesidades

### Pack compra y venta

Para empresas que compran cafe a proveedores y luego venden.

- Todo el pack comercial
- Perfiles de compra
- Recepcion
- Laboratorio
- Liquidaciones
- Ordenes de compra
- Historico aceptados
- Historico rechazados
- Historico retirados

### Pack operativo completo

Este es el equivalente cercano a Finca Anaya.

- Todo el pack compra y venta
- Trilladora
- Seleccionadora
- Lotes en finca
- Procesos
- Consecutivos avanzados

## Configuracion sugerida para Finca Anaya

Finca Anaya debe quedar como preset protegido, para que el SaaS nuevo no dañe lo que ya funciona.

```json
{
  "workflowPreset": "finca_anaya",
  "modules": {
    "dashboard": true,
    "management": true,
    "inventorySummary": true,
    "reception": true,
    "inventory": true,
    "liquidations": true,
    "sampleOutputs": true,
    "farmShipments": true,
    "lotReservations": true,
    "warehouseOrders": true,
    "threshing": true,
    "sorting": true,
    "laboratory": true,
    "quotes": true,
    "salesOrders": true,
    "samples": true,
    "acceptedHistory": true,
    "rejectedHistory": true,
    "withdrawnHistory": true,
    "salesHistory": true,
    "samplesHistory": true,
    "clients": true,
    "suppliers": true,
    "purchaseProfiles": true,
    "saleProfiles": true,
    "codeCounters": true,
    "backups": true,
    "users": true
  },
  "workflow": {
    "requireLabBeforeWarehouse": true,
    "processLabMode": "intensity_only",
    "allowManualInventoryReservation": true,
    "requireInventoryOutputsBeforeDispatch": true,
    "hideAcceptedQuotesFromQuoteList": true,
    "salesHistoryOnlyDispatched": true,
    "sameCounterForLotsAndProcesses": true
  }
}
```

## Como deberia funcionar el panel padre

El panel padre no deberia dejar prender modulos uno por uno sin validar dependencias.

Flujo recomendado:

1. Crear empresa.
2. Seleccionar pack inicial.
3. Cargar branding: nombre, logo y color.
4. Crear usuarios.
5. Activar modulos extra solo si sus dependencias estan completas.
6. Guardar reglas operativas por empresa.
7. Probar empresa en modo sandbox antes de entregarla.

## Decisiones importantes antes de programar multiempresa

- Definir si todas las empresas comparten la misma base con `company_id`. Recomendado: si.
- Definir si el login sera por subdominio, ruta o selector de empresa.
- Definir nombre de marca padre: Coffee Sales, CoffeeOps u otro.
- Definir el primer pack vendible.
- Definir que reglas de Finca Anaya quedan protegidas como preset.
- Definir que modulos puede comprar una empresa nueva al inicio.

## Siguiente paso recomendado

Antes de tocar codigo multiempresa, el siguiente paso deberia ser crear un archivo de configuracion inicial de modulos y rutas, basado en esta matriz.

Ese archivo permitiria que el frontend oculte modulos por empresa y que el backend valide permisos sin cambiar todavia toda la base de datos.
