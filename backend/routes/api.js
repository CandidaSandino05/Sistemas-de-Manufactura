const express = require('express');
const router = express.Router();

const verifyToken = require('../controllers/authMiddleware');
const requireModule = require('../controllers/roleMiddleware');

const authCtrl = require('../controllers/authController');
const calidadCtrl = require('../controllers/calidadController');
const compraCtrl = require('../controllers/compraController');
const fabricacionCtrl = require('../controllers/fabricacionController');
const inventarioCtrl = require('../controllers/inventarioController');
const ventaCtrl = require('../controllers/ventaController');
const sensorCtrl = require('../controllers/sensorController');

const { MovimientoInventario, Inventario, LoteInventario, Receta, Compra, Fabricacion, Venta } = require('../models');

router.post('/login', authCtrl.login);

router.get('/sensores/lecturas', sensorCtrl.obtenerLecturas);
router.get('/sensores/estado', sensorCtrl.obtenerEstadoSensor);
router.post('/sensores/lectura', sensorCtrl.registrarLectura);
router.post('/sensores/reset', sensorCtrl.resetearSensor);
router.post('/sensores/simular-horas', sensorCtrl.simularHorasSensor);

router.get('/calidad', verifyToken, requireModule('calidad'), calidadCtrl.listar);
router.post('/calidad', verifyToken, requireModule('calidad'), calidadCtrl.crear);
router.get('/calidad/cuarentena', verifyToken, requireModule('calidad'), calidadCtrl.listarCuarentena);
router.post('/calidad/gestionar-cuarentena', verifyToken, requireModule('calidad'), calidadCtrl.gestionarCuarentena);
router.get('/calidad/ordenes', verifyToken, requireModule('calidad'), async (req, res) => {
    try {
        const ordenes = await Fabricacion.findAll({ order: [['createdAt', 'DESC']] });
        res.json(ordenes);
    } catch (error) {
        res.status(500).json({ msg: 'Error al consultar órdenes para calidad' });
    }
});

router.get('/compras', verifyToken, requireModule('compras'), compraCtrl.listar);
router.post('/compras', verifyToken, requireModule('compras'), compraCtrl.crear);
router.put('/compras/:numeroOC/recibir', verifyToken, requireModule('compras'), compraCtrl.recibirCompra);
router.get('/proveedores', verifyToken, compraCtrl.listarProveedores);
router.post('/proveedores', verifyToken, requireModule('compras'), compraCtrl.crearProveedor);

router.get('/compras/:numeroOC/pendiente', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const compra = await Compra.findOne({ where: { numeroOC: req.params.numeroOC } });
        if (!compra) return res.status(404).json({ msg: 'Orden no encontrada' });
        const movs = await MovimientoInventario.findAll({ where: { referencia: req.params.numeroOC, tipo: 'ENTRADA' } });
        let ingresado = 0;
        movs.forEach(m => { ingresado += parseFloat(m.cantidad); });
        const pendiente = parseFloat(compra.cantidad) - ingresado;
        res.json({ pendiente: pendiente > 0 ? pendiente : 0 });
    } catch (error) {
        res.status(500).json({ msg: 'Error al calcular pendiente de compra' });
    }
});

router.get('/fabricacion', verifyToken, requireModule('fabricacion'), fabricacionCtrl.listar);
router.post('/fabricacion', verifyToken, requireModule('fabricacion'), fabricacionCtrl.crear);
router.put('/fabricacion/:numeroOF/iot', verifyToken, requireModule('fabricacion'), fabricacionCtrl.registrarIoT);

