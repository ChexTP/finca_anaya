# Reglas De Desarrollo

## Principio General

El sistema debe desarrollarse con una arquitectura simple, clara y facil de mantener. La prioridad es que el codigo sea entendible para otra persona que pueda tomar el proyecto en el futuro.

No se debe complicar el backend con capas innecesarias. El proyecto debe parecerse al estilo usado en el backend de referencia de Finca El Paraiso: estructura directa, modulos claros y archivos faciles de ubicar.

## Arquitectura Backend

El backend usara Node.js, Express y PostgreSQL.

La estructura base sera:

```txt
backend/
  package.json
  src/
    app.js
    index.js
    db.js
    config.js

    routes/
    controllers/
    models/
    middlewares/
    db/
```

## Flujo De Codigo Backend

El flujo debe ser:

```txt
routes -> controllers -> models -> db
```

### routes

Las rutas solo deben definir endpoints y llamar funciones del controlador.

Ejemplo:

```js
router.get("/lotes", getLots);
router.post("/lotes", createLot);
```

### controllers

Los controladores deben:

- Recibir `req` y `res`.
- Validar datos basicos.
- Llamar funciones del modelo.
- Responder al frontend.
- Manejar errores de forma clara.

### models

Los modelos deben:

- Contener las consultas SQL.
- Usar `pool.query`.
- Devolver datos al controlador.
- Mantener la logica de base de datos separada del controlador.

En PostgreSQL, los archivos de `models/` no seran modelos tipo Mongoose. Seran archivos con funciones simples de acceso a datos.

Ejemplo:

```js
import { pool } from "../db.js";

export const getLots = async () => {
  const result = await pool.query("SELECT * FROM lots ORDER BY created_at DESC");
  return result.rows;
};
```

## Capas Que No Se Usaran En Fase 1

Para mantener el sistema simple, no se usaran capas adicionales como:

- services.
- repositories.
- DTOs.
- casos de uso.
- arquitectura hexagonal.
- abstracciones complejas.

Si algun modulo crece demasiado, se podra reorganizar despues, pero solo cuando sea realmente necesario.

## Comentarios En El Codigo

Todo comentario debe estar en espanol.

El codigo debe estar bien comentado porque este sistema es para una empresa y posiblemente otra persona lo mantendra en el futuro.

Los comentarios deben explicar:

- Reglas de negocio importantes.
- Validaciones que puedan no ser obvias.
- Consultas SQL complejas.
- Cambios de estado delicados.
- Descuentos de inventario.
- Procesos de pago, cartera, preventas y lotes.

No se deben poner comentarios vacios o redundantes como:

```js
// Se declara una variable
const total = 0;
```

Si el codigo es obvio, no necesita comentario. Si una regla de negocio puede causar confusion, debe comentarse.

## Estilo De Implementacion

- Preferir codigo directo y legible.
- Evitar abstracciones prematuras.
- Mantener nombres claros en ingles o espanol, pero consistentes dentro del codigo.
- Mantener respuestas de API simples y predecibles.
- Validar en backend las reglas importantes aunque tambien se validen en frontend.
- No permitir inventario negativo.
- No eliminar registros criticos; usar estados.
- Mantener la logica de permisos simple y visible.

## Regla De Decision

Cuando haya dos formas de implementar algo, se debe elegir la opcion mas simple que cumpla el flujo real de trabajo de la empresa.

Si una funcionalidad hace el sistema mas lento de usar, mas confuso o mas dificil de operar, debe dejarse para una fase futura salvo que sea indispensable.

## Arquitectura Frontend

El frontend usara React.

La arquitectura debe seguir una idea simple de modelo-vista-controlador adaptada a React:

```txt
vista/pagina -> controlador del modulo -> apiClient -> backend
```

La estructura base recomendada sera:

```txt
frontend/
  src/
    main.jsx
    App.jsx

    api/
      apiClient.js

    routes/
      AppRoutes.jsx
      ProtectedRoute.jsx

    layouts/
      AppLayout.jsx
      AuthLayout.jsx

    modules/
      auth/
        LoginPage.jsx
        auth.controller.js
        components/

      inventory/
        InventoryPage.jsx
        inventory.controller.js
        components/

      laboratory/
        LaboratoryPage.jsx
        laboratory.controller.js
        components/

      quotes/
        QuotesPage.jsx
        quotes.controller.js
        components/

      sales/
        SalesPage.jsx
        sales.controller.js
        components/

    components/
      Button.jsx
      Input.jsx
      Select.jsx
      Modal.jsx
      Table.jsx
      StatusBadge.jsx
      ConfirmDialog.jsx

    context/
      AuthContext.jsx

    utils/
      auth.js
      constants.js
      formatDate.js
      formatCurrency.js
      permissions.js

    styles/
      global.css
```

## Modulos Frontend

Cada modulo debe tener su propia carpeta dentro de `modules/`.

Dentro de cada modulo se podran tener:

- Paginas del modulo.
- Controlador del modulo.
- Componentes internos del modulo.

Ejemplo:

```txt
modules/inventory/
  InventoryPage.jsx
  LotDetailPage.jsx
  inventory.controller.js
  components/
    LotForm.jsx
    LotTable.jsx
```

Los componentes compartidos por todo el sistema deben ir en `src/components/`.

Ejemplos:

- Botones.
- Inputs.
- Selects.
- Modales.
- Tablas.
- Badges de estado.
- Dialogos de confirmacion.
- Cabeceras de pagina.

## Estado En Frontend

Se usara Context primero para estado global simple.

Context sera suficiente para:

- Usuario autenticado.
- Token.
- Rol.
- Datos globales muy pequenos.

Si el uso de Context empieza a complicarse, generar demasiados renders o mezclar demasiada logica, se podra pasar a Zustand.

Zustand solo se usara si realmente simplifica el codigo.

No se usara Redux en fase 1.

## Tailwind Y UI

Se usara Tailwind CSS para acelerar el desarrollo visual.

El objetivo no es hacer una interfaz pesada o sobre-disenada, sino una herramienta clara, rapida y facil de usar.

Se deben crear componentes base reutilizables para mantener consistencia:

- Botones.
- Inputs.
- Selects.
- Tablas.
- Modales.
- Confirmaciones.
- Badges de estado.

## Librerias Frontend

Se podran usar paquetes externos cuando solucionen problemas de forma mas rapida y confiable que programarlo desde cero.

Ejemplos razonables:

- React Router para rutas.
- Libreria de tablas si ayuda con filtros/paginacion.
- Libreria de graficas para dashboards.
- Libreria para exportar Excel.
- Libreria para generar PDFs.
- Libreria de iconos.
- Libreria de notificaciones/toasts.

No se debe instalar una libreria si el problema se puede resolver con poco codigo claro.

## Rutas Frontend

Se usara React Router.

Debe existir proteccion de rutas por autenticacion y rol.

Ejemplo de flujo:

```txt
login -> dashboard segun rol -> modulos permitidos
```

## Confirmaciones

Acciones delicadas deben mostrar popup de confirmacion.

Ejemplos:

- Crear proceso.
- Confirmar descuento de lotes en venta.
- Liberar asignacion de preventa.
- Anular venta.
- Anular preventa.
- Ajustar inventario.
- Marcar venta como despachada.

Esto evita errores operativos sin complicar el sistema.
