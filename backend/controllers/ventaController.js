const { Venta } = require('../models');

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
        const { numeroPedido, cliente, fecha, total, estado } = req.body;

        if (!numeroPedido || !cliente || !total) {
            return res.status(400).json({ msg: 'Campos obligatorios: numeroPedido, cliente, total' });
        }

        const nueva = await Venta.create({ numeroPedido, cliente, fecha, total, estado });
        res.status(201).json({ msg: 'Venta creada', data: nueva });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al crear venta' });
    }
};

module.exports = { listar, crear };