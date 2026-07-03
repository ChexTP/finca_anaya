# Guia Del Backend

Esta guia explica como iniciar y probar el backend del sistema Finca Anaya.

## Tecnologia

- Node.js
- Express
- PostgreSQL
- JWT para autenticacion
- bcryptjs para contrasenas

## Estructura

```txt
backend/
  src/
    app.js
    index.js
    config.js
    db.js
    routes/
    controllers/
    models/
    middlewares/
    db/
```

El flujo del codigo debe mantenerse simple:

```txt
routes -> controllers -> models -> db
```

## Instalacion

Desde la carpeta del backend:

```bash
npm install
```

Crear un archivo `.env` basado en `.env.example`:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finca_anaya
JWT_SECRET=change_this_secret
FRONTEND_URL=http://localhost:5173
```

## Base De Datos

Crear las tablas:

```bash
npm run db:schema
```

Este comando usa Node y la variable `DATABASE_URL`, por eso no depende de tener `psql` configurado en la consola.

Crear datos iniciales:

```bash
npm run db:seed
```

Usuarios iniciales:

| Rol | Usuario | Contrasena |
| --- | --- | --- |
| Administrador | `admin` | `admin123` |
| Bodega | `bodega` | `bodega123` |
| Laboratorio | `laboratorio` | `laboratorio123` |
| Contabilidad | `contabilidad` | `contabilidad123` |

El administrador podra crear vendedores desde el sistema.

## Ejecutar

Modo desarrollo:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

## Endpoints Iniciales

### Estado

```http
GET /api/health
GET /api/health/db
```

### Autenticacion

```http
POST /api/auth/login
GET /api/auth/me
```

Login:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

La respuesta entrega un token JWT. Los endpoints protegidos usan:

```http
Authorization: Bearer TOKEN
```

### Usuarios

Solo administrador:

```http
GET /api/users
POST /api/users/sellers
PUT /api/users/:id/password
PUT /api/users/:id/status
```

Crear vendedor:

```json
{
  "name": "Vendedor 1",
  "username": "vendedor1",
  "password": "vendedor123"
}
```

### Catalogos

```http
GET /api/catalogs
PUT /api/catalogs/coffee-profiles/:id
```

Devuelve los catalogos necesarios para formularios:

- Tipos de cafe.
- Perfiles de cafe.
- Tipos de embalaje.
- Metodos de pago.
- Categorias de cuentas por pagar.

Actualizar perfil comercial:

```json
{
  "name": "Perfil 1",
  "basePriceCop": 45000,
  "basePriceUsd": 18,
  "isActive": true
}
```

Reglas implementadas:

- Administrador y contabilidad pueden actualizar perfiles comerciales.
- El nombre del perfil es obligatorio.
- Los precios base COP y USD no pueden ser negativos.
- El precio base sirve como referencia para cotizaciones.
- El vendedor puede cambiar el precio negociado en la cotizacion sin modificar el precio base del perfil.

### Dashboard Y Alertas

```http
GET /api/dashboard
```

Este endpoint devuelve contadores y alertas segun el rol autenticado.

Respuesta general:

```json
{
  "counters": {
    "availableInventoryKg": 1200,
    "lowInventoryGroups": 1,
    "labPendingLots": 2,
    "activeProcesses": 1,
    "pendingQuotes": 3,
    "salesToPrepare": 1,
    "dispatchedSalesWithDebt": 1,
    "overdueSales": 0,
    "overduePayables": 0
  },
  "alerts": [
    {
      "type": "inventario_bajo",
      "priority": "media",
      "message": "Inventario bajo: Perfil 1 tiene 80 kg disponibles",
      "data": {}
    }
  ],
  "inventoryNeeds": [
    {
      "product_form": "Excelso",
      "process_type": "Lavado",
      "variety": "Castillo",
      "profile_name": null,
      "requested_kg": 500,
      "available_kg": 320,
      "pending_kg": 180,
      "next_delivery_date": "2026-07-10",
      "sales_count": 2
    }
  ]
}
```

`inventoryNeeds` se entrega a administrador, contabilidad y bodega. Compara pedidos activos con inventario compatible por proceso, perfil y variedad; no calcula rendimientos ni conversiones de produccion.

Alertas iniciales:

- Inventario bajo por tipo o perfil cuando queda menos de `500 kg`.
- Lotes pendientes de laboratorio.
- Humedad fuera del rango `10%` a `12%`.
- Lotes disponibles con mas de 15 dias en bodega.
- Procesos en curso.
- Ventas activas que aun no tienen mezcla final definida por laboratorio.
- Preventas enviadas o aceptadas que aun no son venta.
- Ventas pendientes de alistamiento.
- Ventas despachadas con pago pendiente o parcial.
- Ventas con fecha estimada de pago vencida.
- Cuentas por pagar vencidas.

Reglas implementadas:

- Vendedor solo ve sus preventas pendientes.
- Laboratorio ve lotes pendientes, humedad fuera de rango y procesos en curso.
- Laboratorio tambien ve alertas de ventas que necesitan orden final de mezcla.
- Bodega ve inventario, procesos y ventas pendientes de alistamiento.
- Contabilidad ve cartera, preventas, ventas y cuentas por pagar.
- Administrador ve todas las alertas.
- En fase 1 las alertas solo se muestran en pantalla; no se envian correos ni mensajes automaticos.

### Reportes Basicos

Todos los reportes de esta seccion son para administrador y contabilidad.

```http
GET /api/reports/sales-summary
GET /api/reports/sales-by-seller
GET /api/reports/sales-by-profile
GET /api/reports/profit
GET /api/reports/accounts-receivable
GET /api/reports/accounts-payable
GET /api/reports/inventory
```

Filtros comunes para ventas:

```http
GET /api/reports/sales-summary?dateFrom=2026-06-01&dateTo=2026-06-30
GET /api/reports/sales-summary?currency=COP
GET /api/reports/sales-by-seller?currency=USD
GET /api/reports/profit?dateFrom=2026-06-01&dateTo=2026-06-30&currency=COP
```

Exportar CSV compatible con Excel:

```http
GET /api/reports/sales-summary?dateFrom=2026-06-01&dateTo=2026-06-30&format=csv
GET /api/reports/inventory?format=csv
```

Reportes incluidos:

- Resumen de ventas por moneda.
- Ventas por vendedor.
- Ventas por perfil o tipo de cafe.
- Utilidad estimada por venta.
- Cuentas por cobrar.
- Cuentas por pagar.
- Inventario agrupado.

Reglas implementadas:

- Las ventas anuladas no aparecen en reportes generales de ventas.
- Los totales se agrupan por moneda para no mezclar COP y USD.
- La utilidad estimada se calcula sobre el cafe vendido, sin incluir envio.
- El costo estimado usa el precio de compra guardado en los lotes descontados.
- Si un lote no tiene precio de compra registrado, su costo se toma como `0`.
- Los reportes no generan archivos todavia; entregan JSON para que el frontend pinte tablas/graficas.
- Si se envia `format=csv`, el endpoint descarga un archivo CSV compatible con Excel.
- La exportacion `.xlsx` real puede agregarse despues si el cliente la exige.

### Backups Manuales

Los backups manuales son para administrador y contabilidad.

```http
GET /api/backups/modules
GET /api/backups/export?module=lots
GET /api/backups/history
```

Modulos exportables:

- `clients`
- `suppliers`
- `lots`
- `inventory_movements`
- `quotes`
- `quote_items`
- `sales`
- `sale_items`
- `sale_payments`
- `payables`
- `payable_payments`
- `processes`
- `process_inputs`

Reglas implementadas:

- Cada exportacion descarga un archivo CSV compatible con Excel.
- Las exportaciones son por modulo para mantener el flujo simple.
- Cada exportacion queda registrada en `backup_exports`.
- El historial muestra modulo, formato, usuario y fecha.
- El backup automatico diario sigue siendo responsabilidad del proveedor/hosting PostgreSQL.

### Proveedores

```http
GET /api/suppliers
GET /api/suppliers/:id
POST /api/suppliers
PUT /api/suppliers/:id
```

Crear proveedor:

```json
{
  "name": "Finca La Esperanza",
  "phone": "3100000000",
  "address": "Vereda principal",
  "originZone": "Pitalito, Huila",
  "notes": "Proveedor de prueba"
}
```

Reglas iniciales:

- El telefono es unico para evitar duplicados por errores en el nombre.
- Nombre, telefono y direccion son obligatorios.
- Los proveedores no se eliminan; se activan o desactivan.

### Clientes

```http
GET /api/clients
GET /api/clients?search=juan
GET /api/clients/:id
POST /api/clients
PUT /api/clients/:id
```

Crear cliente:

```json
{
  "name": "Cliente de Prueba",
  "documentType": "NIT",
  "documentNumber": "900000001",
  "phone": "3200000000",
  "email": "cliente@example.com",
  "address": "Direccion principal",
  "city": "Bogota",
  "country": "Colombia",
  "shippingNotes": "Datos operativos de envio",
  "billingNotes": "Datos operativos de facturacion"
}
```

Reglas iniciales:

- Nombre, telefono y direccion son obligatorios.
- El correo es opcional.
- El telefono es unico para evitar duplicados.
- Se puede buscar por nombre, telefono o documento.
- Los clientes no se eliminan; se activan o desactivan.
- Vendedor, contabilidad y administrador pueden crear o editar clientes.

### Lotes

```http
GET /api/lots
GET /api/lots/:id
POST /api/lots/received
```

Filtros disponibles en listado:

```http
GET /api/lots?status=pendiente_laboratorio
GET /api/lots?supplierId=1
GET /api/lots?coffeeTypeId=1
```

Registrar lote recibido:

```json
{
  "supplierId": 1,
  "coffeeTypeId": 1,
  "receivedAt": "2026-06-30",
  "coffeeVariety": "Castillo",
  "grossWeightKg": 70,
  "packagingTypeId": 1,
  "packagingQuantity": 1,
  "hasInnerBag": true,
  "humidityPercent": 11.2,
  "performanceFactor": 92,
  "commercialClassification": "Regional",
  "visualNotes": "Observaciones registradas durante la recepcion",
  "originZone": "Pitalito, Huila",
  "initialComment": "Pergamino seco para revision"
}
```

Reglas implementadas:

- El sistema calcula el peso neto automaticamente.
- El descuento del embalaje se toma desde el catalogo `packaging_types`.
- Si `hasInnerBag` es `true`, se descuenta una bolsa interna de 0.05 kg por embalaje.
- Tambien se puede enviar `innerBagQuantity` para indicar la cantidad exacta de bolsas internas.
- El `performanceFactor` registra el factor de rendimiento medido en recepcion.
- La humedad y el factor de rendimiento son obligatorios antes de enviar el lote a evaluacion sensorial.
- Los tipos activos de recepcion representan el metodo de proceso: `Lavado`, `Natural` o `Semilavado`.
- `receivedAt` guarda la fecha exacta de llegada a bodega y es obligatorio.
- `coffeeVariety` es texto libre para registrar variedades o codigos como Castillo, Caturra o Pink Bourbon.
- La `commercialClassification` de recepcion permite `Regional`, `Varietal` o `Exotico`.
- Bodega no aprueba ni rechaza el cafe al recibirlo; siempre genera codigo `LOT-AAAA-0001` y lo envia a laboratorio.
- Los lotes rechazados quedan pendientes de retiro hasta que bodega los marque como `retirado`.
- Todo lote recibido queda inicialmente en estado `pendiente_laboratorio`.
- La cantidad disponible inicia en `0` hasta que laboratorio y contabilidad completen el flujo.

Marcar lote rechazado como retirado:

```http
PUT /api/lots/:id/withdraw-rejected
```

```json
{
  "notes": "Proveedor retiro el cafe rechazado"
}
```

### Carga Inicial De Inventario

```http
POST /api/lots/initial-load
```

Rol permitido:

- Administrador.

Crear lote LOT:

```json
{
  "lotKind": "LOT",
  "supplierId": 1,
  "coffeeTypeId": 1,
  "weightKg": 500,
  "humidityPercent": 11.5,
  "originZone": "Pitalito, Huila",
  "initialComment": "Inventario inicial de pergamino",
  "purchasePricePerKg": 12000,
  "purchasePaid": true
}
```

Crear lote PROC:

```json
{
  "lotKind": "PROC",
  "coffeeProfileId": 1,
  "weightKg": 80,
  "humidityPercent": 10.8,
  "score": 86.5,
  "originZone": "Pitalito, Huila",
  "initialComment": "Inventario inicial de cafe procesado"
}
```

Reglas implementadas:

- La carga inicial crea lotes directamente en estado `disponible`.
- El codigo se genera automaticamente como `LOT-AAAA-0001` o `PROC-AAAA-0001`.
- Los lotes `LOT` requieren `coffeeTypeId`.
- Los lotes `PROC` requieren `coffeeProfileId`.
- La cantidad disponible queda igual a `weightKg`.
- Se registra un movimiento de inventario `carga_inicial`.
- No se exige examen visual ni catacion completa porque son existencias anteriores al sistema.

### Revision De Laboratorio

```http
PUT /api/lots/:id/lab-review
```

Roles permitidos:

- Administrador.
- Laboratorio.

Aprobar lote:

```json
{
  "decision": "aprobado",
  "humidityPercent": 11.4,
  "aroma": "Texto libre de aroma",
  "fragrance": "Texto libre de fragancia",
  "flavor": "Texto libre de sabor",
  "acidity": "Texto libre de acidez",
  "sweetness": "Texto libre de dulzor",
  "body": "Texto libre de cuerpo",
  "balance": "Texto libre de balance",
  "uniformity": "Texto libre de uniformidad",
  "residual": "Texto libre de residual",
  "cleanCup": "Texto libre de taza limpia",
  "score": 86.5,
  "notes": "Lote apto para compra"
}
```

Rechazar lote:

```json
{
  "decision": "rechazado",
  "humidityPercent": 13.1,
  "notes": "Humedad fuera del rango aceptado"
}
```

Reglas implementadas:

- Solo se pueden revisar lotes en estado `pendiente_laboratorio`.
- Para aprobar, la catacion completa y el `score` son obligatorios.
- Para rechazar, se exige humedad y se permite dejar observaciones.
- La humedad ideal definida es entre `10%` y `12%`.
- Si la humedad queda por fuera de ese rango, el endpoint responde `humidityAlert: true`, pero no bloquea la decision.
- Un lote aprobado por laboratorio queda inmediatamente en estado `disponible`, con su peso neto habilitado en inventario aunque el proveedor aun no haya cobrado.
- Un lote aprobado aun no queda disponible para venta o proceso; falta que contabilidad registre compra/pago.
- Un lote rechazado queda como historico tecnico.

### Compra Y Disponibilidad Del Lote

```http
PUT /api/lots/:id/purchase
```

Roles permitidos:

- Administrador.
- Contabilidad.

Registrar compra/pago:

```json
{
  "purchasePricePerKg": 12000,
  "paymentMethodId": 2,
  "paymentReference": "RECIBO-001",
  "paidAt": "2026-06-19"
}
```

Reglas implementadas:

- Solo se pueden comprar/pagar lotes en estado `aprobado`.
- El total de compra se calcula automaticamente: `peso neto * precio por kg`.
- Registrar el pago solo completa los datos financieros de la compra; no cambia el estado ni vuelve a sumar kilos al inventario.
- La cantidad disponible queda igual al peso neto del lote.
- Se guarda metodo de pago, referencia y fecha de pago.
- Se registra un movimiento de inventario `compra_pagada`.
- El vendedor no tiene permiso para ejecutar este endpoint.

### Inventario Disponible

```http
GET /api/inventory/lots
GET /api/inventory/grouped
GET /api/inventory/lots/:lotId/movements
POST /api/inventory/lots/:lotId/adjustments
```

Inventario por lotes:

```http
GET /api/inventory/lots
GET /api/inventory/lots?coffeeTypeId=1
GET /api/inventory/lots?coffeeProfileId=1
```

Inventario agrupado:

```http
GET /api/inventory/grouped
```

Movimientos de un lote:

```http
GET /api/inventory/lots/1/movements
```

Ajuste manual:

```json
{
  "adjustmentType": "decrease",
  "quantityKg": 2,
  "reason": "Ajuste por diferencia encontrada en conteo"
}
```

Reglas implementadas:

- La vista por lotes muestra lotes con cantidad disponible mayor a cero.
- Por defecto muestra lotes en estado `disponible`.
- La vista agrupada suma cantidades disponibles.
- Los lotes `LOT` se agrupan por tipo de cafe.
- Los lotes `PROC` se agrupan por perfil comercial.
- Los movimientos permiten ver el historial operativo del lote.
- Los ajustes manuales solo los pueden hacer administrador y contabilidad.
- El ajuste puede ser `increase` o `decrease`.
- La razon del ajuste es obligatoria.
- Un ajuste nunca puede dejar inventario negativo.
- Si el ajuste deja la cantidad disponible en cero, el lote queda `agotado`.
- Si un lote agotado recibe aumento, vuelve a quedar `disponible`.
- No se ajustan manualmente lotes pendientes, rechazados o en proceso desde este endpoint.

### Procesamiento De Cafe

```http
GET /api/processes
GET /api/processes/:id
POST /api/processes
PUT /api/processes/:id/finish
```

Crear proceso:

```json
{
  "quoteId": 1,
  "processLocation": "Finca de proceso",
  "notes": "Proceso solicitado para cafe especial",
  "inputs": [
    {
      "lotId": 1,
      "quantityKg": 50
    }
  ]
}
```

Iniciar proceso:

```http
PUT /api/processes/:id/start
```

```json
{
  "processLocation": "Finca de proceso",
  "estimatedReturnDate": "2026-07-05",
  "notes": "Cafe recibido por encargado de proceso"
}
```

Marcar proceso fisico terminado y pendiente de laboratorio:

```http
PUT /api/processes/:id/pending-laboratory
```

```json
{
  "notes": "Proceso terminado, pendiente de examen final"
}
```

Finalizar proceso:

```json
{
  "coffeeProfileId": 1,
  "outputWeightKg": 38,
  "humidityPercent": 10.9,
  "aroma": "Texto libre de aroma",
  "fragrance": "Texto libre de fragancia",
  "flavor": "Texto libre de sabor",
  "acidity": "Texto libre de acidez",
  "sweetness": "Texto libre de dulzor",
  "body": "Texto libre de cuerpo",
  "balance": "Texto libre de balance",
  "uniformity": "Texto libre de uniformidad",
  "residual": "Texto libre de residual",
  "cleanCup": "Texto libre de taza limpia",
  "score": 87.2,
  "notes": "Cafe procesado correctamente",
  "initialComment": "Lote PROC generado desde proceso"
}
```

Reglas implementadas:

- Administrador y bodega pueden crear solicitudes de proceso.
- Crear proceso genera una solicitud y no descuenta inventario todavia.
- Solo el administrador confirma el inicio del proceso y registra la fecha estimada de regreso a bodega.
- Al confirmar el inicio del proceso, el sistema descuenta las cantidades seleccionadas de los lotes origen.
- Solo el administrador marca el proceso fisico terminado como `pendiente_laboratorio`.
- Laboratorio solamente recibe lotes y procesos pendientes de examen.
- Solo despues del examen final de laboratorio se crea el lote `PROC`.
- El proceso puede asociarse a una preventa usando `quoteId`.
- El proceso tambien puede asociarse a una venta usando `saleId`.
- Si se envia `quoteId`, debe existir y ser una cotizacion de tipo `preventa`.
- No se puede asociar un proceso a una preventa anulada.
- El listado y detalle de procesos muestran el codigo de preventa y cliente asociado cuando aplica.
- El listado y detalle de procesos muestran los lotes usados en la mezcla, con kg y porcentaje calculado sobre la entrada total.
- Los procesos asociados a preventa se ordenan por fecha estimada de entrega para ayudar a priorizar laboratorio.
- No permite tomar mas kg que la cantidad disponible del lote.
- Si un lote origen queda en cero al enviarse a proceso, pasa a `en_proceso`.
- Si solo se toma una parte del lote, el remanente queda `disponible`.
- Finalizar proceso solo se permite si el proceso esta `pendiente_laboratorio`.
- Finalizar proceso crea un nuevo lote `PROC-AAAA-0001`.
- El lote `PROC` queda directamente `disponible`.
- Para finalizar se exige perfil comercial, humedad final, catacion completa y score.
- La cantidad final del proceso no puede ser mayor que la cantidad total de entrada.
- Al finalizar, los lotes origen que quedaron en cero pasan a `agotado`.
- Todo queda registrado en movimientos de inventario como `proceso_salida` al iniciar y `proceso_entrada` al finalizar laboratorio.

### Cotizaciones Y Preventas

```http
GET /api/quotes
GET /api/quotes/:id
POST /api/quotes
PUT /api/quotes/:id/status
```

Crear cotizacion de inventario disponible:

```json
{
  "clientId": 1,
  "quoteType": "inventario_disponible",
  "status": "enviada",
  "currency": "COP",
  "paymentTerms": "Pago al confirmar compra",
  "deliveryTerms": "Entrega coordinada con bodega",
  "shippingCost": 50000,
  "estimatedDeliveryDate": "2026-06-25",
  "notes": "Cotizacion de prueba",
  "items": [
    {
      "lotId": 1,
      "productForm": "Excelso",
      "processType": "Lavado",
      "variety": "Castillo",
      "quantityKg": 20,
      "unitPrice": 45000,
      "description": "Cafe disponible en bodega"
    }
  ]
}
```

Crear preventa:

```json
{
  "clientId": 1,
  "quoteType": "preventa",
  "status": "enviada",
  "currency": "USD",
  "paymentTerms": "Abono inicial y saldo antes del envio",
  "deliveryTerms": "Cafe se procesa bajo solicitud",
  "shippingCost": 120,
  "estimatedDeliveryDate": "2026-07-10",
  "notes": "Preventa para cafe especial",
  "items": [
    {
      "coffeeProfileId": 1,
      "productForm": "Excelso",
      "processType": "Natural",
      "variety": "Pink Bourbon",
      "quantityKg": 50,
      "unitPrice": 18,
      "description": "Perfil especial solicitado"
    }
  ]
}
```

Reglas implementadas:

- Las cotizaciones no descuentan inventario.
- Pueden ser `inventario_disponible` o `preventa`.
- Monedas permitidas: `COP` y `USD`.
- La fecha estimada de entrega es obligatoria.
- Una cotizacion puede contener varios items con caracteristicas diferentes.
- Cada item puede registrar `Excelso` o `Pergamino`, metodo `Lavado`, `Natural` o `Semilavado`, y variedad en texto libre.
- El vendedor define el precio final por item.
- El sistema calcula subtotal y total sumando costo de envio.
- Los items pueden referenciar lote, tipo de cafe, perfil comercial o descripcion libre.
- El vendedor solo ve sus propias cotizaciones.
- Administrador y contabilidad pueden ver todas.
- Estados iniciales: `borrador`, `enviada`, `aceptada`, `anulada`.
- Cambiar a `aceptada` todavia no descuenta inventario; el descuento lo hace bodega al marcar la venta como `alistada`.
- Una cotizacion convertida en venta ya no puede anularse desde cotizaciones.
- Una preventa con procesos asociados no puede anularse desde cotizaciones.
- El vendedor puede anular sus propias cotizaciones mientras no esten convertidas en venta.

### Documentos Imprimibles

Estos endpoints entregan datos listos para que el frontend genere una vista imprimible o PDF bajo demanda.

```http
GET /api/documents/quotes/:id
GET /api/documents/sales/:id
GET /api/documents/sales/:id?includePayments=true
```

Reglas implementadas:

- No se guardan archivos PDF fisicos en fase 1.
- El documento de cotizacion incluye empresa, cliente, vendedor, items, condiciones y totales.
- El vendedor solo puede generar documentos de sus propias cotizaciones.
- El documento de venta usa `VEN` como referencia principal.
- Si existe referencia de factura externa, tambien se entrega en el documento de venta.
- La venta puede incluir o no historial de pagos segun `includePayments=true`.
- El frontend podra usar estos datos para imprimir o descargar PDF con una plantilla visual.

### Ventas Desde Cotizacion

```http
GET /api/sales
GET /api/sales/:id
POST /api/sales/from-quote/:quoteId
POST /api/sales/direct
PUT /api/sales/:id/prepare
PUT /api/sales/:id/dispatch
PUT /api/sales/:id/cancel
```

Convertir cotizacion aceptada en venta pagada:

```json
{
  "paymentStatus": "pagada",
  "amountPaid": 950000,
  "paymentMethodId": 2,
  "paymentReference": "PAGO-INICIAL-001",
  "externalInvoiceReference": "FAC-EXT-001",
  "notes": "Venta creada desde cotizacion aceptada"
}
```

Convertir cotizacion aceptada en venta parcial:

```json
{
  "paymentStatus": "pago_parcial",
  "amountPaid": 300000,
  "paymentMethodId": 2,
  "paymentReference": "ABONO-INICIAL-001",
  "estimatedPaymentDate": "2026-06-30",
  "externalInvoiceReference": "FAC-EXT-002",
  "notes": "Cliente de confianza con saldo pendiente"
}
```

Reglas implementadas:

- Solo se convierten cotizaciones en estado `aceptada`.
- Una cotizacion solo puede convertirse una vez.
- Al convertir a venta no se descuenta inventario automaticamente.
- La venta queda para gestion de bodega con estado `pendiente_bodega` y prioridad inicial `media`.
- La fecha estimada de entrega de la cotizacion se copia a la venta.
- Bodega define la prioridad real de entrega: `alta`, `media` o `baja`.
- Bodega decide si asigna lote disponible o si crea un proceso asociado a esa venta.
- Los lotes asignados por bodega quedan guardados en la venta, pero solo se descuentan cuando bodega marca la venta como `alistada`.
- Estados de pago: `pagada`, `pago_parcial`, `pendiente_pago`.
- Si la venta queda parcial o pendiente, la fecha estimada de pago es obligatoria.
- Si se registra pago inicial, metodo de pago y referencia son obligatorios.
- La venta queda en estado operativo `pendiente_bodega`.
- Bodega, contabilidad y administrador pueden consultar ventas.
- El vendedor puede consultar sus propias ventas para seguimiento comercial.
- El vendedor no ve cartera completa, pagos ni lotes descontados en el detalle de venta.
- El vendedor no convierte ventas ni descuenta inventario en esta version.

Crear venta directa sin cotizacion:

```json
{
  "clientId": 1,
  "sellerId": 1,
  "paymentStatus": "pagada",
  "currency": "COP",
  "shippingCost": 50000,
  "amountPaid": 950000,
  "paymentMethodId": 2,
  "paymentReference": "PAGO-DIRECTO-001",
  "externalInvoiceReference": "FAC-EXT-003",
  "notes": "Venta directa desde inventario",
  "items": [
    {
      "lotId": 1,
      "quantityKg": 20,
      "unitPrice": 45000,
      "description": "Cafe disponible vendido directamente"
    }
  ]
}
```

Reglas de venta directa:

- Administrador y contabilidad pueden crear ventas directas.
- La venta directa tampoco descuenta inventario inmediatamente; queda para asignacion y alistamiento en bodega.
- Los items deben indicar lote, tipo de cafe o perfil comercial.
- Bodega define despues que lotes se usaran realmente.
- Se puede registrar pago total, parcial o pendiente igual que en ventas desde cotizacion.

Alistar venta:

```json
{
  "notes": "Cafe alistado en bodega"
}
```

Despachar venta:

```json
{
  "notes": "Venta despachada al cliente"
}
```

Reglas de bodega, alistamiento y despacho:

- Bodega ve las ventas activas ordenadas por prioridad y fecha estimada de entrega.
- Bodega puede asignar lotes especificos a cada producto vendido.
- Bodega puede crear procesos asociados a una venta cuando el cafe se debe preparar.
- Cuando un proceso asociado a una venta finaliza, la venta pasa a `listo_para_ensamble`.
- Cuando laboratorio define la mezcla final, la venta pasa a `ensamble_definido`.
- Solo se puede alistar una venta que este pendiente de bodega, con lote asignado o con ensamble definido.
- Al marcar una venta como `alistada`, el sistema descuenta las cantidades asignadas de los lotes.
- Solo se puede despachar una venta en estado `alistada`.
- Bodega, contabilidad y administrador pueden cambiar estos estados.
- Bodega puede consultar el detalle de la venta para saber que lotes y cantidades debe sacar.
- La pantalla `Pendientes` de bodega muestra las ordenes activas por prioridad y fecha de entrega, permite ver el detalle, imprimir la orden, asignar lotes y cambiar el estado operativo.
- Si la venta descuenta un lote `PROC` generado por proceso, el detalle muestra la mezcla origen con lotes, kg y porcentajes para que bodega tenga la orden completa.
- Desde la pantalla de ventas se puede imprimir o guardar como PDF una orden operativa con pedido, lotes y porcentajes de mezcla para entregar a la persona que prepara la mezcla.
- Laboratorio puede crear una orden final de mezcla por venta y producto vendido, seleccionando lotes por categoria comercial y asignando porcentajes que deben sumar 100% por producto.
- La orden impresa para bodega usa primero esa mezcla final definida por laboratorio; si aun no existe, muestra la mezcla historica del proceso como referencia.
- Al despachar no se vuelve a descontar inventario, porque el descuento ya ocurrio al marcar la venta como `alistada`.

Anular venta:

```json
{
  "notes": "Cliente cancelo antes del despacho"
}
```

Reglas de anulacion:

- Administrador y contabilidad pueden anular ventas.
- Solo se pueden anular ventas antes de despacho, incluyendo ventas pendientes de bodega, en proceso, con ensamble definido o alistadas.
- Una venta despachada no se puede anular.
- Al anular una venta, el inventario vuelve automaticamente a los mismos lotes descontados.
- Se registra un movimiento de inventario `venta_anulada_entrada`.
- Los pagos registrados quedan como historial; devoluciones de dinero se manejan por fuera del sistema.
- Las ventas anuladas no aparecen en cartera ni reportes generales.

### Pagos De Ventas Y Cartera

```http
POST /api/sales/:id/payments
GET /api/sales?paymentStatus=pendiente_pago
GET /api/sales?paymentStatus=pago_parcial
```

Registrar pago o abono:

```json
{
  "amount": 200000,
  "paymentMethodId": 2,
  "paymentReference": "ABONO-002",
  "paidAt": "2026-06-24",
  "notes": "Abono posterior del cliente"
}
```

Reglas implementadas:

- Administrador y contabilidad pueden registrar pagos posteriores.
- Metodo de pago y referencia son obligatorios.
- El pago no puede superar el saldo pendiente.
- Al registrar un pago, el sistema recalcula `amount_paid` y `balance_due`.
- Si el saldo queda en cero, la venta pasa automaticamente a `pagada`.
- Si queda saldo pendiente, la venta queda en `pago_parcial`.
- El detalle de venta muestra el historial de pagos.
- Las ventas pendientes o parciales se consultan filtrando por `paymentStatus`.

### Cuentas Por Pagar

```http
GET /api/payables
GET /api/payables/:id
POST /api/payables
POST /api/payables/:id/payments
```

Filtros disponibles:

```http
GET /api/payables?status=pendiente
GET /api/payables?status=pago_parcial
GET /api/payables?status=pagada
GET /api/payables?categoryId=1
GET /api/payables?supplierId=1
GET /api/payables?lotId=1
```

Crear cuenta por pagar pendiente:

```json
{
  "categoryId": 1,
  "supplierId": 1,
  "lotId": 1,
  "status": "pendiente",
  "description": "Compra de lote de cafe",
  "total": 840000,
  "amountPaid": 0,
  "dueDate": "2026-06-30",
  "notes": "Recibo manual entregado a contabilidad"
}
```

Crear cuenta por pagar pagada:

```json
{
  "categoryId": 2,
  "thirdPartyName": "Transporte local",
  "status": "pagada",
  "description": "Servicio de transporte",
  "total": 150000,
  "amountPaid": 150000,
  "paymentMethodId": 2,
  "paymentReference": "PAGO-TRANSPORTE-001",
  "paidAt": "2026-06-24",
  "notes": "Gasto operativo"
}
```

Registrar pago posterior:

```json
{
  "amount": 840000,
  "paymentMethodId": 2,
  "paymentReference": "PAGO-LOTE-001",
  "paidAt": "2026-06-30",
  "notes": "Pago completo del lote"
}
```

Reglas implementadas:

- Administrador y contabilidad pueden crear y pagar cuentas por pagar.
- Estados disponibles: `pendiente`, `pago_parcial` y `pagada`.
- Una cuenta puede asociarse a proveedor, lote o tercero escrito manualmente.
- Si la cuenta queda pendiente o parcial, la fecha estimada de pago es obligatoria.
- Si se registra pago inicial, metodo de pago y referencia son obligatorios.
- El pago no puede superar el saldo pendiente.
- Al registrar pagos, el sistema recalcula `amount_paid` y `balance_due`.
- Si el saldo queda en cero, la cuenta pasa automaticamente a `pagada`.
- El detalle de cuenta por pagar muestra historial de pagos.

## Catalogos Iniciales

El seed crea:

- Roles base.
- Tipos de cafe: pergamino, trillado, procesado y especial.
- 17 perfiles temporales: `Perfil 1` a `Perfil 17`.
- Embalajes: costal/saco de fique, tula/estopa y bolsa interna.
- Metodos de pago simples.
- Categorias iniciales para cuentas por pagar.

## Pruebas Manuales

El archivo `backend/requests.http` contiene ejemplos listos para probar con extensiones tipo REST Client.

El primer flujo de prueba recomendado es:

1. Probar `GET /api/health`.
2. Probar `GET /api/health/db`.
3. Iniciar sesion con `admin`.
4. Copiar el token.
5. Probar `GET /api/auth/me`.
6. Probar creacion de vendedor.
