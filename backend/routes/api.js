const express = require('express');
const router = express.Router();

const authCtrl = require('../controllers/authController');
const calidadCtrl = require('../controllers/calidadController');
const compraCtrl = require('../controllers/compraController');
const fabricacionCtrl = require('../controllers/fabricacionController');
const inventarioCtrl = require('../controllers/inventarioController');
const ventaCtrl = require('../controllers/ventaController');

const verifyToken = require('../controllers/authMiddleware');
const requireModule = require('../controllers/roleMiddleware');

router.post('/login', authCtrl.login);

router.get('/calidad',  verifyToken, requireModule('calidad'),  calidadCtrl.listar);
router.post('/calidad', verifyToken, requireModule('calidad'),  calidadCtrl.crear);

router.get('/compras',  verifyToken, requireModule('compras'),  compraCtrl.listar);
router.post('/compras', verifyToken, requireModule('compras'),  compraCtrl.crear);

router.get('/fabricacion',  verifyToken, requireModule('fabricacion'), fabricacionCtrl.listar);
router.post('/fabricacion', verifyToken, requireModule('fabricacion'), fabricacionCtrl.crear);

router.get('/inventario',  verifyToken, requireModule('inventario'), inventarioCtrl.listar);
router.post('/inventario', verifyToken, requireModule('inventario'), inventarioCtrl.crear);

router.get('/ventas',  verifyToken, requireModule('ventas'),  ventaCtrl.listar);
router.post('/ventas', verifyToken, requireModule('ventas'),  ventaCtrl.crear);

router.get('/recetas', verifyToken, async (req, res) => {
    const { Receta } = require('../models');
    const data = await Receta.findAll();
    res.json(data);
});

router.get('/movimientos', verifyToken, requireModule('inventario'), async (req, res) => {
    const { MovimientoInventario, Inventario } = require('../models');
    const data = await MovimientoInventario.findAll({
        include: [{ model: Inventario, as: 'inventario' }],
        order: [['fecha', 'DESC']]
    });
    res.json(data);
});

module.exports = router;