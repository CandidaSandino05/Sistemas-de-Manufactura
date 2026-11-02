const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const apiRoutes = require('./routes/api');
const { sequelize, Role, Usuario, Inventario, Receta } = require('./models');
const { ejecutarSeed } = require('./seed');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ msg: 'API Frutitos de Casa funcionando' });
});

app.use('/api', apiRoutes);

const ROLES_SEMILLA = [
    {
        nombre: 'Administrador',
        aliases: ['admin', 'administrador'],
        descripcion: 'Control gerencial y auditoría integral del ERP',
        modulosPermitidos: 'dashboard,ventas,inventario,fabricacion,compras,calidad'
    },
    {
        nombre: 'Produccion',
        aliases: ['produccion', 'fabricacion'],
        descripcion: 'Gestión de planta, MRP, inventario y compras de insumos',
        modulosPermitidos: 'inventario,fabricacion,compras'
    },
    {
        nombre: 'Ventas',
        aliases: ['ventas'],
        descripcion: 'Gestión comercial, cartera de clientes y pedidos',
        modulosPermitidos: 'ventas'
    },
    {
        nombre: 'Calidad',
        aliases: ['calidad'],
        descripcion: 'Inspección bromatológica, liberación de lotes y disposición',
        modulosPermitidos: 'calidad'
    }
];

const USUARIOS_SEMILLA = [
    {
        nombre: 'Administrador General',
        usuario: 'admin',
        passwordHash: '$2b$10$mFgimzEjvXGTKyX4goatdek3ZvVQw0nzz0U7JdZd01NCIMQbTCKam',
        rolClave: 'Administrador'
    },
    {
        nombre: 'Jefe de Planta y Fabricación',
        usuario: 'fabricacion',
        passwordHash: '$2b$10$1q6WDLmPjV6ZXhzcofgcqOwW43RiOTeH1BNMsCHE3nhclec2Iyw6S',
        rolClave: 'Produccion'
    },
    {
        nombre: 'Ejecutivo de Ventas Comerciales',
        usuario: 'ventas',
        passwordHash: '$2b$10$f2TO/A6VeggO84zd7cGFpOlC/qI2RWFZrKot5fQkbOSUw1krurFq2',
        rolClave: 'Ventas'
    },
    {
        nombre: 'Inspector de Control de Calidad',
        usuario: 'calidad',
        passwordHash: '$2b$10$.PVXa0iLoQh92liPeP6rzOf5.gykkbk2xSO/b7GnJpEam.fQAsvbi',
        rolClave: 'Calidad'
    }
];

const sincronizarRolesYUsuarios = async () => {
    const rolesExistentes = await Role.findAll();
    const mapaRolesId = {};

    for (const rSeed of ROLES_SEMILLA) {
        let rolEncontrado = rolesExistentes.find(r =>
            rSeed.aliases.includes(String(r.nombre || '').trim().toLowerCase())
        );

        if (rolEncontrado) {
            await rolEncontrado.update({
                descripcion: rSeed.descripcion,
                modulosPermitidos: rSeed.modulosPermitidos
            });
        } else {
            rolEncontrado = await Role.create({
                nombre: rSeed.nombre,
                descripcion: rSeed.descripcion,
                modulosPermitidos: rSeed.modulosPermitidos
            });
        }

        mapaRolesId[rSeed.nombre] = rolEncontrado.id;
    }

    for (const uSeed of USUARIOS_SEMILLA) {
        const roleIdReal = mapaRolesId[uSeed.rolClave];
        if (!roleIdReal) continue;

        const existente = await Usuario.findOne({ where: { usuario: uSeed.usuario } });
        if (existente) {
            await existente.update({
                nombre: uSeed.nombre,
                password: uSeed.passwordHash,
                roleId: roleIdReal
            });
        } else {
            await Usuario.create({
                nombre: uSeed.nombre,
                usuario: uSeed.usuario,
                password: uSeed.passwordHash,
                roleId: roleIdReal
            });
        }
    }
};

const inicializarDatosBase = async () => {
    try {
        await sequelize.sync({ alter: true });
        await sincronizarRolesYUsuarios();

        const numRecetas = await Receta.count();
        if (numRecetas < 16) {
            await ejecutarSeed();
        }

        const itemsInv = await Inventario.findAll();
        for (const item of itemsInv) {
            if (!item.loteActual || !item.fechaVencimiento) {
                await item.update({
                    loteActual: item.loteActual || `LOTE-${item.tipo || 'INV'}-2610`,
                    fechaVencimiento: item.fechaVencimiento || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
                    unidadMedida: item.unidadMedida || (item.tipo === 'MP' ? 'kg' : 'uds'),
                    estadoCalidad: item.estadoCalidad || 'Liberado'
                });
            }
        }
    } catch (error) {
        console.error('Aviso de sincronización inicial:', error.message);
    }
};

const PORT = config.server.port;

inicializarDatosBase().finally(() => {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
        console.log(`Base de datos: ${config.database.name} (PostgreSQL)`);
    });
});
