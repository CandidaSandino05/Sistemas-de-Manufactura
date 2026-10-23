const { Inventario } = require('../models');

const listar = async (req, res) => {
    try {
        const data = await Inventario.findAll({ order: [['createdAt', 'DESC']] });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar inventario' });
    }
};

const crear = async (req, res) => {
    try {
        const { codigo, producto, tipo, stockActual, stockMinimo } = req.body;

        if (!codigo || !producto) {
            return res.status(400).json({ msg: 'Campos obligatorios: codigo, producto' });
        }

        const nuevo = await Inventario.create({ codigo, producto, tipo, stockActual, stockMinimo });
        res.status(201).json({ msg: 'Item de inventario creado', data: nuevo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al crear item' });
    }
};

module.exports = { listar, crear };