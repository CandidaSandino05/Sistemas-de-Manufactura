const { Usuario, Role } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const ROLE_NORMALIZATION = {
    admin: {
        rol: 'Administrador',
        modulos: ['dashboard', 'ventas', 'inventario', 'fabricacion', 'compras', 'calidad']
    },
    administrador: {
        rol: 'Administrador',
        modulos: ['dashboard', 'ventas', 'inventario', 'fabricacion', 'compras', 'calidad']
    },
    fabricacion: {
        rol: 'Produccion',
        modulos: ['inventario', 'fabricacion', 'compras']
    },
    produccion: {
        rol: 'Produccion',
        modulos: ['inventario', 'fabricacion', 'compras']
    },
    ventas: {
        rol: 'Ventas',
        modulos: ['ventas']
    },
    calidad: {
        rol: 'Calidad',
        modulos: ['calidad']
    }
};

const login = async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({ msg: 'Usuario y contraseña son obligatorios' });
        }

        const usernameClean = usuario.trim().toLowerCase();

        let user = await Usuario.findOne({
            where: { usuario: usernameClean },
            include: [{ model: Role, as: 'role' }]
        });

        if (!user && usuario.trim() !== usernameClean) {
            user = await Usuario.findOne({
                where: { usuario: usuario.trim() },
                include: [{ model: Role, as: 'role' }]
            });
        }

        if (!user) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        const storedPassword = String(user.password || '');
        const isBcryptHash = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$');

        let validPassword = false;
        if (isBcryptHash) {
            validPassword = await bcrypt.compare(password, storedPassword);
        } else {
            validPassword = (password === storedPassword);
            if (validPassword) {
                const newHash = await bcrypt.hash(password, config.security.saltRounds);
                await user.update({ password: newHash });
            }
        }

        if (!validPassword) {
            return res.status(401).json({ msg: 'Contraseña incorrecta' });
        }

        const rawRoleName = (user.role && user.role.nombre ? user.role.nombre : user.usuario).trim().toLowerCase();
        const roleConfig = ROLE_NORMALIZATION[usernameClean] || ROLE_NORMALIZATION[rawRoleName];

        const modulosDB = user.role && user.role.modulosPermitidos
            ? user.role.modulosPermitidos.split(',').map(m => m.trim()).filter(Boolean)
            : [];

        const modulosFinales = roleConfig
            ? roleConfig.modulos
            : modulosDB;

        const rolFinal = roleConfig
            ? roleConfig.rol
            : (user.role ? user.role.nombre : 'Usuario');

        const token = jwt.sign(
            { id: user.id, roleId: user.roleId, rol: rolFinal },
            config.security.jwtSecret,
            { expiresIn: config.security.jwtExpiration }
        );

        res.json({
            msg: 'Login exitoso',
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                usuario: user.usuario,
                rol: rolFinal,
                modulosPermitidos: modulosFinales
            }
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error en el servidor al autenticar' });
    }
};

module.exports = { login };
