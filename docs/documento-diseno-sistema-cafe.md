# Documento De Diseno - Sistema Web Interno Para Cafe

## 1. Resumen Del Proyecto

El sistema sera una plataforma web interna para una empresa productora y comercializadora de cafe. Su objetivo principal es controlar el inventario de cafe por lotes, registrar entradas y salidas, gestionar cotizaciones, registrar ventas con referencias de factura externa y entregar reportes basicos para ventas, contabilidad y administracion.

La primera fase se enfocara en resolver el flujo operativo principal de la empresa de forma simple, clara y funcional. No se incluira facturacion electronica DIAN, integracion con software contable, pasarelas de pago, basculas conectadas automaticamente ni trazabilidad cafetera avanzada.

## 2. Stack Tecnologico Propuesto

### Frontend

- React.
- React Router para navegacion.
- Componentes reutilizables para formularios, tablas, filtros, estados y modales.
- Libreria de graficas sencilla para reportes visuales.
- Generacion o descarga de PDFs desde el sistema.
- Diseno responsive para computador, tablet y movil.
- Modo claro como prioridad. Modo oscuro opcional si no afecta el tiempo de entrega.

### Backend

- Node.js con Express.
- API REST.
- Autenticacion por usuario y contrasena.
- Control de permisos por rol.
- Validaciones en backend para proteger inventario, ventas y datos sensibles.
- Sesiones con expiracion aproximada de 12 horas.
- Recuperacion de contrasena gestionada manualmente por administrador en fase 1.
- Sin registro publico de usuarios.
- Solo administrador crea usuarios y define/cambia contrasenas.
- Los usuarios no cambian su propia contrasena en fase 1.
- Backup automatico diario de la base de datos.
- El backup automatico diario sera responsabilidad del proveedor/hosting PostgreSQL.

### Base De Datos

La base de datos sera PostgreSQL.

Se recomienda PostgreSQL sobre MongoDB porque el sistema manejara relaciones claras entre clientes, proveedores, lotes, movimientos, cotizaciones, ventas y usuarios. Tambien facilita reportes por fechas, sumatorias, auditoria de movimientos e integridad del inventario.

Para despliegue se contempla:

- Frontend en Vercel.
- Backend en Render.
- Base de datos PostgreSQL administrada, preferiblemente en Render o proveedor compatible.

## 3. Usuarios Y Roles

La primera version manejara cinco roles:

- Administrador.
- Recepcion / Inventario.
- Laboratorio.
- Vendedor.
- Contabilidad.

### Administrador

Tiene acceso completo al sistema.

Permisos principales:

- Gestionar usuarios.
- Gestionar roles.
- Configurar categorias de cafe.
- Configurar tipos de embalaje y descuentos de peso.
- Configurar alertas de inventario bajo.
- Ver inventario completo.
- Ver cotizaciones.
- Ver ventas y referencias de factura.
- Ver reportes y graficas.
- Editar informacion sensible cuando sea necesario.

### Recepcion / Inventario

Responsable de registrar cafes recibidos y movimientos basicos de inventario.

Permisos principales:

- Registrar entrada de cafe.
- Registrar proveedor o persona que entrega el cafe.
- Registrar procedencia.
- Registrar peso bruto, embalaje, descuento y peso neto.
- Registrar humedad.
- Registrar examen visual.
- Aceptar o rechazar cafe.
- Generar lote si el cafe es aceptado.
- Consultar inventario.
- Registrar procesamiento basico, si el administrador lo permite.

### Laboratorio

Responsable de registrar datos tecnicos, catacion, humedad, aprobacion o rechazo y resultados de procesamiento.

Permisos principales:

- Ver lotes pendientes de revision tecnica.
- Registrar humedad.
- Registrar examen visual.
- Registrar datos de catacion.
- Registrar score.
- Aprobar o rechazar lotes segun criterios tecnicos.
- Registrar datos de trilla, procesamiento, factor de rendimiento y perfil comercial.
- Consultar historico tecnico de lotes.

### Vendedor

Responsable de consultar disponibilidad, crear cotizaciones y hacer seguimiento comercial.

Permisos principales:

- Ver inventario disponible.
- Ver alertas de bajo inventario.
- Crear clientes.
- Crear cotizaciones.
- Definir precio negociado en cotizacion.
- Generar PDF de cotizacion.
- Consultar historial de cotizaciones propias.
- Registrar informacion comercial inicial para revision de contabilidad.
- Consultar estado de sus cotizaciones, preventas y ventas.
- Consultar estado de despacho de sus ventas.

### Contabilidad

Responsable de revisar ventas, referencias de factura y reportes internos.

Permisos principales:

- Ver inventario disponible.
- Ver alertas de inventario.
- Ver cotizaciones.
- Convertir cotizaciones aprobadas en ventas.
- Registrar referencia de factura externa.
- Registrar costos o datos comerciales asociados.
- Consultar historial de ventas.
- Generar reportes por fechas.
- Ver totales vendidos por periodo.
- Registrar, validar o rechazar pagos.
- Consultar cartera y cuentas por cobrar.
- Ajustar costos de envio en ventas.
- Ver estado de alistamiento y despacho.
- Registrar fecha estimada de pago cuando una venta queda pendiente o parcial.
- Gestionar cuentas por pagar de proveedores y otros gastos.

## 4. Flujo Principal Del Sistema

### 4.1 Ingreso De Cafe

1. El usuario de recepcion registra una nueva entrada de cafe.
2. Selecciona o crea el proveedor/persona que entrega el cafe.
3. Registra la procedencia del cafe.
4. Registra el peso bruto.
5. Selecciona el tipo de embalaje.
6. El sistema aplica el descuento de peso predefinido.
7. El sistema calcula el peso neto.
8. Se registra humedad.
9. Se registra examen visual.
10. Se define si el cafe se acepta o se rechaza.
11. Si se rechaza, se guarda el registro como historico tecnico y no entra al inventario disponible.
12. Si se acepta en recepcion, el sistema genera un codigo unico de lote.
13. El lote queda en estado pendiente de laboratorio.
14. Laboratorio registra datos tecnicos, catacion y decision final.
15. Si laboratorio rechaza, el lote queda como historico tecnico.
16. Si laboratorio aprueba, el lote queda aprobado.
17. Contabilidad registra precio de compra, valor total y pago al proveedor.
18. Solo despues de la compra/pago el lote queda disponible para venta o procesamiento.
19. Para que un lote pase a disponible, el pago al proveedor debe estar completo.

### 4.2 Venta Directa Sin Procesamiento

1. El cafe aceptado queda disponible en inventario.
2. El vendedor o contabilidad selecciona cafe disponible para cotizar o vender.
3. El sistema muestra cantidades disponibles por lote, tipo o perfil.
4. Al confirmar la venta, el sistema descuenta la cantidad vendida.
5. La salida queda registrada en el historial de movimientos.

### 4.3 Procesamiento Basico De Cafe

1. Se crea un proceso de cafe, opcionalmente asociado a una preventa.
2. Se seleccionan uno o varios lotes de entrada.
3. El sistema muestra primero los lotes mas antiguos disponibles.
4. El usuario indica la cantidad que se toma de cada lote.
5. La cantidad asignada al proceso queda bloqueada para venta y otros procesos.
6. El proceso puede quedar en estado pendiente, en_proceso o finalizado.
7. Al finalizar, se registra cantidad total de entrada y cantidad total de salida; el sistema puede mostrar la diferencia como dato informativo.
8. El proceso genera un nuevo lote procesado con codigo PROC-AAAA-0001.
9. Laboratorio registra mediciones, catacion y perfil final del lote procesado.
10. Si el proceso estaba asociado a una preventa, el lote PROC resultante queda bloqueado/sugerido para esa preventa.
11. Contabilidad o administrador revisa cantidad final y confirma la asignacion a la preventa.
12. Si existe excedente, queda disponible para venta general.
13. Si el proceso no estaba asociado a preventa, el lote procesado queda disponible para venta general.
14. Laboratorio no cambia preventas a lista_para_entrega; solo registra mediciones y finaliza el proceso.

### 4.4 Cotizacion

1. El vendedor crea una cotizacion.
2. Selecciona cliente existente o crea uno nuevo.
3. Selecciona cafes disponibles o crea una preventa por tipo/perfil requerido.
4. Ingresa cantidades.
5. El sistema valida disponibilidad cuando aplique.
6. El vendedor define el precio negociado.
7. El sistema calcula subtotales y total.
8. El vendedor define moneda, condiciones de pago, condiciones de entrega, costo de envio tentativo, fecha estimada de entrega y prioridad si aplica.
9. El vendedor puede aplicar descuento porcentual sobre el subtotal de productos.
10. Se genera PDF de cotizacion bajo demanda.
11. La cotizacion/preventa queda guardada con estado general.
12. La cotizacion no tendra fecha de vencimiento en la primera version.