router.put('/fabricacion/:numeroOF/estado', verifyToken, requireModule('fabricacion'), async (req, res) => {
    try {
        const { estado, loteAsignado } = req.body;
        const of = await Fabricacion.findOne({ where: { numeroOF: req.params.numeroOF } });
        if (!of) return res.status(404).json({ msg: 'Orden no encontrada' });

        const veniaDeRetrabajo = of.estado === 'En Retrabajo' || String(of.estado).includes('Retrabajo');
        const payload = { estado };
        if (veniaDeRetrabajo && (estado === 'Pendiente de Calidad' || estado === 'Listo para Calidad' || estado === 'Pendiente de Calidad (Retrabajo)')) {
            payload.estado = 'Pendiente de Calidad (Retrabajo)';
        }
        if (loteAsignado) payload.loteAsignado = loteAsignado;
        if (!of.loteAsignado && !loteAsignado) {
            payload.loteAsignado = 'LOTE-PT-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
        }

        if (estado === 'En Proceso') {
            const itemWIP = await fabricacionCtrl.obtenerOCrearItemWIP();
            const kgCocina = +((parseFloat(of.cantidad) || 0) * 0.30).toFixed(2);
            await itemWIP.update({
                stockActual: kgCocina,
                unidadMedida: 'kg',
                loteActual: payload.loteAsignado || of.loteAsignado,
                estadoCalidad: 'En Cocina'
            });
        }

        if (!veniaDeRetrabajo && (estado === 'Listo para Calidad' || estado === 'Pendiente de Calidad')) {
            await fabricacionCtrl.consumirMPYGenerarWIP(of);
        }

        if (veniaDeRetrabajo && (estado === 'Pendiente de Calidad' || estado === 'Listo para Calidad' || estado === 'Pendiente de Calidad (Retrabajo)')) {
            const itemWIP = await Inventario.findOne({ where: { tipo: 'WIP' } });
            if (itemWIP) {
                await itemWIP.update({
                    stockActual: 0,
                    unidadMedida: 'kg',
                    estadoCalidad: 'En Proceso'
                });
            }
            const itemPT = await Inventario.findOne({ where: { tipo: 'PT' } });
            if (itemPT) {
                await itemPT.update({
                    stockBloqueado: +((parseFloat(itemPT.stockBloqueado) || 0) + (parseFloat(of.cantidad) || 0)).toFixed(2),
                    estadoCalidad: 'Cuarentena'
                });
            }
            const codigoLote = payload.loteAsignado || of.loteAsignado;
            if (codigoLote) {
                const loteReg = await LoteInventario.findOne({ where: { codigoLote } });
                if (loteReg) {
                    await loteReg.update({ estadoCalidad: 'Cuarentena' });
                }
            }
        }

        const estNorm = String(estado || '').trim().toLowerCase();
        if (estNorm.startsWith('terminada') || estNorm.includes('cancel') || estNorm.includes('scrap')) {
            await fabricacionCtrl.liberarReservasDeOF(of.numeroOF, `Orden de Fabricación ${estado}`);
        }

        await of.update(payload);
        res.json({
            msg: veniaDeRetrabajo
                ? `Retrabajo finalizado para ${of.numeroOF}. El lote pasó a "${estado}" y está listo para reinspección en Calidad.`
                : 'Estado actualizado',
            data: of
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar estado' });
    }
});

router.get('/inventario', verifyToken, requireModule('inventario'), inventarioCtrl.listar);
router.post('/inventario', verifyToken, requireModule('inventario'), inventarioCtrl.crear);
router.post('/inventario/producto', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const { codigo, producto, tipo, stockMinimo, unidadMedida, costoUnitario, fechaVencimiento, ubicacionAlmacen } = req.body;
        const lote = `LOTE-${tipo || 'INV'}-${Date.now().toString().slice(-5)}`;
        const venc = fechaVencimiento || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
        const nuevo = await Inventario.create({
            codigo,
            producto,
            tipo,
            stockActual: 0,
            stockMinimo,
            unidadMedida: unidadMedida || (tipo === 'MP' ? 'kg' : 'uds'),
            costoUnitario: parseFloat(costoUnitario) || 0,
            loteActual: lote,
            fechaVencimiento: venc,
            estadoCalidad: 'Liberado',
            ubicacionAlmacen: ubicacionAlmacen || 'Almacén Central A1'
        });
        res.status(201).json(nuevo);
    } catch (error) {
        res.status(500).json({ msg: 'Error al crear producto en inventario' });
    }
});

