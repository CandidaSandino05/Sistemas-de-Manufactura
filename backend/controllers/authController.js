const { Usuario, Role } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const login = async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({ msg: 'Usuario y contraseña son obligatorios' });
        }

        const user = await Usuario.findOne({
            where: { usuario },
            include: [{ model: Role, as: 'role' }]
        });

        if (!user) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ msg: 'Contraseña incorrecta' });
        }

        const token = jwt.sign(
            { id: user.id, roleId: user.roleId },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        const modulos = user.role.modulosPermitidos
            ? user.role.modulosPermitidos.split(',').map(m => m.trim())
            : [];

        res.json({
            msg: 'Login exitoso',
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                usuario: user.usuario,
                rol: user.role.nombre,
                modulosPermitidos: modulos
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

module.exports = { login };