### 4.5 Conversion De Cotizacion A Venta

1. Contabilidad revisa la cotizacion/preventa aprobada o lista para entrega.
2. El sistema genera una propuesta FIFO de lotes a descontar.
3. Si la preventa tiene lotes asociados, se descuentan primero esos lotes.
4. Si falta cantidad, el sistema completa con FIFO general de lotes compatibles.
5. Un usuario autorizado confirma la propuesta de lotes.
6. Contabilidad registra o ajusta referencia de factura externa, costos, envio y datos comerciales.
7. El sistema descuenta inventario y guarda el detalle por lote.
8. Se guarda historial de venta.
9. La cotizacion queda marcada como convertida.
10. La venta queda en estado de despacho pendiente_alistamiento.

### 4.6 Registro De Venta Directa

1. Contabilidad o administrador crea una venta sin cotizacion previa.
2. Selecciona cliente.
3. Selecciona cafe y cantidad.
4. El sistema genera propuesta FIFO de lotes a descontar.
5. Usuario autorizado confirma lotes y cantidades.
6. Ingresa precios y datos comerciales.
7. Registra referencia de factura externa si aplica.
8. El sistema descuenta inventario.
9. La venta queda en historial y pendiente_alistamiento.

### 4.7 Flujo De Alistamiento Y Despacho

1. Al convertir una cotizacion/preventa en venta, la venta queda pendiente_alistamiento.
2. Bodega ve la venta en la lista de alistamiento con lotes y cantidades a sacar.
3. Bodega ve el nombre del cliente solo como referencia operativa.
4. Bodega prepara el cafe y marca la venta como alistado.
5. Bodega, contabilidad o administrador pueden marcar la venta como despachado.
6. En fase 1 no se manejara estado entregado.

### 4.8 Carga Inicial De Inventario

1. El administrador podra cargar cafe existente al iniciar el uso del sistema.
2. La carga inicial no pasara por todo el flujo de recepcion, laboratorio y compra.
3. Los lotes creados por carga inicial quedaran directamente disponibles.
4. La carga inicial podra crear lotes normales LOT y lotes procesados PROC.
5. Un lote PROC creado por carga inicial podra quedar disponible general o asociado a una preventa existente.
6. No se mostrara una marca visible de carga_inicial como regla de negocio.

## 5. Modulos Del Sistema

### 5.1 Autenticacion Y Usuarios

Funciones:

- Inicio de sesion.
- Cierre de sesion.
- Gestion de usuarios.
- Asignacion de roles.
- Activar/desactivar usuarios.
- Cambio de contrasena por administrador.
- Exportacion manual de backup por modulos para administrador y contabilidad.

Datos principales:

- Nombre.
- Correo o usuario.
- Contrasena cifrada.
- Rol.
- Estado.
- Fecha de creacion.

Reglas de usuarios:

- No existira registro publico.
- El administrador inicial, bodega/recepcion, laboratorio y contabilidad se crearan como usuarios iniciales del sistema.
- El administrador podra crear vendedores desde la interfaz.
- El administrador podra activar/desactivar vendedores.
- Los roles fijos bodega/recepcion, laboratorio y contabilidad se crean inicialmente y no se administran desde interfaz en fase 1.
- Solo el administrador podra definir o cambiar contrasenas.
- Los usuarios no podran cambiar su propia contrasena en fase 1.
- Si un usuario olvida su contrasena, el administrador asignara una nueva manualmente.

### 5.2 Proveedores / Personas Que Entregan Cafe

Funciones:

- Crear proveedor.
- Editar proveedor.
- Consultar historial de entregas.

Datos tentativos:

- Nombre o razon social.
- Telefono.
- Correo.
- Direccion.
- Observaciones.

Datos obligatorios:

- Nombre o razon social.
- Telefono.
- Direccion.

Datos opcionales:

- Correo.
- Observaciones.

Reglas de proveedores:

- El telefono sera obligatorio y unico para evitar duplicados.
- La direccion sera obligatoria para ubicar finca/proveedor y facilitar contacto futuro.
- No se exigira documento/NIT en fase 1.
- Proveedor puede representar productor, finca o intermediario.

### 5.3 Inventario De Cafe

Funciones:

- Registrar entrada.
- Registrar carga inicial de inventario.
- Aceptar o rechazar cafe.
- Generar codigo unico de lote.
- Consultar lotes.
- Filtrar por estado, tipo, perfil, proveedor, fecha o disponibilidad.
- Ver detalle del lote.
- Ver inventario agrupado.
- Ver inventario por lote.
- Registrar movimientos.
- Consultar historial.

Carga inicial de inventario:

- Solo administrador podra realizar carga inicial.
- Permitira crear LOT o PROC existentes al inicio del sistema.
- Los lotes quedaran en estado disponible.
- Datos minimos sugeridos: tipo de cafe, variedad, perfil si aplica, cantidad disponible en kg y observaciones.
- Datos opcionales: humedad, score/catacion, precio de compra por kg, proveedor y zona de procedencia.
- Si se crea un PROC, podra asociarse a una preventa existente o quedar disponible general.

Vistas de inventario:

- Vista por lote: muestra cada LOT o PROC individual.
- Vista agrupada: resume inventario por tipo/perfil.
- Los lotes LOT sin procesar se agruparan por tipo de cafe.
- Los lotes PROC procesados se agruparan por perfil comercial.
- Ambas vistas mostraran cantidades disponibles, asignadas a preventa y en proceso.
- La vista por lote mostrara un indicador simple de estado: disponible, en proceso, asignado a preventa, agotado u otros estados definidos.
- Cantidad historica vendida se consultara en reportes, no en la vista principal de inventario.

Datos tentativos del lote:

- Codigo de lote.
- Proveedor.
- Procedencia.
- Variedad.
- Fecha de ingreso.
- Tipo de cafe.
- Estado del lote.
- Peso bruto.
- Tipo de embalaje.
- Descuento por embalaje.
- Peso neto.
- Unidad principal en kilogramos.
- Humedad inicial.
- Examen visual.
- Estado de aceptacion: aceptado.
- Cantidad disponible.
- Unidad de medida.
- Valor de compra.
- Precio de compra por kg.
- Valor total de compra calculado.
- Fecha de compra/pago al proveedor.
- Metodo de pago al proveedor.
- Referencia o comprobante de pago al proveedor.
- Ubicacion general.
- Cantidad disponible en bodega.
- Cantidad en proceso.
- Cantidad vendida/agotada.
- Observaciones.

Rango de humedad definido:

- Humedad minima aceptada: 10%.
- Humedad maxima aceptada: 12%.
- El sistema debera registrar la humedad como porcentaje.
- Si la humedad esta por fuera del rango definido, el sistema debera mostrar una alerta y permitir que laboratorio o administrador definan si el lote se rechaza o queda pendiente de revision.

Codigo de lote:

- Formato inicial: LOT-AAAA-0001.
- Ejemplo: LOT-2026-0001.
- El consecutivo se incrementara automaticamente y se reiniciara cada año.

Codigo de lote procesado:

- Formato inicial: PROC-AAAA-0001.
- Ejemplo: PROC-2026-0001.
- Se usa para identificar cafes resultantes de procesamiento.
- El consecutivo se incrementara automaticamente y se reiniciara cada año.

Estados iniciales de lote:

- recibido.
- pendiente_laboratorio.
- rechazado.
- aprobado.
- disponible.
- en_proceso.
- procesado.
- vendido_parcial.
- agotado.

Ubicaciones generales:

- bodega.
- finca_proceso.
- trilladora.
- otro.

### 5.4 Tipos De Embalaje

Funciones:

- Crear tipos de embalaje.
- Definir descuento de peso.
- Activar/desactivar tipos.

Datos tentativos:

- Nombre del embalaje.
- Peso a descontar.
- Unidad.
- Estado.

Tipos iniciales:

- Costal o saco de fique: descuento de 0.7 kg.
- Tula o estopa: descuento de 0.2 kg.
- Bolsa interna: descuento adicional de 0.05 kg cuando aplique.

Regla inicial:

- El descuento de embalaje se calculara segun el tipo principal de empaque.
- Si el cafe viene con bolsa interna dentro del costal o de la tula, se sumara el descuento adicional de la bolsa.
- El sistema debera permitir registrar la cantidad de empaques para calcular el descuento total.

### 5.5 Categorias Y Perfiles De Cafe

Funciones:

- Crear categorias.
- Crear perfiles comerciales.
- Asociar lote a categoria/perfil.

Ejemplos:

- Pergamino.
- Trillado.
- Especial.
- Pasilla.

Datos tentativos:

- Nombre.
- Descripcion.
- Estado.

Tipos iniciales de cafe:

- Pergamino.
- Trillado.
- Especial.
- Pasilla.

Perfiles iniciales:

