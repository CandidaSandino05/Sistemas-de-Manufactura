const express = require('express');
const router = express.Router();

// Middlewares
const verifyToken = require('../controllers/authMiddleware');
const requireModule = require('../controllers/roleMiddleware');

// Controladores
const authCtrl = require('../controllers/authController');
const calidadCtrl = require('../controllers/calidadController');
const compraCtrl = require('../controllers/compraController');
const fabricacionCtrl = require('../controllers/fabricacionController');
const inventarioCtrl = require('../controllers/inventarioController');
const ventaCtrl = require('../controllers/ventaController');

// Modelos (para rutas directas)
const { MovimientoInventario, Inventario, Receta, Compra, Fabricacion, Venta } = require('../models');

// ============ AUTH ============
router.post('/login', authCtrl.login);

// ============ CALIDAD ============
router.get('/calidad',  verifyToken, requireModule('calidad'),  calidadCtrl.listar);
router.post('/calidad', verifyToken, requireModule('calidad'),  calidadCtrl.crear);
router.get('/calidad/ordenes', verifyToken, requireModule('calidad'), async (req, res) => {
    try {
        const ordenes = await Fabricacion.findAll({ order: [['createdAt', 'DESC']] });
        res.json(ordenes);
    } catch (error) { res.status(500).json({ msg: 'Error' }); }
});

// ============ COMPRAS ============
router.get('/compras',  verifyToken, requireModule('compras'),  compraCtrl.listar);
router.post('/compras', verifyToken, requireModule('compras'),  compraCtrl.crear);
router.get('/compras/:numeroOC/pendiente', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const compra = await Compra.findOne({ where: { numeroOC: req.params.numeroOC } });
        if (!compra) return res.status(404).json({ msg: 'Orden no encontrada' });
        const movs = await MovimientoInventario.findAll({ where: { referencia: req.params.numeroOC, tipo: 'ENTRADA' } });
        let ingresado = 0;
        movs.forEach(m => ingresado += parseFloat(m.cantidad));
        const pendiente = parseFloat(compra.cantidad) - ingresado;
        res.json({ pendiente: pendiente > 0 ? pendiente : 0 });
    } catch (error) { res.status(500).json({ msg: 'Error' }); }
});

// ============ FABRICACIÓN ============
router.get('/fabricacion',  verifyToken, requireModule('fabricacion'), fabricacionCtrl.listar);
router.post('/fabricacion', verifyToken, requireModule('fabricacion'), fabricacionCtrl.crear);

// NUEVA RUTA: Actualizar estado de una OF
router.put('/fabricacion/:numeroOF/estado', verifyToken, requireModule('fabricacion'), async (req, res) => {
    try {
        const { estado } = req.body;
        const of = await Fabricacion.findOne({ where: { numeroOF: req.params.numeroOF } });
        if (!of) return res.status(404).json({ msg: 'Orden no encontrada' });
        
        await of.update({ estado });
        res.json({ msg: 'Estado actualizado', data: of });
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar estado' });
    }
});

// ============ INVENTARIO ============
router.get('/inventario',  verifyToken, requireModule('inventario'), inventarioCtrl.listar);
router.post('/inventario', verifyToken, requireModule('inventario'), inventarioCtrl.crear);
router.post('/inventario/producto', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const { codigo, producto, tipo, stockMinimo } = req.body;
        const nuevo = await Inventario.create({ codigo, producto, tipo, stockActual: 0, stockMinimo });
        res.status(201).json(nuevo);
    } catch (error) { res.status(500).json({ msg: 'Error al crear' }); }
});

// ============ VENTAS ============
router.get('/ventas',  verifyToken, requireModule('ventas'),  ventaCtrl.listar);
router.post('/ventas', verifyToken, requireModule('ventas'),  ventaCtrl.crear);
router.get('/ventas/productos', verifyToken, async (req, res) => {
    try { res.json(await Inventario.findAll({ where: { tipo: 'PT' } })); } catch (e) { res.status(500).json({}); }
});

// RUTAS PARA DESPACHO
router.get('/ventas/pedidos-pendientes', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const ventas = await Venta.findAll({ where: { estado: 'En Producción (Sin Stock)' } });
        res.json(ventas);
    } catch (error) { res.status(500).json({ msg: 'Error' }); }
});
router.put('/ventas/:numeroPedido/despachar', verifyToken, requireModule('inventario'), ventaCtrl.despachar);

// ============ RECETAS ============
router.get('/recetas', verifyToken, async (req, res) => {
    try { res.json(await Receta.findAll()); } catch (error) { res.status(500).json({ msg: 'Error' }); }
});

// ============ MOVIMIENTOS ============
router.post('/movimientos', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const { inventarioId, tipo, referencia } = req.body;
        const cantidad = parseFloat(req.body.cantidad);
        if (isNaN(cantidad) || cantidad <= 0) return res.status(400).json({ msg: 'Cantidad inválida' });

        const item = await Inventario.findByPk(inventarioId);
        if (!item) return res.status(404).json({ msg: 'Producto no encontrado' });

        let nuevoStock = parseFloat(item.stockActual);
        if (tipo === 'ENTRADA') nuevoStock += cantidad;
        else if (tipo === 'SALIDA') {
            if (cantidad > nuevoStock) return res.status(400).json({ msg: `Stock insuficiente. Solo hay ${nuevoStock}.` });
            nuevoStock -= cantidad;
        }
        
        await item.update({ stockActual: nuevoStock });
        const mov = await MovimientoInventario.create({ inventarioId, tipo, cantidad, referencia, motivo: 'Ajuste' });
        res.status(201).json({ msg: 'Registrado', data: mov });
    } catch (error) { res.status(500).json({ msg: 'Error al registrar' }); }
});

router.get('/movimientos', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const data = await MovimientoInventario.findAll({
            include: [{ model: Inventario, as: 'inventario' }],
            order: [['fecha', 'DESC']]
        });
        res.json(data);
    } catch (error) { res.status(500).json({ msg: 'Error' }); }
});

module.exports = router;