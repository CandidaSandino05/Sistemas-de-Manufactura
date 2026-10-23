const { Venta, Inventario, Fabricacion } = require('../models');

const listar = async (req, res) => {
    try {
        const data = await Venta.findAll({ order: [['createdAt', 'DESC']] });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar ventas' });
    }
};

const crear = async (req, res) => {
    try {
        const { numeroPedido, cliente, total, estado, producto_codigo, cantidad, precio_unitario } = req.body;
        const fecha = new Date().toISOString().split('T')[0];

        if (!numeroPedido || !cliente || !total) {
            return res.status(400).json({ msg: 'Campos obligatorios incompletos' });
        }

        const producto = await Inventario.findOne({ where: { codigo: producto_codigo } });
        let estadoFinal = estado;
        
        if (producto) {
            const stockActual = parseFloat(producto.stockActual);
            const cantSolicitada = parseFloat(cantidad);

            if (stockActual < cantSolicitada) {
                estadoFinal = 'En Producción (Sin Stock)';
                const numeroOF = 'OF-AUTO-' + Date.now().toString().slice(-6);
                const cantidadFaltante = cantSolicitada - stockActual;

                await Fabricacion.create({
                    numeroOF,
                    producto: producto.producto,
                    cantidad: Math.ceil(cantidadFaltante),
                    estado: 'Pendiente por Iniciar'
                });
            }
        }

        const nueva = await Venta.create({ 
            numeroPedido, cliente, fecha, total, 
            estado: estadoFinal, 
            producto_codigo, cantidad, precio_unitario 
        });

        res.status(201).json({ 
            msg: 'Venta procesada', 
            data: nueva,
            alerta: estadoFinal === 'En Producción (Sin Stock)' ? 'Se generó una Orden de Fabricación automática.' : null
        });

    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ msg: 'El número de pedido ya existe.' });
        }
        res.status(500).json({ msg: 'Error al crear venta' });
    }
};

const despachar = async (req, res) => {
    try {
        const { numeroPedido } = req.params;
        const venta = await Venta.findOne({ where: { numeroPedido } });
        
        if (!venta) return res.status(404).json({ msg: 'Pedido no encontrado' });

        await venta.update({ estado: 'Despachado / Facturado' });
        res.json({ msg: 'Pedido despachado con éxito', data: venta });
    } catch (error) {
        res.status(500).json({ msg: 'Error al despachar pedido' });
    }
};

module.exports = { listar, crear, despachar };