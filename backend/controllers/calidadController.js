const { Calidad } = require('../models');

const listar = async (req, res) => {
    try {
        const data = await Calidad.findAll({ order: [['createdAt', 'DESC']] });
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al listar inspecciones' });
    }
};

const crear = async (req, res) => {
    try {
        const { lote, inspector, sellado, color, consistencia, disposicion } = req.body;
        if (!lote || !inspector) {
            return res.status(400).json({ msg: 'Lote e inspector son obligatorios' });
        }
        const nueva = await Calidad.create({ lote, inspector, sellado, color, consistencia, disposicion });
        res.status(201).json({ msg: 'Inspección creada', data: nueva });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al crear inspección' });
    }
};

module.exports = { listar, crear };