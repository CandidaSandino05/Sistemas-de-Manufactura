# Sistema ERP - Frutitos de Casa 

Este repositorio contiene el desarrollo del Sistema ERP para la planta de manufactura de Mermelada Artesanal de Fresa, desarrollado como Proyecto Integrador.

## 📂 Estructura del Proyecto (Frontend)

- `frontend/index.html`: Landing page.
- `frontend/modulos/`: Contiene todas las vistas del sistema:
  - `dashboard.html` (Panel principal y KPIs)
  - `ventas.html` (Gestión de pedidos y validación de crédito)
  - `inventario.html` (Control de stock y alertas)
  - `fabricacion.html` (Órdenes de fabricación y lotes)
  - `compras.html` (Órdenes de compra a proveedores)
  - `calidad.html` (Inspecciones y trazabilidad)
  - `login.html` (Inicio de Sesion)
- `frontend/css/styles.css`: Hoja de estilos con la paleta de colores de la marca (Rojo mermelada, beige y verde).
- `frontend/img/`: Imágenes utilizadas en las vistas.

##  Tecnologías usadas en el Frontend
- HTML5 (Estructura semántica)
- CSS3 (Diseño personalizado y responsivo)
- Bootstrap 5 (Framework de diseño, menú hamburguesa y tablas adaptables)

##  Tareas pendientes (Backend)
- [ ] Configurar servidor local y base de datos.
- [ ] Conectar las vistas con los modelos de datos (Productos, Clientes, OF, Lotes).
- [ ] Implementar el motor MRP y la generación automática de lotes `F-DDMMAA-NN`.
- [ ] Integración de simulación IoT (temperatura y peso).