- La empresa maneja 17 perfiles comerciales despues del procesamiento del cafe.
- Los perfiles se configuraran como catalogo editable.
- Mientras se recibe la lista real, se cargaran perfiles provisionales desde Perfil 1 hasta Perfil 17.
- Antes de procesar el cafe, el lote tendra un comentario libre para describir como se recibe o como se guarda.
- Despues del procesamiento, se asignara uno de los perfiles definidos.
- El comentario inicial quedara en el historial del lote y no sera el criterio principal de agrupacion para venta.
- Cada perfil podra tener un precio base.
- El precio base servira como referencia en cotizaciones, pero el vendedor podra modificar el precio final sin cambiar el precio base del perfil.

### 5.6 Procesamiento Basico

Funciones:

- Registrar procesamiento de uno o varios lotes.
- Registrar resultado del proceso.
- Actualizar cantidad disponible.
- Guardar factor de rendimiento y diferencia entre entrada/salida del proceso como dato informativo.
- Agregar perfil comercial.
- Asociar proceso a preventa, si aplica.
- Generar lote procesado con codigo PROC.

Datos tentativos:

- Lotes origen.
- Cantidad tomada de cada lote origen.
- Preventa asociada, si aplica.
- Fecha de proceso.
- Proceso aplicado como texto libre.
- Estado del proceso.
- Cantidad inicial.
- Cantidad final.
- Diferencia entre entrada y salida del proceso.
- Porcentaje informativo de diferencia entre entrada y salida.
- Humedad final.
- Perfil comercial.
- Notas sensoriales.
- Observaciones opcionales.
- Responsable.

Estados de proceso:

- pendiente.
- en_proceso.
- finalizado.

Reglas de anulacion de procesos:

- Al crear un proceso, el sistema mostrara un popup de confirmacion con lotes, cantidades y preventa asociada si aplica.
- Un proceso solo podra anularse en estado pendiente.
- Si un proceso pendiente se anula, las cantidades asignadas vuelven automaticamente disponibles a sus lotes origen.
- Si un proceso esta en_proceso o finalizado no podra anularse, porque el proceso fisico ya no puede retroceder.
- La anulacion de procesos sera excepcional y solo podra hacerla administrador.
- Las anulaciones comerciales no anulan procesos; solo liberan asignaciones de preventa o lotes asociados.

Datos de catacion/laboratorio:

- Aroma: texto libre.
- Fragancia: texto libre.
- Sabor: texto libre.
- Acidez: texto libre.
- Dulzor: texto libre.
- Cuerpo: texto libre.
- Balance: texto libre.
- Uniformidad: texto libre.
- Residual: texto libre.
- Taza limpia: texto libre.
- Score: numero decimal sin rango minimo/maximo definido en fase 1.

Reglas de laboratorio:

- Estos campos seran obligatorios para aprobar un lote recibido de proveedor.
- Estos campos tambien seran obligatorios para finalizar un lote procesado PROC.
- La humedad final sera obligatoria para finalizar un proceso/lote PROC.
- La diferencia entre entrada y salida se calculara automaticamente solo como dato informativo.
- Laboratorio podra corregir cantidad de entrada o salida mientras el proceso este pendiente o en_proceso, con aviso de confirmacion.
- Una vez el proceso quede finalizado, las cantidades quedan bloqueadas.
- Solo administrador podra corregir cantidades de un proceso finalizado en caso excepcional.

### 5.7 Clientes

Funciones:

- Crear cliente.
- Editar cliente.
- Ver historial de cotizaciones.
- Ver historial de ventas.

Datos tentativos:

- Nombre o razon social.
- Tipo de documento.
- Numero de documento.
- Telefono.
- Correo.
- Direccion.
- Ciudad.
- Pais.
- Observaciones.
- Estado.

Datos obligatorios iniciales:

- Nombre o razon social.
- Tipo de documento.
- Numero de documento.
- Telefono.
- Direccion.
- Ciudad.
- Pais.

Correo electronico:

- Opcional en fase 1.

Reglas de clientes:

- Cada cliente tendra una sola direccion principal.
- Las cotizaciones y ventas usaran la direccion registrada del cliente.
- Si el cliente cambia direccion, el usuario debe editar la ficha del cliente antes de cotizar o vender.
- El numero de documento sera obligatorio y unico para evitar duplicados.
- El vendedor podra crear clientes.
- El vendedor podra editar clientes que haya creado.
- Contabilidad y administrador podran crear y editar todos los clientes.
- Bodega solo vera nombre del cliente como referencia operativa en ventas por alistar.
- Laboratorio no vera datos del cliente; solo perfil, cantidad, prioridad, fecha estimada y datos tecnicos/proceso.

### 5.8 Cotizaciones

Funciones:

- Crear cotizacion.
- Agregar productos/cafes.
- Definir cantidades.
- Definir precio negociado.
- Calcular total.
- Generar PDF.
- Cambiar estado.
- Consultar historial.
- Crear preventa por perfil o tipo de cafe aun no disponible.
- Asociar lotes LOT o PROC a una preventa cuando esten listos.
- Registrar condiciones de pago como texto libre.
- Registrar condiciones de entrega/envio como texto libre.
- Registrar fecha estimada de entrega.
- Registrar prioridad.
- Registrar costo de envio tentativo.
- Manejar varios productos/perfiles en una misma cotizacion.
- Mostrar cantidad solicitada, cantidad asignada y cantidad faltante por asignar.

Estados sugeridos:

- borrador.
- enviada.
- aprobada.
- pendiente_produccion.
- lista_para_entrega.
- convertida_en_venta.
- rechazada.

Datos tentativos:

- Numero de cotizacion.
- Cliente.
- Vendedor.
- Fecha.
- Estado.
- Tipo de cotizacion: inventario_disponible o preventa.
- Moneda: COP o USD.
- Fecha estimada de entrega.
- Prioridad: baja, normal, alta, urgente.
- Condiciones de pago.
- Condiciones de entrega/envio.
- Costo de envio tentativo.
- Subtotal.
- Descuento porcentual, si aplica.
- Envio.
- Total.
- Observaciones.

Codigo de cotizacion/preventa:

- Formato inicial: COT-AAAA-0001.
- Ejemplo: COT-2026-0001.
- El consecutivo se incrementara automaticamente y se reiniciara cada año.

Detalle de cotizacion:

- Cafe/perfil/lote.
- Cantidad.
- Unidad.
- Precio unitario.
- Subtotal.
- Estado final solicitado: pergamino o excelso/procesado.
- Perfil o tipo requerido.
- Lotes asociados opcionales.

Reglas de asignacion a preventa:

- Una preventa puede recibir asignaciones parciales de uno o varios lotes.
- Un lote puede asignar solo una parte de su cantidad a una preventa.
- La cantidad restante del lote queda disponible si no esta asignada, vendida o en proceso.
- La asignacion se manejara a nivel general de la preventa en fase 1, sin seguimiento detallado por producto individual.
- Si una preventa tiene varios productos, mantendra un solo estado general.
- No se mostrara avance interno por producto en fase 1.
- El sistema podra mostrar cantidad solicitada, cantidad asignada y cantidad faltante de forma general para la preventa.
- Cuando la cantidad asignada cubra lo solicitado, el sistema mostrara opcion para pasar a lista_para_entrega.
- El paso a lista_para_entrega requiere confirmacion con popup.
- Solo contabilidad y administrador podran confirmar asignacion final y pasar preventa a lista_para_entrega.
- Si un proceso esta asociado a una preventa, el PROC resultante queda bloqueado/sugerido para esa preventa hasta confirmacion de contabilidad o administrador.
- Contabilidad y administrador podran liberar asignaciones de lotes a preventas antes de convertirlas en venta.
- Al liberar una asignacion, la cantidad vuelve automaticamente a disponibilidad general.
- La liberacion de asignacion requiere popup de confirmacion.
- La observacion o motivo de liberacion sera opcional.
- Laboratorio finaliza proceso y registra datos tecnicos, pero no asigna lotes ni cambia preventas a lista_para_entrega.

Reglas de precio:

- El sistema podra sugerir el precio base del perfil.
- El vendedor podra modificar el precio en la cotizacion.
- El precio modificado quedara guardado solo en esa cotizacion.
- La modificacion del precio cotizado no cambiara el precio base del perfil o cafe.
- Si la cotizacion esta en COP, el sistema sugiere precio base COP.
- Si la cotizacion esta en USD, el sistema sugiere precio base USD.
- No se hara conversion automatica entre monedas en fase 1.

### 5.9 Ventas Y Referencias De Factura

Funciones:

- Crear venta.
- Convertir cotizacion en venta.
- Registrar referencia de factura externa.
- Registrar datos comerciales.
- Descontar inventario.
- Consultar historial.
- Filtrar por fecha, cliente, vendedor o estado.

Datos tentativos:

