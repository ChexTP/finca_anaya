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
```

Devuelve los catalogos necesarios para formularios:

- Tipos de cafe.
- Perfiles de cafe.
- Tipos de embalaje.
- Metodos de pago.
- Categorias de cuentas por pagar.

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
  "grossWeightKg": 70,
  "packagingTypeId": 1,
  "packagingQuantity": 1,
  "hasInnerBag": true,
  "humidityPercent": 11.2,
  "visualStatus": "aprobado",
  "visualDefectPercent": 3,
  "visualNotes": "Cafe recibido en buen estado visual",
  "originZone": "Pitalito, Huila",
  "initialComment": "Pergamino seco para revision"
}
```

Reglas implementadas:

- El sistema calcula el peso neto automaticamente.
- El descuento del embalaje se toma desde el catalogo `packaging_types`.
- Si `hasInnerBag` es `true`, se descuenta una bolsa interna de 0.05 kg por embalaje.
- Tambien se puede enviar `innerBagQuantity` para indicar la cantidad exacta de bolsas internas.
- Si el examen visual es `aprobado`, se genera codigo `LOT-AAAA-0001`.
- Si el examen visual es `rechazado`, no entra a inventario disponible y queda como historico tecnico.
- Un lote recibido aprobado queda en estado `pendiente_laboratorio`.
- La cantidad disponible inicia en `0` hasta que laboratorio y contabilidad completen el flujo.

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
- Un lote aprobado por laboratorio queda en estado `aprobado`.
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
- Al registrar el pago, el lote pasa a estado `disponible`.
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
