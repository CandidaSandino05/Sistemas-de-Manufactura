const config = Object.freeze({
    server: {
        port: 3000,
        env: 'production'
    },
    database: {
        name: 'ERP',
        user: 'postgres',
        password: 'Odvin18$',
        host: 'localhost',
        port: 5432,
        dialect: 'postgres',
        logging: false,
        define: {
            timestamps: true,
            underscored: true
        },
        dbRoles: {
            admin: { user: 'admin', password: 'FrutitosAdmin#2026!' },
            fabricacion: { user: 'fabricacion', password: 'FrutitosFab#2026!' },
            ventas: { user: 'ventas', password: 'FrutitosVen#2026!' },
            calidad: { user: 'calidad', password: 'FrutitosCal#2026!' }
        }
    },
    security: {
        jwtSecret: 'frutitos_de_casa_erp_master_secret_key_2026',
        jwtExpiration: '8h',
        saltRounds: 10
    }
});

module.exports = config;