- Numero interno de venta.
- Cliente.
- Datos del cliente asociados a la venta.
- Cotizacion origen, si aplica.
- Vendedor.
- Responsable de contabilidad.
- Fecha de venta.
- Referencia de factura externa.
- Fecha de factura externa.
- Valor de factura externa.
- Costos asociados.
- Moneda: COP o USD.
- Envio cobrado.
- Subtotal.
- Descuento porcentual.
- Total.
- Estado de pago.
- Fecha estimada de pago, obligatoria si el estado de pago es pendiente_pago o pago_parcial.
- Estado de despacho.
- Observaciones.
- Estado.
- PDF asociado, si aplica.

Codigo interno de venta:

- Formato inicial: VEN-AAAA-0001.
- Ejemplo: VEN-2026-0001.
- El consecutivo se incrementara automaticamente y se reiniciara cada año.
- La referencia de factura externa sera opcional en fase 1.
- El PDF de venta/factura interna usara el numero interno VEN como referencia principal.
- Si existe referencia de factura externa, tambien podra mostrarse en el PDF.

Detalle de venta:

- Cafe/perfil/lote.
- Cantidad vendida.
- Unidad.
- Precio unitario.
- Subtotal.
- Lotes descontados y cantidad tomada de cada lote.

Estados de pago:

- pagada.
- pago_parcial.
- pendiente_pago.

Estados de despacho:

- pendiente_alistamiento.
- alistado.
- despachado.

Reglas de anulacion de ventas por despacho:

- Una venta despachada no podra anularse, porque el cafe ya salio de bodega.
- Una venta solo podra anularse antes de despacho, en estado pendiente_alistamiento o alistado.
- Si una venta se anula antes de despacho, el inventario se devuelve a los lotes descontados.
- La venta anulada saldra de las listas operativas de bodega.

Datos logisticos opcionales:

- Direccion de envio.
- Ciudad/pais.
- Transportadora.
- Numero de guia.
- Fecha estimada de envio.
- Fecha real de envio.

### 5.10 Pagos Y Cartera

Funciones:

- Registrar pagos o abonos sobre preventas y ventas.
- Validar o rechazar pagos desde contabilidad.
- Recalcular saldo pendiente.
- Mostrar cuentas por cobrar.
- Filtrar cartera por cliente, estado de pago, perfil vendido, fecha, vendedor y factura/venta.

Filtros de cartera:

- Estado de pago.
- Cliente.
- Vendedor.
- Fecha de venta.
- Fecha estimada de pago.
- Perfil o tipo de cafe vendido.
- Moneda.
- Venta interna VEN.

Reglas de cartera:

- Las ventas anuladas no apareceran en cartera.

Datos tentativos de pago:

- Venta o preventa asociada.
- Fecha del pago.
- Valor pagado.
- Metodo de pago.
- Referencia o comprobante como texto.
- Observacion.
- Usuario que registro.
- Usuario que valido, si aplica.
- Estado.

Estados de pago individual:

- registrado.
- validado.
- rechazado.

Metodos de pago:

- efectivo.
- transferencia.
- consignacion.
- tarjeta.
- otro.

Reglas de metodo de pago:

- El metodo se seleccionara desde un selector simple.
- La referencia o comprobante se registrara como texto.
- Si el metodo es otro, se habilitara observacion para describirlo.

### 5.11 Cuentas Por Pagar

Funciones:

- Crear cuentas por pagar.
- Registrar pagos o abonos.
- Consultar cuentas pendientes, parciales y pagadas.
- Mostrar alertas por fecha estimada de pago.
- Exportar reporte a Excel.

Alcance:

- Compras de cafe a proveedores.
- Transporte.
- Empaques.
- Servicios.
- Otros gastos.

Datos tentativos:

- Proveedor o tercero.
- Lote relacionado, obligatorio si la categoria es cafe.
- Concepto.
- Categoria: cafe, transporte, empaque, servicios, otro.
- Valor total.
- Saldo pendiente.
- Fecha de creacion.
- Fecha estimada de pago.
- Fecha de pago, si aplica.
- Metodo de pago, si aplica.
- Referencia de pago, si aplica.
- Estado.
- Observaciones.

Estados:

- pendiente.
- pago_parcial.
- pagada.

Reglas:

- Contabilidad y administrador podran crear cuentas por pagar.
- Contabilidad y administrador podran registrar pagos o abonos.
- En fase 1, los pagos de cuentas por pagar se registran directamente, sin flujo de validacion.
- Los pagos de cuentas por pagar usaran el mismo selector de metodo de pago y referencia en texto.
- Las categorias de cuentas por pagar seran fijas en fase 1: cafe, transporte, empaque, servicios y otro.
- Si la categoria es cafe, el lote relacionado sera obligatorio.
- Si la categoria es cafe, solo se podran seleccionar lotes no rechazados.
- Una cuenta por pagar de categoria cafe correspondera a un solo lote.
- Un lote solo podra tener una cuenta por pagar de categoria cafe asociada.
- El sistema bloqueara la creacion de una segunda cuenta por pagar de cafe para el mismo lote, para evitar doble registro.
- Para compras de lotes de cafe pagadas con recibo, contabilidad podra crear manualmente una cuenta por pagar en estado pagada, categoria cafe, con referencia obligatoria al lote relacionado.
- La cuenta por pagar por compra de lote no se creara automaticamente; se hara manualmente para mantener flexibilidad operativa.
- Si una cuenta por pagar se crea en estado pagada, debera registrar metodo de pago, referencia y fecha de pago.
- Si una cuenta por pagar se crea en estado pendiente, la fecha estimada de pago sera obligatoria.
- Si una cuenta por pagar queda en pago_parcial, debera tener fecha estimada de proximo pago.
- Cuando el saldo llegue a cero, la cuenta por pagar pasara automaticamente a pagada.
- Las cuentas por pagar generaran alerta para contabilidad y administrador cuando llegue la fecha estimada de pago y sigan pendientes o parciales.

Filtros de reporte:

- Estado.
- Categoria.
- Fecha de creacion.
- Fecha estimada de pago.
- Proveedor o tercero.
- Lote relacionado, si la categoria es cafe.
- El reporte permitira consultar cuentas pendientes, parciales y pagadas.

### 5.12 Movimientos De Inventario

Funciones:

- Registrar entradas.
- Registrar salidas por venta.
- Registrar ajustes manuales autorizados.
- Registrar procesamiento.
- Consultar historial.

Tipos de movimiento:

- Entrada.
- Rechazo.
- Venta.
- Procesamiento.
- Ajuste.
- Diferencia de proceso.

Datos tentativos:

- Lote.
- Tipo de movimiento.
- Cantidad.
- Unidad.
- Fecha.
- Usuario responsable.
- Referencia relacionada.
- Observaciones.

Reglas de ajustes manuales:

- Administrador y contabilidad podran realizar ajustes manuales.
- Bodega no registrara ajustes en fase 1; los reportara por fuera.
- El ajuste podra aumentar o disminuir la cantidad disponible actual del lote en bodega.
- El ajuste no modificara cantidades ya vendidas ni cantidades en proceso.
- El sistema registrara la diferencia como movimiento de ajuste.
- El motivo del ajuste no sera obligatorio en fase 1.

### 5.13 Alertas

Funciones:

- Mostrar cafes agotados.
- Mostrar cafes con bajo inventario.
- Configurar umbral minimo.
- Mostrar preventas pendientes de produccion.
- Mostrar preventas listas para entrega.
- Mostrar ventas pendientes de alistamiento.
- Mostrar ventas despachadas con pago pendiente o parcial.
- Mostrar ventas con fecha estimada de pago cumplida y estado pendiente/parcial.
- Mostrar preventas con fecha estimada de entrega cercana o vencida.
- Mostrar cuentas por pagar con fecha estimada de pago cumplida y estado pendiente/parcial.

Datos tentativos:

- Categoria o perfil.
- Cantidad minima.
- Estado de alerta.

Reglas iniciales de alerta:

- Inventario agrupado menor a 500 kg.
- Lote con humedad fuera del rango 10%-12%.
- Lote con mas de 15 dias en bodega sin vender/procesar.
- Preventas pendientes de produccion.
- Preventas listas para entrega.
- Ventas pendientes de alistamiento.
- Ventas despachadas con pago pendiente o parcial.
- Pago atrasado desde el mismo dia de la fecha estimada de pago si la venta no esta pagada.
- Cuenta por pagar desde el mismo dia de la fecha estimada si no esta pagada.
- Preventa/entrega 2 dias antes de la fecha estimada, el mismo dia y despues de la fecha si no esta lista.
- Las alertas se mostraran solo en dashboard/pantalla, sin correos ni mensajes automaticos en fase 1.
- Cada rol vera sus alertas correspondientes.
- Administrador vera todas las alertas inicialmente.
- Alertas de fecha estimada de entrega/preventa visibles para vendedor, contabilidad y administrador.
- Laboratorio vera procesos pendientes/en curso ordenados por fecha estimada de entrega y prioridad, sin alertas extra de entrega.

