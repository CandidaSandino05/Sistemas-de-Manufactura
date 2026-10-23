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
        const { numeroOC, proveedor, total, estado, producto_codigo, cantidad, precio_unitario } = req.body;
        const fecha = new Date().toISOString().split('T')[0]; // Fecha de hoy

        if (!numeroOC || !proveedor || !total) {
            return res.status(400).json({ msg: 'Campos obligatorios incompletos' });
        }

        const nueva = await Compra.create({ 
            numeroOC, 
            proveedor, 
            fecha, 
            total, 
            estado,
            producto_codigo,
            cantidad,
            precio_unitario
        });
        res.status(201).json({ msg: 'Compra creada', data: nueva });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ msg: 'El número de orden ya existe.' });
        }
        res.status(500).json({ msg: 'Error al crear compra' });
    }
};

module.exports = { listar, crear };