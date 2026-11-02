const { Sequelize } = require('sequelize');
const config = require('./config');

const sequelize = new Sequelize(
    config.database.name,
    config.database.user,
    config.database.password,
    {
        host: config.database.host,
        port: config.database.port,
        dialect: config.database.dialect,
        logging: config.database.logging,
        define: config.database.define
    }
);

module.exports = sequelize;