### 5.14 Reportes

Reportes iniciales:

- Inventario actual.
- Inventario por lote.
- Inventario por tipo o perfil.
- Cafes agotados.
- Cafes con bajo stock.
- Ventas por rango de fechas.
- Ventas por cliente.
- Ventas por vendedor.
- Total vendido por periodo.
- Entradas de cafe por periodo.
- Procesamientos realizados.
- Exportacion de reportes a Excel.
- Cartera y cuentas por cobrar.
- Cuentas por pagar.
- Ventas despachadas con pago pendiente/parcial.
- Proveedores por lotes entregados, aprobados, rechazados, kg comprados, humedad promedio, score promedio, tipo/variedad y zona de procedencia.
- Utilidad/margen estimado por venta, visible solo para administrador y contabilidad.

Backups y exportaciones:

- El sistema debera contar con backup automatico diario de la base de datos.
- El backup automatico diario sera gestionado por el proveedor/hosting PostgreSQL.
- Administrador y contabilidad podran generar backup manual como exportacion Excel/CSV.
- El backup manual permitira seleccionar modulos especificos o exportar todo.
- El backup manual podra incluir datos sensibles como costos, pagos y margenes.
- Se guardara historial simple de backups manuales: fecha, usuario y modulos exportados.

Modulo Backups:

- Visible solo para administrador y contabilidad.
- Permitira exportar todo.
- Permitira exportar por modulos.
- Mostrara historial de exportaciones manuales.

Reportes prioritarios de fase 1:

- Inventario actual por lote.
- Inventario agrupado por tipo/perfil.
- Ventas por rango de fechas.
- Ventas por vendedor.
- Cartera/cuentas por cobrar.
- Cuentas por pagar.
- Preventas pendientes de produccion.
- Procesos en curso.
- Proveedores por calidad/tipo de cafe.
- Margen/utilidad estimada por venta.

Reglas de reportes:

- Todos los reportes prioritarios deberan poder exportarse a Excel.
- Los reportes de margen/utilidad se calcularan por venta completa.
- Los reportes de ventas/margen permitiran filtrar por moneda.
- No se sumaran COP y USD mezclados en un mismo total consolidado.
- Reporte de ventas por vendedor sera visible solo para administrador y contabilidad.
- Reportes generales de ventas no mostraran ventas anuladas en fase 1.
- Ventas anuladas quedaran accesibles solo en historial/detalle interno para administrador y contabilidad cuando se consulten especificamente.

Graficas iniciales:

- Ventas por mes.
- Inventario por tipo de cafe.
- Top clientes por valor comprado.
- Cafes con bajo inventario.

## 6. Reglas De Negocio Iniciales

- Un cafe rechazado no entra al inventario disponible.
- Los cafes rechazados se guardaran como historico tecnico para analisis de proveedores, calidad y posibles oportunidades comerciales.
- Un lote rechazado queda definitivamente rechazado y no se reactiva.
- Un lote aprobado por laboratorio pero aun no comprado/pagado puede pasar a rechazado si la negociacion no se concreta.
- El rechazo posterior a aprobacion solo podra hacerlo contabilidad o administrador.
- El rechazo posterior podra guardar observacion opcional.
- Un lote disponible, ya comprado/pagado, no podra pasar a rechazado; solo podra ajustarse, procesarse o venderse.
- Todo cafe aceptado debe tener codigo unico de lote.
- El codigo de lote tendra formato LOT-AAAA-0001.
- Todo cafe procesado resultante debe tener codigo unico PROC-AAAA-0001.
- La humedad aceptada inicialmente estara entre 10% y 12%.
- El sistema debe calcular peso neto aplicando descuento por embalaje.
- El inventario disponible no puede quedar negativo.
- Un lote recibido no puede venderse ni procesarse hasta que laboratorio lo apruebe y contabilidad registre compra/pago.
- Recepcion registra datos fisicos; contabilidad o administrador registra precio de compra y pago al proveedor.
- Una cotizacion/preventa no descuenta inventario.
- Una preventa puede existir aunque no haya inventario suficiente.
- Una preventa puede quedar pendiente_produccion mientras se consigue, prepara o procesa cafe.
- Un proceso puede asociarse a una preventa.
- Un lote PROC resultante de proceso asociado a preventa queda bloqueado/sugerido para esa preventa hasta confirmacion de contabilidad o administrador.
- Las asignaciones a preventa pueden ser parciales y de varios lotes.
- El sistema mostrara cantidad solicitada, asignada y faltante por asignar.
- Contabilidad o administrador confirma asignacion final y cambio a lista_para_entrega.
- Un lote asignado a preventa puede liberarse por contabilidad o administrador antes de convertir a venta.
- Liberar asignacion devuelve la cantidad a disponibilidad general y requiere popup de confirmacion.
- Motivo de liberacion sera opcional.
- Las cotizaciones no tendran fecha de vencimiento en la primera version.
- Una venta confirmada descuenta inventario.
- El descuento de inventario se realizara unicamente cuando la cotizacion se convierta en venta o cuando se cree una venta directa.
- Cuando una venta tome cafe de varios lotes del mismo perfil, el sistema propondra descontar primero desde el lote mas antiguo disponible.
- La propuesta FIFO debe ser confirmada por usuario autorizado antes de registrar la venta.
- Si una preventa tiene lotes asociados, se descuentan primero esos lotes; si falta cantidad, se completa con FIFO general.
- La agrupacion para venta despues del procesamiento se hara por perfil comercial definido.
- El cafe no procesado podra venderse por lote y, si se requiere, tambien podra agruparse por tipo de cafe.
- Cuando un lote llegue a cantidad disponible cero, quedara como registro historico con sus datos, movimientos y procesos.
- Una cotizacion convertida en venta no debe convertirse dos veces.
- Solo usuarios autorizados pueden hacer ajustes manuales de inventario.
- Todo descuento de inventario debe quedar registrado como movimiento.
- El precio final de cotizacion puede ser definido por el vendedor.
- Cada perfil podra tener precio base, pero el precio cotizado sera independiente.
- Cada perfil podra tener precio base en COP y USD.
- Las cotizaciones y ventas podran manejar moneda COP o USD sin conversion automatica.
- Cantidades comerciales se manejaran en kg.
- La referencia de factura externa es informativa; el sistema no reemplaza la facturacion oficial.
- Para aprobar un lote recibido de proveedor o finalizar un lote procesado PROC, laboratorio debera registrar la catacion con aroma, fragancia, sabor, acidez, dulzor, cuerpo, balance, uniformidad, residual, taza limpia y score.
- Campos de catacion seran texto libre, excepto score que sera numerico decimal sin rango definido en fase 1.
- Humedad final sera obligatoria para finalizar un proceso/lote PROC.
- Diferencia entre entrada y salida se calculara automaticamente como referencia.
- Laboratorio podra corregir cantidades antes de finalizar un proceso, con confirmacion.
- Proceso finalizado queda bloqueado para edicion de cantidades, salvo correccion excepcional por administrador.
- El vendedor puede registrar pagos o abonos, pero contabilidad valida o corrige.
- Las ventas pueden quedar pagada, pago_parcial o pendiente_pago.
- Una venta puede despacharse aunque tenga pago pendiente o parcial cuando el cliente sea de confianza.
- Los abonos posteriores recalculan saldo; si el saldo llega a cero, la venta pasa a pagada.
- La utilidad/margen estimado se calcula solo sobre cafe, sin incluir envio.
- El vendedor no puede ver costo de compra ni utilidad/margen.
- Costo de compra y utilidad/margen solo son visibles para administrador y contabilidad.
- Bodega y administrador pueden marcar una venta como alistado.
- Bodega, contabilidad y administrador pueden marcar una venta como despachado.
- Vendedor solo consulta estado de despacho.
- No se eliminaran registros criticos ni maestros en fase 1; se usaran estados activo/inactivo o anulado.
- Proveedores, clientes, vendedores, perfiles, variedades y tipos de cafe se inactivan en vez de eliminarse.
- Ventas, cotizaciones/preventas, pagos, procesos y lotes no se eliminan; se anulan cuando aplique.
- Administrador y contabilidad podran anular ventas.
- Al anular una venta, el inventario se devuelve automaticamente a los lotes descontados.
- Los pagos de una venta anulada quedan en el historial; devoluciones de dinero se manejan por fuera del sistema.
- El vendedor podra anular sus propias cotizaciones/preventas mientras no esten convertidas en venta.
- Administrador y contabilidad podran anular cualquier cotizacion/preventa.
- Si una preventa anulada tenia lotes asignados, esos lotes se liberan automaticamente para venta general.
- Si una preventa asociada a un proceso se anula, el proceso no se anula; solo queda sin preventa asociada y el lote resultante quedara disponible general.
- No se almacenaran archivos PDF o Excel fisicos en fase 1; se generaran bajo demanda desde los datos.
- El sistema sera responsive y permitira ejecutar acciones segun permisos desde movil y escritorio.

