const jwt = require('jsonwebtoken');
const config = require('../config/config');

const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ msg: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;

        const verified = jwt.verify(token, config.security.jwtSecret);
        req.user = verified;
        next();
    } catch (error) {
        res.status(401).json({ msg: 'Token inválido o expirado' });
    }
};

module.exports = verifyToken;
