const { Usuario, Role } = require('../models');

const requireModule = (modulo) => {
    return async (req, res, next) => {
        try {
            const user = await Usuario.findByPk(req.user.id, {
                include: [{ model: Role, as: 'role' }]
            });

            if (!user) {
                return res.status(404).json({ msg: 'Usuario no encontrado' });
            }

            const modulos = user.role.modulosPermitidos
                ? user.role.modulosPermitidos.split(',').map(m => m.trim())
                : [];

            if (!modulos.includes(modulo)) {
                return res.status(403).json({
                    msg: `No tienes permiso para acceder al módulo: ${modulo}`
                });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(500).json({ msg: 'Error al verificar permisos' });
        }
    };
};

module.exports = requireModule;