const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
    nombre: { type: DataTypes.STRING, allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING },
    modulosPermitidos: { type: DataTypes.TEXT, field: 'modulos_permitidos' }
}, { tableName: 'roles', timestamps: false });

const Usuario = sequelize.define('Usuario', {
    nombre: { type: DataTypes.STRING, allowNull: false },
    usuario: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'role_id' }
}, { tableName: 'usuarios' });

const Cliente = sequelize.define('Cliente', {
    codigoCliente: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'codigo_cliente' },
    rucDni: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'ruc_dni' },
    nombre: { type: DataTypes.STRING, allowNull: false },
    tipoCliente: { type: DataTypes.STRING, defaultValue: 'Mayorista', field: 'tipo_cliente' },
    direccion: { type: DataTypes.STRING, allowNull: false },
    telefono: { type: DataTypes.STRING, allowNull: false },
    correo: { type: DataTypes.STRING, allowNull: false },
    limiteCredito: { type: DataTypes.DECIMAL(12, 2), defaultValue: 50000.00, field: 'limite_credito' },
    estado: { type: DataTypes.STRING, defaultValue: 'Activo' }
}, { tableName: 'clientes' });

const Proveedor = sequelize.define('Proveedor', {
    codigoProveedor: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'codigo_proveedor' },
    ruc: { type: DataTypes.STRING, allowNull: false, unique: true },
    razonSocial: { type: DataTypes.STRING, allowNull: false, field: 'razon_social' },
    contactoNombre: { type: DataTypes.STRING, allowNull: false, field: 'contacto_nombre' },
    telefono: { type: DataTypes.STRING, allowNull: false },
    correo: { type: DataTypes.STRING, allowNull: false },
    direccion: { type: DataTypes.STRING, allowNull: false },
    categoriaInsumo: { type: DataTypes.STRING, allowNull: false, field: 'categoria_insumo' },
    tiempoEntregaDias: { type: DataTypes.INTEGER, defaultValue: 3, field: 'tiempo_entrega_dias' },
    calificacion: { type: DataTypes.INTEGER, defaultValue: 5 },
    estado: { type: DataTypes.STRING, defaultValue: 'Activo' }
}, { tableName: 'proveedores' });

const Inventario = sequelize.define('Inventario', {
    codigo: { type: DataTypes.STRING, allowNull: false, unique: true },
    producto: { type: DataTypes.STRING, allowNull: false },
    tipo: { type: DataTypes.STRING },
    unidadMedida: { type: DataTypes.STRING, defaultValue: 'uds', field: 'unidad_medida' },
    stockActual: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'stock_actual' },
    stockMinimo: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'stock_minimo' },
    stockBloqueado: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'stock_bloqueado' },
    costoUnitario: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'costo_unitario' },
    loteActual: { type: DataTypes.STRING, field: 'lote_actual' },
    fechaVencimiento: { type: DataTypes.DATEONLY, field: 'fecha_vencimiento' },
    estadoCalidad: { type: DataTypes.STRING, defaultValue: 'Liberado', field: 'estado_calidad' },
    ubicacionAlmacen: { type: DataTypes.STRING, defaultValue: 'Almacén Central A1', field: 'ubicacion_almacen' }
}, { tableName: 'inventarios' });

const LoteInventario = sequelize.define('LoteInventario', {
    codigoLote: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'codigo_lote' },
    inventarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'inventario_id' },
    tipoItem: { type: DataTypes.STRING, allowNull: false, field: 'tipo_item' },
    cantidadInicial: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cantidad_inicial' },
    cantidadDisponible: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cantidad_disponible' },
    fechaProduccion: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW, field: 'fecha_produccion' },
    fechaVencimiento: { type: DataTypes.DATEONLY, field: 'fecha_vencimiento' },
    estadoCalidad: { type: DataTypes.STRING, defaultValue: 'Cuarentena', field: 'estado_calidad' },
    ordenReferencia: { type: DataTypes.STRING, field: 'orden_referencia' }
}, { tableName: 'lotes_inventario' });

