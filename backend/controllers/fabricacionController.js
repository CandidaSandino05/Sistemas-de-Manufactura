const { Fabricacion } = require('../models');

const listar = async (req, res) => {
    try {
        const data = await Fabricacion.findAll({ order: [['createdAt', 'DESC']] });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar fabricación' });
    }
};

const crear = async (req, res) => {
    try {
        const { numeroOF, producto, cantidad, loteAsignado, estado } = req.body;

        if (!numeroOF || !producto || !cantidad) {
            return res.status(400).json({ msg: 'Campos obligatorios: numeroOF, producto, cantidad' });
        }

        const nueva = await Fabricacion.create({ numeroOF, producto, cantidad, loteAsignado, estado });
        res.status(201).json({ msg: 'Orden de fabricación creada', data: nueva });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al crear orden' });
    }
};

module.exports = { listar, crear };