## 7. Modelo De Datos Inicial

Entidades principales:

- usuarios.
- roles.
- proveedores.
- clientes.
- lotes_cafe.
- tipos_embalaje.
- categorias_cafe.
- perfiles_cafe.
- variedades_cafe.
- procesos_cafe.
- proceso_lotes_entrada.
- pagos.
- cuentas_por_pagar.
- cuentas_por_pagar_pagos.
- cotizaciones.
- cotizacion_items.
- cotizacion_lotes_asociados.
- ventas.
- venta_items.
- venta_item_lotes.
- movimientos_inventario.
- configuraciones_alertas.

Relaciones principales:

- Un proveedor puede tener muchos lotes.
- Un lote puede tener muchos movimientos.
- Un lote puede participar en cero o muchos procesos.
- Un proceso puede tener uno o muchos lotes de entrada.
- Un proceso puede generar un lote procesado.
- Una preventa puede asociarse a uno o muchos lotes LOT o PROC.
- Un cliente puede tener muchas cotizaciones.
- Un cliente puede tener muchas ventas.
- Una cotizacion puede tener muchos items.
- Una venta puede tener muchos items.
- Una venta puede tener muchos pagos.
- Una preventa puede tener muchos pagos.
- Una cuenta por pagar puede tener muchos pagos/abonos.
- Una venta puede descontar cantidades de uno o varios lotes.
- Una cotizacion puede convertirse en una venta.
- Un usuario puede crear cotizaciones, ventas, movimientos o procesos.

## 8. Pantallas Iniciales

### Publicas

- Inicio de sesion.

### Administrador

- Dashboard general.
- Alertas generales.
- Usuarios.
- Vendedores.
- Inventario.
- Proveedores.
- Clientes.
- Cotizaciones.
- Preventas.
- Ventas.
- Cartera.
- Cuentas por pagar.
- Reportes.
- Configuracion.

### Recepcion / Inventario

- Dashboard de inventario.
- Registrar entrada de cafe.
- Lotes.
- Detalle de lote.
- Ventas pendientes de alistamiento.
- Ventas alistadas pendientes de despacho.
- Movimientos.

### Vendedor

- Dashboard comercial.
- Inventario disponible.
- Clientes.
- Crear cotizacion/preventa.
- Historial de cotizaciones/preventas propias.
- Detalle de cotizacion/preventa.
- Estado de ventas y despacho propias.

### Contabilidad

- Dashboard contable.
- Cotizaciones aprobadas.
- Preventas listas para entrega.
- Crear venta.
- Historial de ventas.
- Referencias de facturas.
- Pagos.
- Cartera.
- Cuentas por pagar.
- Reportes.

### Laboratorio

- Dashboard de laboratorio.
- Lotes pendientes de laboratorio.
- Procesos pendientes o en curso asociados a preventas.
- Registro de catacion.
- Registro de procesamiento.
- Historico tecnico.

## 9. PDFs

### PDF De Cotizacion

Contenido sugerido:

- Logo o nombre de la empresa.
- Numero de cotizacion.
- Fecha.
- Datos del cliente.
- Detalle de cafes cotizados.
- Cantidades.
- Precios unitarios.
- Moneda.
- Condiciones de pago.
- Condiciones de entrega/envio.
- Costo de envio tentativo.
- Total.
- Observaciones.
- Condiciones comerciales.

### Soporte Interno De Venta

Contenido sugerido:

- Numero interno de venta.
- Referencia de factura externa.
- Cliente.
- Fecha.
- Detalle de venta.
- Moneda.
- Envio.
- Historial de abonos, si el usuario decide incluirlo.
- Saldo pendiente, si el usuario decide incluirlo.
- Total.
- Usuario responsable.

Regla de PDFs:

- Los PDFs se generaran bajo demanda desde los datos.
- No se almacenaran archivos PDF fisicos en fase 1.
- Se usara una plantilla provisional simple hasta recibir la plantilla real.
- El usuario podra descargar o imprimir el PDF cuando lo necesite.
- En ventas/facturas internas, el usuario podra elegir si incluye historial de pagos y saldo pendiente.

## 10. Alcance De La Primera Fase

Incluye:

- Sistema web funcional.
- Autenticacion.
- Roles basicos.
- Inventario por lotes.
- Carga inicial de inventario.
- Registro de entrada de cafe.
- Descuento por embalaje.
- Aceptacion o rechazo.
- Laboratorio y catacion.
- Procesamiento con uno o varios lotes de entrada.
- Generacion de lotes procesados PROC.
- Preventas por perfil o tipo de cafe.
- Clientes.
- Cotizaciones.
- PDF de cotizacion.
- Ventas y referencias de factura externa.
- Pagos, abonos y cartera.
- Cuentas por pagar.
- Alistamiento y despacho.
- Descuento automatico de inventario.
- Alertas de bajo inventario.
- Reportes basicos.
- Exportacion de reportes a Excel bajo demanda.
- Dashboard por rol.

No incluye:

- Facturacion electronica DIAN.
- Integracion con software contable.
- Integracion con basculas.
- Pasarela de pagos.
- App movil nativa.
- Trazabilidad cafetera avanzada.
- Reporteria contable avanzada.
- Integraciones externas.
- Adjuntos de fotos, documentos o comprobantes como archivos en fase 1.

## 11. Plan De Desarrollo Propuesto

### Semana 1

- Definicion final de datos.
- Diseno de base de datos.
- Configuracion del proyecto React + Express.
- Autenticacion.
- Roles.
- Layout general.
- Catalogos base.
- Carga inicial de inventario.

### Semana 2

- Modulo de proveedores.
- Tipos de embalaje.
- Registro de entrada de cafe.
- Generacion de lotes.
- Flujo recepcion -> laboratorio -> aprobado/rechazado.
- Compra/pago de lote por contabilidad.

### Semana 3

- Movimientos de inventario.
- Procesamiento con multiples lotes de entrada.
- Generacion de lotes PROC.
- Control de cantidades disponibles.
- Alertas de bajo inventario.
- Dashboard de laboratorio y bodega.

### Semana 4

- Clientes.
- Cotizaciones/preventas.
- Items de cotizacion.
- Calculos.
- PDF de cotizacion.
- Pagos/abonos iniciales.

### Semana 5

- Ventas.
- Conversion de cotizacion a venta.
- Referencia de factura externa.
- Propuesta FIFO y confirmacion de lotes.
- Alistamiento y despacho.
- Cartera y estados de pago.
- Cuentas por pagar.
- Historial de ventas.

### Semana 6

- Dashboards.
- Reportes basicos.
- Exportacion Excel.
- Pruebas.
- Ajustes.
- Capacitacion.
- Entrega.

## 12. Decisiones Cerradas

