# Sistema ERP - Frutitos de Casa 🍓

Este repositorio contiene el desarrollo del Sistema ERP para la planta de manufactura de Mermelada Artesanal de Fresa, desarrollado como Proyecto Integrador.

## 📂 Estructura del Proyecto (Frontend)

- `frontend/index.html`: Pantalla de inicio de sesión (Login).
- `frontend/modulos/`: Contiene todas las vistas del sistema:
  - `dashboard.html` (Panel principal y KPIs)
  - `ventas.html` (Gestión de pedidos y validación de crédito)
  - `inventario.html` (Control de stock y alertas)
  - `fabricacion.html` (Órdenes de fabricación y lotes)
  - `compras.html` (Órdenes de compra a proveedores)
  - `calidad.html` (Inspecciones y trazabilidad)
- `frontend/css/styles.css`: Hoja de estilos con la paleta de colores de la marca (Rojo mermelada, beige y verde).
- `frontend/img/`: Imágenes utilizadas en las vistas.

## 🛠️ Tecnologías usadas en el Frontend
- HTML5 (Estructura semántica)
- CSS3 (Diseño personalizado y responsivo)
- Bootstrap 5 (Framework de diseño, menú hamburguesa y tablas adaptables)

## 📝 Notas para el equipo de Backend
El frontend está diseñado con datos estáticos de prueba (mockup) para visualizar el flujo. Para conectarlo:
1. Utilizar un motor de plantillas (ej. Jinja2 en Flask) para renderizar las tablas con datos reales.
2. Las validaciones lógicas (ej. RF-02 Crédito excedido) deben implementarse en el backend.
3. Respetar las rutas relativas del CSS e imágenes al mover los archivos a las carpetas `templates` y `static` del servidor.

## 🚀 Tareas pendientes (Backend)
- [ ] Configurar servidor local y base de datos.
- [ ] Conectar las vistas con los modelos de datos (Productos, Clientes, OF, Lotes).
- [ ] Implementar el motor MRP y la generación automática de lotes `F-DDMMAA-NN`.
- [ ] Integración de simulación IoT (temperatura y peso).