const Receta = sequelize.define('Receta', {
    productoFinal: { type: DataTypes.STRING, allowNull: false, field: 'producto_final' },
    codigoProductoFinal: { type: DataTypes.STRING, defaultValue: 'PT-MER-300', field: 'codigo_producto_final' },
    nivelBom: { type: DataTypes.INTEGER, defaultValue: 1, field: 'nivel_bom' },
    componentePadre: { type: DataTypes.STRING, defaultValue: 'Mermelada de Fresa', field: 'componente_padre' },
    cantidadProducida: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cantidad_producida' },
    codigoIngrediente: { type: DataTypes.STRING, field: 'codigo_ingrediente' },
    ingrediente: { type: DataTypes.STRING, allowNull: false },
    tipoComponente: { type: DataTypes.STRING, defaultValue: 'MP', field: 'tipo_componente' },
    cantidadRequerida: { type: DataTypes.DECIMAL(10, 4), allowNull: false, field: 'cantidad_requerida' },
    unidadMedida: { type: DataTypes.STRING, defaultValue: 'kg', field: 'unidad_medida' },
    mermaEstimadaPct: { type: DataTypes.DECIMAL(5, 2), defaultValue: 2.00, field: 'merma_estimada_pct' },
    costoEstandarUnit: { type: DataTypes.DECIMAL(10, 2), defaultValue: 45.00, field: 'costo_estandar_unit' }
}, { tableName: 'recetas', updatedAt: false });

const Fabricacion = sequelize.define('Fabricacion', {
    numeroOF: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'numero_of' },
    producto: { type: DataTypes.STRING, allowNull: false },
    productoCodigo: { type: DataTypes.STRING, defaultValue: 'PT-MER-300', field: 'producto_codigo' },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    loteAsignado: { type: DataTypes.STRING, field: 'lote_asignado' },
    estado: { type: DataTypes.STRING, defaultValue: 'En Proceso' },
    temperaturaPromedio: { type: DataTypes.FLOAT, field: 'temperatura_promedio', defaultValue: 0 },
    tiempoCoccionMin: { type: DataTypes.INTEGER, field: 'tiempo_coccion_min', defaultValue: 0 },
    brixAlcanzado: { type: DataTypes.FLOAT, field: 'brix_alcanzado', defaultValue: 65.0 },
    curvaTemperaturaJson: { type: DataTypes.TEXT, field: 'curva_temperatura_json' },
    huellaCarbonoKg: { type: DataTypes.DECIMAL(10, 3), field: 'huella_carbono_kg', defaultValue: 0 },
    pedidoOrigen: { type: DataTypes.STRING, field: 'pedido_origen' },
    fechaVencimientoLote: { type: DataTypes.DATEONLY, field: 'fecha_vencimiento_lote' }
}, { tableName: 'fabricaciones' });

const Compra = sequelize.define('Compra', {
    numeroOC: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'numero_oc' },
    proveedor: { type: DataTypes.STRING, allowNull: false },
    proveedorId: { type: DataTypes.INTEGER, field: 'proveedor_id' },
    proveedorRuc: { type: DataTypes.STRING, field: 'proveedor_ruc' },
    proveedorContacto: { type: DataTypes.STRING, field: 'proveedor_contacto' },
    proveedorTelefono: { type: DataTypes.STRING, field: 'proveedor_telefono' },
    fecha: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    fechaEntregaEstimada: { type: DataTypes.DATEONLY, field: 'fecha_entrega_estimada' },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    estado: { type: DataTypes.STRING, defaultValue: 'Pendiente' },
    producto_codigo: { type: DataTypes.STRING, field: 'producto_codigo' },
    cantidad: { type: DataTypes.DECIMAL(10, 2), field: 'cantidad' },
    precio_unitario: { type: DataTypes.DECIMAL(10, 2), field: 'precio_unitario' },
    ofOrigen: { type: DataTypes.STRING, field: 'of_origen' }
}, { tableName: 'compras' });

const Venta = sequelize.define('Venta', {
    numeroPedido: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'numero_pedido' },
    cliente: { type: DataTypes.STRING, allowNull: false },
    clienteId: { type: DataTypes.INTEGER, field: 'cliente_id' },
    rucDni: { type: DataTypes.STRING, field: 'ruc_dni' },
    direccionEntrega: { type: DataTypes.STRING, field: 'direccion_entrega' },
    telefonoCliente: { type: DataTypes.STRING, field: 'telefono_cliente' },
    correoCliente: { type: DataTypes.STRING, field: 'correo_cliente' },
    fecha: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    estado: { type: DataTypes.STRING, defaultValue: 'Pendiente' },
    producto_codigo: { type: DataTypes.STRING, field: 'producto_codigo' },
    cantidad: { type: DataTypes.DECIMAL(10, 2), field: 'cantidad' },
    precio_unitario: { type: DataTypes.DECIMAL(10, 2), field: 'precio_unitario' },
    ofGenerada: { type: DataTypes.STRING, field: 'of_generada' }
}, { tableName: 'ventas' });