- Base de datos: PostgreSQL.
- Frontend: Vercel.
- Backend: Render.
- Roles iniciales: administrador, recepcion/inventario, laboratorio, vendedor y contabilidad.
- Unidad principal de inventario: kilogramos.
- Formato de lote: LOT-AAAA-0001.
- Formato de lote procesado: PROC-AAAA-0001.
- Formato de cotizacion/preventa: COT-AAAA-0001.
- Formato de venta interna: VEN-AAAA-0001.
- Todos los consecutivos se reinician cada año.
- Humedad aceptada: minimo 10% y maximo 12%.
- Tipos iniciales de cafe: pergamino, trillado, especial y pasilla.
- Variedad sera catalogo editable.
- Zona de procedencia sera texto libre.
- Proveedor tendra nombre, telefono unico y direccion como campos obligatorios; correo y observaciones opcionales.
- Productores, fincas o intermediarios se manejaran como proveedores.
- Embalajes iniciales: costal/saco de fique, tula/estopa y bolsa interna adicional.
- Estados de lote: recibido, pendiente_laboratorio, rechazado, aprobado, disponible, en_proceso, procesado, vendido_parcial y agotado.
- Estados de proceso: pendiente, en_proceso y finalizado.
- Procesos solo se podran anular en estado pendiente.
- Procesos en_proceso o finalizados no se podran anular.
- Al anular un proceso pendiente, sus cantidades vuelven a los lotes origen.
- Al crear proceso se mostrara confirmacion con lotes, cantidades y preventa asociada si aplica.
- Ubicacion general: bodega, finca_proceso, trilladora y otro.
- Las cotizaciones/preventas no descuentan inventario.
- Las cotizaciones no tienen fecha de vencimiento.
- Preventas pueden crearse aunque no exista inventario suficiente.
- Preventas usan estado pendiente_produccion cuando el cafe debe conseguirse, prepararse o procesarse.
- Preventas pueden asociarse a lotes LOT o PROC, pero no es obligatorio.
- Preventas pueden tener asignaciones parciales de uno o varios lotes.
- La asignacion se manejara a nivel general de la preventa, sin avance por producto individual en fase 1.
- Solo contabilidad y administrador podran confirmar que una preventa pasa a lista_para_entrega.
- Fecha estimada de entrega sera obligatoria en preventas.
- Prioridad de preventa: baja, normal, alta y urgente.
- Una cotizacion/preventa puede tener varios productos, pero tendra un solo estado general.
- El inventario se descuenta cuando se confirma la venta.
- El descuento por venta usara propuesta FIFO desde el lote mas antiguo disponible y requiere confirmacion.
- Vendedor no puede confirmar ni descontar lotes.
- Contabilidad, administrador y bodega pueden confirmar lotes de venta.
- Las ventas registraran referencia de factura externa, fecha, valor, costos, observaciones y datos del cliente.
- Referencia de factura externa sera opcional en fase 1.
- PDF de venta usara VEN como referencia principal y mostrara referencia externa si existe.
- Los cafes procesados se agruparan para venta por perfil comercial definido.
- Los perfiles comerciales seran un catalogo editable de 17 perfiles iniciales, cargados provisionalmente como Perfil 1 a Perfil 17.
- Cada perfil tendra precio base COP y USD.
- Cotizaciones y ventas podran usar COP o USD sin conversion automatica.
- Condiciones de pago y condiciones de entrega/envio seran texto libre en fase 1.
- Cotizaciones y ventas tendran descuento porcentual opcional.
- El descuento porcentual se aplicara solo sobre el subtotal de productos, no sobre el envio.
- No habra limite de descuento en fase 1.
- No habra impuestos automaticos en fase 1.
- Vendedor puede definir abonos/condiciones de pago.
- Pagos tendran fecha, valor, metodo, referencia/comprobante, observacion, usuario y estado.
- Pagos y comprobantes se registraran como texto, sin adjuntar archivos.
- Metodos de pago: efectivo, transferencia, consignacion, tarjeta y otro.
- Si el metodo de pago es otro, se registrara observacion descriptiva.
- Estados de pago individual: registrado, validado y rechazado.
- Estados de pago de venta: pagada, pago_parcial y pendiente_pago.
- Si una venta queda pendiente_pago o pago_parcial, la fecha estimada de pago sera obligatoria.
- La alerta de pago atrasado aparecera el mismo dia de la fecha estimada si la venta no esta pagada.
- Cuando una venta pase a pagada, se cierra automaticamente la alerta de pago.
- Contabilidad valida/corrige pagos.
- Ventas pueden despacharse con pago pendiente o parcial para clientes de confianza.
- Reporte de cartera sera visible para contabilidad y administrador.
- Vendedor no ve cartera ni saldos pendientes en fase 1.
- Cartera filtrara por estado de pago, cliente, vendedor, fecha de venta, fecha estimada de pago, perfil/tipo de cafe, moneda y venta VEN.
- Ventas anuladas no apareceran en cartera ni reportes generales de ventas.
- Ventas anuladas quedaran disponibles en historial/detalle interno para administrador y contabilidad.
- Costo de compra y utilidad/margen solo visibles para administrador y contabilidad.
- Utilidad/margen se calcula solo sobre cafe, sin incluir envio.
- Margen/utilidad se calculara por venta completa.
- Reportes de ventas/margen permitiran filtrar por moneda y no sumaran COP y USD mezclados.
- Reporte de ventas por vendedor sera visible solo para administrador y contabilidad.
- Vendedor no tendra resumen de rendimiento propio en fase 1.
- Recepcion registra datos fisicos y contabilidad/admin completa precio de compra y pago del lote.
- Un lote aprobado no puede venderse/procesarse hasta quedar comprado/pagado y disponible.
- Para pasar un lote a disponible, el pago al proveedor debe estar completo.
- Cuentas por pagar podran registrar gastos de cafe, transporte, empaque, servicios y otros.
- Cuentas por pagar tendran categorias fijas: cafe, transporte, empaque, servicios y otro.
- Si la categoria de cuenta por pagar es cafe, lote relacionado sera obligatorio.
- Cuenta por pagar de cafe sera relacion uno a uno con lote no rechazado.
- El sistema bloqueara doble cuenta por pagar de cafe para el mismo lote.
- Contabilidad podra crear manualmente cuentas por pagar pagadas para compras de lotes de cafe, vinculandolas al lote si aplica.
- Las cuentas por pagar de compras de lotes no se crearan automaticamente en fase 1.
- Cuentas por pagar tendran estados pendiente, pago_parcial y pagada.
- Contabilidad y administrador podran crear y pagar cuentas por pagar.
- Cuentas por pagar aceptaran pagos parciales, pero sin flujo de validacion en fase 1.
- Cuentas por pagar tendran alerta para contabilidad y administrador cuando llegue la fecha estimada de pago.
- Cuentas por pagar tendran reporte exportable a Excel.
- Cuenta por pagar pagada debera registrar metodo, referencia y fecha de pago.
- Cuenta por pagar pendiente/parcial debera tener fecha estimada de pago o proximo pago.
- Cuenta por pagar con saldo cero pasara automaticamente a pagada.
- Reporte de cuentas por pagar filtrara por estado, categoria, fechas, proveedor/tercero y lote relacionado cuando aplique.
- Estados de despacho: pendiente_alistamiento, alistado y despachado.
- Bodega y administrador pueden marcar alistado.
- Bodega, contabilidad y administrador pueden marcar despachado.
- Vendedor solo consulta estado de despacho.
- Ventas despachadas no podran anularse.
- Ventas solo podran anularse antes de despacho, en estado pendiente_alistamiento o alistado.
- Administrador y contabilidad podran hacer ajustes manuales de inventario.
- Ajustes manuales modifican solo cantidad disponible actual en bodega, no cantidades vendidas ni en proceso.
- No se eliminaran registros criticos ni maestros; se usaran activo/inactivo o anulado.
- Administrador y contabilidad podran anular ventas.
- Anular venta devuelve inventario a los lotes descontados.
- Pagos de ventas anuladas quedan en historial.
- Vendedor podra anular sus propias cotizaciones/preventas si no estan convertidas en venta.
- Administrador y contabilidad podran anular cualquier cotizacion/preventa.
- Anular preventa libera lotes asignados.
- Anulaciones comerciales no anulan procesos ya creados; solo liberan asignaciones.
- Los reportes deberan poder exportarse a Excel.
- PDFs y Excel se generaran bajo demanda y no se guardaran como archivos fisicos en fase 1.
- Los lotes agotados se conservaran como historico.
- Los lotes rechazados se conservaran como historico tecnico, sin ingresar a inventario disponible.
- Lotes rechazados no podran reactivarse.
- Lotes aprobados pero no comprados/pagados podran rechazarse por contabilidad o administrador si no se concreta la negociacion.
- Lotes disponibles no podran pasar a rechazados.
- Campos de catacion definidos: aroma, fragancia, sabor, acidez, dulzor, cuerpo, balance, uniformidad, residual, taza limpia y score.
- Campos de catacion seran texto libre, excepto score decimal.
- Catacion sera obligatoria para aprobar lotes recibidos y finalizar lotes procesados PROC.
- Humedad final sera obligatoria para finalizar procesos/lotes PROC.
- Proceso finalizado bloquea cantidades; solo administrador puede corregirlas excepcionalmente.
- Examen visual de recepcion tendra aprobado/rechazado, porcentaje de defectos y observaciones en texto libre.
- Alertas en dashboard: inventario menor a 500 kg, humedad fuera de rango, lote mas de 15 dias en bodega, preventas pendientes, preventas listas, ventas pendientes de alistamiento y ventas despachadas con pago pendiente/parcial.
- Alertas de preventa/entrega: 2 dias antes de la fecha estimada, el mismo dia y despues de la fecha si no esta lista.
- Alertas de fecha estimada de entrega visibles para vendedor, contabilidad y administrador.
- Laboratorio vera procesos pendientes/en curso ordenados por fecha estimada y prioridad, sin alerta extra de entrega.
- Alertas solo en pantalla/dashboard, sin correos ni mensajes automaticos.
- Cada rol ve sus alertas y administrador ve todas.
- Sistema responsive para computador, tablet y movil.
- Autenticacion simple con usuario y contrasena.
- Sesion expira cada 12 horas.
- Sin registro publico ni recuperacion por correo.
- Administrador crea usuarios y define/cambia contrasenas manualmente.
- Usuarios no cambian su propia contrasena en fase 1.
- En fase 1 se permite crear/activar/desactivar vendedores; los demas roles fijos se crean inicialmente.
- Vendedores solo ven sus propias cotizaciones/preventas.
- Contabilidad y administrador ven cotizaciones/preventas de todos.
- Backup automatico diario.
- Backup manual por Excel/CSV para administrador y contabilidad, con seleccion por modulos o todo.
- Backup manual incluye datos sensibles y guarda historial simple.
- El modulo Backups estara visible solo para administrador y contabilidad.
- Backups automaticos tecnicos se gestionaran desde el proveedor/hosting, no desde la app en fase 1.
- Despliegue fase 1: frontend en Vercel, backend en Render y PostgreSQL administrado en Render o proveedor compatible.
- Al inicio se usaran URLs de Vercel/Render para pruebas y aprobacion; dominio personalizado queda para despues.
- Se manejara un solo ambiente inicial con datos de prueba.
- Antes de iniciar operacion real, los datos de prueba se limpiaran mediante accion tecnica controlada, no con boton visible en el sistema.
- Administrador podra realizar carga inicial de inventario.
- Carga inicial podra crear LOT y PROC directamente disponibles.
- PROC de carga inicial podra asociarse a preventa existente o quedar disponible general.
- Inventario tendra vista por lote y vista agrupada.
- LOT se agrupa por tipo de cafe; PROC se agrupa por perfil comercial.
- Inventario mostrara cantidades disponibles, asignadas a preventa y en proceso.
- Historico vendido se vera en reportes, no en inventario principal.
- Cliente tendra nombre/razon social, tipo de documento, numero de documento, telefono, pais, ciudad y direccion como campos obligatorios.
- Correo del cliente sera opcional.
- Cliente tendra una sola direccion principal.
- Numero de documento del cliente sera unico.
- Vendedor puede crear clientes y editar los que creo.
- Contabilidad y administrador pueden crear/editar todos los clientes.
- Bodega ve nombre del cliente como referencia operativa, sin datos completos.
- Laboratorio no ve datos del cliente.