router.get('/lotes', verifyToken, async (req, res) => {
    try {
        const lotes = await LoteInventario.findAll({
            include: [{ model: Inventario, as: 'inventario', required: false }],
            order: [['createdAt', 'DESC']]
        });
        res.json(lotes);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener lotes' });
    }
});

router.get('/ventas', verifyToken, requireModule('ventas'), ventaCtrl.listar);
router.post('/ventas', verifyToken, requireModule('ventas'), ventaCtrl.crear);
router.get('/clientes', verifyToken, ventaCtrl.listarClientes);
router.post('/clientes', verifyToken, requireModule('ventas'), ventaCtrl.crearCliente);

router.get('/ventas/productos', verifyToken, async (req, res) => {
    try {
        res.json(await Inventario.findAll({ where: { tipo: 'PT' } }));
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/ventas/pedidos-pendientes', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        await ventaCtrl.asignarStockLiberadoAPedidosPendientes();
        const ventas = await Venta.findAll({
            where: {
                estado: ['En Producción (Sin Stock)', 'Confirmado']
            },
            order: [['createdAt', 'DESC']]
        });
        res.json(ventas);
    } catch (error) {
        res.status(500).json({ msg: 'Error al consultar pedidos pendientes' });
    }
});

router.put('/ventas/:numeroPedido/despachar', verifyToken, requireModule('inventario'), ventaCtrl.despachar);

router.get('/recetas', verifyToken, async (req, res) => {
    try {
        res.json(await Receta.findAll({ order: [['nivelBom', 'ASC'], ['id', 'ASC']] }));
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener BOM' });
    }
});

router.post('/movimientos', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const { inventarioId, tipo, referencia, motivo, lote } = req.body;
        const cantidad = parseFloat(req.body.cantidad);
        if (isNaN(cantidad) || cantidad <= 0) return res.status(400).json({ msg: 'Cantidad inválida' });

        const item = await Inventario.findByPk(inventarioId);
        if (!item) return res.status(404).json({ msg: 'Producto no encontrado' });

        let nuevoStock = parseFloat(item.stockActual);
        if (tipo === 'ENTRADA') {
            nuevoStock += cantidad;
        } else if (tipo === 'SALIDA') {
            if (cantidad > nuevoStock) {
                return res.status(400).json({ msg: `Stock insuficiente. Solo hay ${nuevoStock}.` });
            }
            nuevoStock -= cantidad;
        }

        await item.update({
            stockActual: nuevoStock,
            loteActual: lote || item.loteActual
        });

        if (tipo === 'ENTRADA' && referencia && referencia.startsWith('OC-')) {
            const compraRef = await Compra.findOne({ where: { numeroOC: referencia } });
            if (compraRef && cantidad >= parseFloat(compraRef.cantidad)) {
                await compraRef.update({ estado: 'Recibida' });
                await compraCtrl.liberarReservaOFAlRecibirOC(compraRef, item);
            }
        }

        const mov = await MovimientoInventario.create({
            inventarioId,
            tipo,
            cantidad,
            referencia,
            motivo: motivo || 'Operación de Almacén',
            lote: lote || item.loteActual
        });

        if (tipo === 'ENTRADA' && item.tipo === 'PT') {
            await ventaCtrl.asignarStockLiberadoAPedidosPendientes();
        }

        res.status(201).json({ msg: 'Movimiento registrado', data: mov });
    } catch (error) {
        res.status(500).json({ msg: 'Error al registrar movimiento' });
    }
});

router.get('/movimientos', verifyToken, requireModule('inventario'), async (req, res) => {
    try {
        const data = await MovimientoInventario.findAll({
            include: [{ model: Inventario, as: 'inventario' }],
            order: [['fecha', 'DESC']]
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al consultar movimientos' });
    }
});

module.exports = router;
