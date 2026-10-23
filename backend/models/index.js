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

const Venta = sequelize.define('Venta', {
    numeroPedido: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'numero_pedido' },
    cliente: { type: DataTypes.STRING, allowNull: false },
    fecha: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    estado: { type: DataTypes.STRING, defaultValue: 'Pendiente' }
}, { tableName: 'ventas' });

const Compra = sequelize.define('Compra', {
    numeroOC: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'numero_oc' },
    proveedor: { type: DataTypes.STRING, allowNull: false },
    fecha: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    estado: { type: DataTypes.STRING, defaultValue: 'Pendiente' }
}, { tableName: 'compras' });

const Fabricacion = sequelize.define('Fabricacion', {
    numeroOF: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'numero_of' },
    producto: { type: DataTypes.STRING, allowNull: false },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    loteAsignado: { type: DataTypes.STRING, field: 'lote_asignado' },
    estado: { type: DataTypes.STRING, defaultValue: 'En Proceso' }
}, { tableName: 'fabricaciones' });

const Calidad = sequelize.define('Calidad', {
    lote: { type: DataTypes.STRING, allowNull: false },
    inspector: { type: DataTypes.STRING, allowNull: false },
    sellado: { type: DataTypes.STRING },
    color: { type: DataTypes.STRING },
    consistencia: { type: DataTypes.STRING },
    disposicion: { type: DataTypes.STRING }
}, { tableName: 'calidades' });

const Inventario = sequelize.define('Inventario', {
    codigo: { type: DataTypes.STRING, allowNull: false, unique: true },
    producto: { type: DataTypes.STRING, allowNull: false },
    tipo: { type: DataTypes.STRING },
    stockActual: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'stock_actual' },
    stockMinimo: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'stock_minimo' }
}, { tableName: 'inventarios' });

const Receta = sequelize.define('Receta', {
    productoFinal: { type: DataTypes.STRING, allowNull: false, field: 'producto_final' },
    cantidadProducida: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cantidad_producida' },
    ingrediente: { type: DataTypes.STRING, allowNull: false },
    cantidadRequerida: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'cantidad_requerida' }
}, { tableName: 'recetas', updatedAt: false });

const MovimientoInventario = sequelize.define('MovimientoInventario', {
    inventarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'inventario_id' },
    tipo: { type: DataTypes.STRING, allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    motivo: { type: DataTypes.STRING },
    referencia: { type: DataTypes.STRING },
    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'movimientos_inventario', updatedAt: false });

Role.hasMany(Usuario, { foreignKey: 'roleId', as: 'usuarios' });
Usuario.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

Inventario.hasMany(MovimientoInventario, { foreignKey: 'inventarioId', as: 'movimientos' });
MovimientoInventario.belongsTo(Inventario, { foreignKey: 'inventarioId', as: 'inventario' });

module.exports = {
    sequelize,
    Role,
    Usuario,
    Venta,
    Compra,
    Fabricacion,
    Calidad,
    Inventario,
    Receta,
    MovimientoInventario
};