## 13. Decisiones Pendientes

Estas decisiones deben resolverse antes o durante el diseno detallado:

- Logo y datos legales de la empresa.
- Plantilla real de cotizacion/factura.
- Lista real de los 17 perfiles comerciales.
- Datos iniciales reales para carga: clientes, proveedores, inventario, perfiles y precios base.
- Confirmacion final del hosting/proveedor PostgreSQL y plan con backups automaticos.

## 14. Preguntas Para Levantamiento Detallado

### Empresa Y Operacion

1. Cual es el nombre comercial de la empresa?
2. Tienen logo, colores o identidad visual definida?
3. Cuantas personas usaran el sistema al inicio?
4. Trabajaran todos desde la misma sede o desde ubicaciones distintas?
5. El sistema debe funcionar solo en computadores o tambien debe verse bien en celular?

### Usuarios Y Permisos

6. Que usuarios reales habra en la primera version?
7. Una misma persona puede tener varios roles?
8. El vendedor puede ver todos los clientes o solo los suyos?
9. El vendedor puede ver costos de compra o solo cantidades disponibles y precio de venta?
10. Quien puede editar o eliminar una entrada de cafe ya registrada?
11. Quien puede hacer ajustes manuales de inventario?
12. Quien puede cambiar una cotizacion a venta?

### Entrada De Cafe

13. Que datos exactos se registran cuando llega un cafe?
14. Como identifican hoy a la persona o proveedor que entrega el cafe?
15. Necesitan registrar cedula/NIT del proveedor?
16. Necesitan registrar finca, vereda, municipio o solo procedencia general?
17. Que tipos de embalaje usan?
18. Cuanto pesa o cuanto se descuenta por cada tipo de embalaje?
19. La cantidad de embalajes tambien se registra? Ejemplo: 10 costales.
20. El descuento es por unidad de embalaje o un descuento total?
21. La humedad se registra como porcentaje?
22. Cual es el rango de humedad aceptable?
23. Que opciones tendra el examen visual?
24. Que razones de rechazo se deben registrar?
25. Si un cafe se rechaza, quieren guardar el registro completo o solo una nota?
26. El pago al proveedor se registra en este sistema o solo el valor de compra?

### Lotes E Inventario

27. Como quieren que se genere el codigo unico del lote?
28. El codigo debe incluir fecha, proveedor, tipo de cafe o consecutivo?
29. Que tipos iniciales de cafe manejaran?
30. Que estados puede tener un lote?
31. La unidad principal sera kg, arrobas, cargas, sacos u otra?
32. Se permitira dividir un lote en sublotes?
33. Se permitira mezclar lotes?
34. Necesitan registrar ubicacion fisica del cafe en bodega?
35. Que cantidad minima debe disparar alerta de bajo inventario?

### Procesamiento

36. Que significa exactamente "procesar" cafe dentro de la empresa?
37. Que procesos iniciales necesitan registrar?
38. El procesamiento consume un lote y crea otro lote nuevo, o actualiza el mismo lote?
39. Se debe guardar cantidad inicial, cantidad final y merma?
40. Que datos sensoriales se registraran?
41. Usaran perfil sensorial libre o una lista de opciones?
42. La humedad final es obligatoria despues del proceso?
43. Quien puede registrar procesamiento?

### Agrupacion Para Venta

44. Cuando venden "cafe del mismo perfil", que campos deben coincidir?
45. Deben coincidir tipo, proceso, humedad, perfil sensorial, calidad o solo categoria comercial?
46. El sistema debe escoger automaticamente de que lotes descontar?
47. Si descuenta automaticamente, debe usar primero el lote mas antiguo?
48. O el usuario debe escoger manualmente los lotes que salen?
49. Puede una venta tomar cantidades de varios lotes?

### Clientes

50. Que datos son obligatorios para crear un cliente?
51. Manejan clientes nacionales e internacionales?
52. Necesitan guardar condiciones comerciales por cliente?
53. Necesitan historial de precios por cliente?

### Cotizaciones

54. Que numeracion deben tener las cotizaciones?
55. Las cotizaciones vencen despues de cierto numero de dias?
56. La cotizacion debe tener impuestos, descuentos o solo total simple?
57. El precio se maneja por kg, saco, carga u otra unidad?
58. El vendedor puede modificar cualquier precio?
59. La cotizacion debe reservar inventario temporalmente?
60. Que estados exactos usaran para seguimiento?
61. Que informacion debe salir en el PDF?
62. Tienen formato actual de cotizacion?

### Ventas Y Referencias De Factura

63. Que datos de la factura externa se registraran?
64. Solo numero de factura o tambien fecha, valor, costos, impuestos y observaciones?
65. Una venta puede tener varias referencias de factura?
66. Una factura externa puede cubrir varias ventas?
67. Quien confirma que una venta descuenta inventario?
68. Se permite anular una venta?
69. Si se anula una venta, el inventario debe devolverse?

### Reportes

70. Que reportes son indispensables para la primera entrega?
71. Que filtros necesitan: fecha, cliente, vendedor, tipo de cafe, lote?
72. Que reportes deben exportarse a Excel en la primera version?
73. Que graficas son realmente utiles para administracion?

### Despliegue Y Operacion

74. Donde se instalara el sistema?
75. Ya tienen dominio y hosting?
76. Quieren que el sistema quede en la nube o en un computador/servidor local?
77. Cuantos usuarios trabajaran al mismo tiempo?
78. Necesitan copias de seguridad automaticas?
79. Quien administrara usuarios y contrasenas despues de la entrega?

### Datos Iniciales

80. Tienen lista inicial de proveedores?
81. Tienen lista inicial de clientes?
82. Tienen inventario actual para cargar al sistema?
83. Tienen categorias de cafe ya definidas?
84. Tienen tipos de embalaje y pesos de descuento ya definidos?

## 15. Riesgos Y Controles

### Riesgo: cambios de alcance

Control: mantener esta primera fase enfocada en inventario, cotizaciones, ventas internas y reportes basicos.

### Riesgo: reglas de inventario ambiguas

Control: definir antes del desarrollo como se agrupan y descuentan lotes en ventas.

### Riesgo: datos incompletos del cliente

Control: crear configuraciones editables para categorias, embalajes y alertas.

### Riesgo: errores en descuentos de inventario

Control: todos los movimientos deben quedar registrados y auditables.

### Riesgo: confusion con facturacion real

Control: dejar claro que el sistema solo registra referencias de facturas emitidas en otro sistema.

## 16. Proxima Accion Recomendada

Antes de empezar el desarrollo, se debe responder primero un bloque minimo de preguntas:

- Campos exactos de entrada de cafe.
- Estados de lote.
- Datos obligatorios de cliente.
- Formato de cotizacion PDF.
- Lista de los 17 perfiles comerciales.
- Reportes indispensables.
- Campos exactos del examen visual.
- Reglas de impuestos, descuentos y costos.

Con esas respuestas se puede cerrar el modelo de base de datos y comenzar la implementacion.