const Calidad = sequelize.define('Calidad', {
    lote: { type: DataTypes.STRING, allowNull: false },
    inspector: { type: DataTypes.STRING, allowNull: false },
    sellado: { type: DataTypes.STRING },
    color: { type: DataTypes.STRING },
    consistencia: { type: DataTypes.STRING },
    brixGrados: { type: DataTypes.DECIMAL(5, 2), defaultValue: 66.00, field: 'brix_grados' },
    phNivel: { type: DataTypes.DECIMAL(4, 2), defaultValue: 3.25, field: 'ph_nivel' },
    disposicion: { type: DataTypes.STRING },
    cantidadRechazada: { type: DataTypes.INTEGER, defaultValue: 0, field: 'cantidad_rechazada' },
    accionFisica: { type: DataTypes.TEXT, field: 'accion_fisica' },
    impactoInventario: { type: DataTypes.TEXT, field: 'impacto_inventario' },
    observaciones: { type: DataTypes.TEXT, field: 'observaciones' }
}, { tableName: 'calidades' });

const MovimientoInventario = sequelize.define('MovimientoInventario', {
    inventarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'inventario_id' },
    tipo: { type: DataTypes.STRING, allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    motivo: { type: DataTypes.STRING },
    referencia: { type: DataTypes.STRING },
    lote: { type: DataTypes.STRING },
    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'movimientos_inventario', timestamps: false });

const LecturaSensor = sequelize.define('LecturaSensor', {
    sensorId: { type: DataTypes.STRING, defaultValue: 'PT100-M01', field: 'sensor_id' },
    numeroOF: { type: DataTypes.STRING, field: 'numero_of' },
    lote: { type: DataTypes.STRING },
    temperatura: { type: DataTypes.FLOAT, allowNull: false },
    brix: { type: DataTypes.FLOAT, allowNull: false },
    lcsTemp: { type: DataTypes.FLOAT, defaultValue: 98.0, field: 'lcs_temp' },
    lciTemp: { type: DataTypes.FLOAT, defaultValue: 88.0, field: 'lci_temp' },
    esAlerta: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'es_alerta' },
    tipoAlerta: { type: DataTypes.STRING, field: 'tipo_alerta' },
    observaciones: { type: DataTypes.TEXT },
    horasAcumuladasSensor: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'horas_acumuladas_sensor' },
    huellaCarbonoEstimada: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0, field: 'huella_carbono_estimada' },
    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'lecturas_sensores', timestamps: true, updatedAt: false });

const SensorEstado = sequelize.define('SensorEstado', {
    codigoSensor: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'codigo_sensor' },
    nombre: { type: DataTypes.STRING, defaultValue: 'Sensor PT100 Marmita M-01' },
    horasUso: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'horas_uso' },
    horasMaximas: { type: DataTypes.DECIMAL(10, 2), defaultValue: 500, field: 'horas_maximas' },
    estado: { type: DataTypes.STRING, defaultValue: 'Normal' },
    ultimaLecturaTemp: { type: DataTypes.FLOAT, field: 'ultima_lectura_temp' },
    ultimaLecturaBrix: { type: DataTypes.FLOAT, field: 'ultima_lectura_brix' },
    fechaInstalacion: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW, field: 'fecha_instalacion' },
    ultimoMantenimiento: { type: DataTypes.DATEONLY, field: 'ultimo_mantenimiento' }
}, { tableName: 'sensor_estados' });

Role.hasMany(Usuario, { foreignKey: 'roleId', as: 'usuarios' });
Usuario.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

Inventario.hasMany(MovimientoInventario, { foreignKey: 'inventarioId', as: 'movimientos' });
MovimientoInventario.belongsTo(Inventario, { foreignKey: 'inventarioId', as: 'inventario' });

Inventario.hasMany(LoteInventario, { foreignKey: 'inventarioId', as: 'lotes' });
LoteInventario.belongsTo(Inventario, { foreignKey: 'inventarioId', as: 'inventario' });

Cliente.hasMany(Venta, { foreignKey: 'clienteId', as: 'ventas' });
Venta.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'clienteDetalle' });

Proveedor.hasMany(Compra, { foreignKey: 'proveedorId', as: 'compras' });
Compra.belongsTo(Proveedor, { foreignKey: 'proveedorId', as: 'proveedorDetalle' });

module.exports = {
    sequelize,
    Role,
    Usuario,
    Cliente,
    Proveedor,
    Venta,
    Compra,
    Fabricacion,
    Calidad,
    Inventario,
    LoteInventario,
    Receta,
    MovimientoInventario,
    LecturaSensor,
    SensorEstado
};
