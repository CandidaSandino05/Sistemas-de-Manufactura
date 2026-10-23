const { Compra } = require('../models');

const listar = async (req, res) => {
    try {
        const data = await Compra.findAll({ order: [['createdAt', 'DESC']] });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar compras' });
    }
};

const crear = async (req, res) => {
    try {
        const { numeroOC, proveedor, fecha, total, estado } = req.body;

        if (!numeroOC || !proveedor || !total) {
            return res.status(400).json({ msg: 'Campos obligatorios: numeroOC, proveedor, total' });
        }

        const nueva = await Compra.create({ numeroOC, proveedor, fecha, total, estado });
        res.status(201).json({ msg: 'Compra creada', data: nueva });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al crear compra' });
    }
};

module.exports = { listar, crear };