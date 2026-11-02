const { Inventario, LoteInventario, Fabricacion, MovimientoInventario } = require('../models');

const sincronizarEstadoWIP = async () => {
    const itemsWIP = await Inventario.findAll({ where: { tipo: 'WIP' } });
    if (itemsWIP.length === 0) return;

    const ordenesEnCocina = await Fabricacion.findAll({
        where: {
            estado: ['En Proceso', 'En Retrabajo']
        }
    });

    const kgEnCocina = +ordenesEnCocina.reduce((acc, o) => acc + ((parseFloat(o.cantidad) || 0) * 0.30), 0).toFixed(2);

    for (const wip of itemsWIP) {
        const cambios = {};
        if (wip.producto.includes('Base Concentrada')) {
            cambios.producto = 'Mermelada de Fresa en Cocción (WIP)';
        }
        if (wip.unidadMedida !== 'kg') {
            cambios.unidadMedida = 'kg';
        }
        if (parseFloat(wip.stockMinimo) !== 0) {
            cambios.stockMinimo = 0;
        }

        const estadoValido = kgEnCocina > 0 ? 'En Cocina' : 'En Proceso';
        if (wip.estadoCalidad !== estadoValido) {
            cambios.estadoCalidad = estadoValido;
        }

        if (parseFloat(wip.stockActual) !== kgEnCocina) {
            cambios.stockActual = kgEnCocina;
        }

        if (Object.keys(cambios).length > 0) {
            await wip.update(cambios);
        }
    }
};

const sincronizarReservasMP = async () => {
    try {
        const todasOFs = await Fabricacion.findAll();
        const ofsActivas = new Set(
            todasOFs
                .filter(o => {
                    const est = String(o.estado || '').trim().toLowerCase();
                    if (est.startsWith('terminada') || est.includes('scrap') || est.includes('rechazada') || est.includes('cancelada')) {
                        return false;
                    }
                    return true;
                })
                .map(o => o.numeroOF)
        );

        const bloqueosMP = await MovimientoInventario.findAll({
            where: { tipo: 'BLOQUEO' },
            include: [{ model: Inventario, as: 'inventario' }]
        });

        for (const b of bloqueosMP) {
            if (b.inventario && b.inventario.tipo === 'MP') {
                const esActiva = b.referencia && ofsActivas.has(b.referencia);
                if (!esActiva) {
                    const cant = parseFloat(b.cantidad) || 0;
                    const item = b.inventario;
                    const nuevoDisp = +((parseFloat(item.stockActual) || 0) + cant).toFixed(2);
                    const nuevoBloq = Math.max(0, +((parseFloat(item.stockBloqueado) || 0) - cant).toFixed(2));
                    await item.update({
                        stockActual: nuevoDisp,
                        stockBloqueado: nuevoBloq,
                        estadoCalidad: nuevoBloq > 0 ? 'Reservado OF' : 'Liberado'
                    });
                    await b.update({
                        tipo: 'LIBERACION',
                        motivo: `Reserva liberada automáticamente: ${b.referencia || 'OF'} finalizada o inactiva`
                    });
                }
            }
        }

        if (ofsActivas.size === 0) {
            const itemsMP = await Inventario.findAll({ where: { tipo: 'MP' } });
            for (const mp of itemsMP) {
                const bloq = parseFloat(mp.stockBloqueado) || 0;
                if (bloq > 0 || mp.estadoCalidad === 'Reservado OF') {
                    const nuevoDisp = +((parseFloat(mp.stockActual) || 0) + bloq).toFixed(2);
                    await mp.update({
                        stockActual: nuevoDisp,
                        stockBloqueado: 0,
                        estadoCalidad: 'Liberado'
                    });
                }
            }
        }
    } catch (e) {
        console.error('Error al sincronizar reservas de MP:', e);
    }
};

const listar = async (req, res) => {
    try {
        await sincronizarEstadoWIP();
        await sincronizarReservasMP();

        const data = await Inventario.findAll({
            include: [{ model: LoteInventario, as: 'lotes', required: false }],
            order: [['tipo', 'ASC'], ['codigo', 'ASC']]
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar inventario' });
    }
};

const crear = async (req, res) => {
    try {
        const {
            codigo,
            producto,
            tipo,
            unidadMedida,
            costoUnitario,
            loteActual,
            fechaVencimiento,
            ubicacionAlmacen
        } = req.body;

        const tipoFinal = tipo || 'MP';
        const stockActual = parseFloat(req.body.stockActual) || 0;
        const stockMinimo = tipoFinal === 'WIP' ? 0 : (parseFloat(req.body.stockMinimo) || 10);

        if (!codigo || !producto) {
            return res.status(400).json({ msg: 'Campos obligatorios: codigo, producto' });
        }

        const unidad = tipoFinal === 'WIP' ? 'kg' : (unidadMedida || (tipoFinal === 'MP' ? 'kg' : 'uds'));
        const lote = loteActual || (`LOTE-${tipoFinal}-${Date.now().toString().slice(-5)}`);
        const vencimiento = fechaVencimiento || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
        const estadoCalidadInicial = tipoFinal === 'WIP' ? 'En Proceso' : 'Liberado';

        const nuevo = await Inventario.create({
            codigo,
            producto,
            tipo: tipoFinal,
            unidadMedida: unidad,
            stockActual,
            stockMinimo,
            costoUnitario: parseFloat(costoUnitario) || 0,
            loteActual: lote,
            fechaVencimiento: vencimiento,
            estadoCalidad: estadoCalidadInicial,
            ubicacionAlmacen: ubicacionAlmacen || 'Almacén Central A1'
        });

        if (stockActual > 0 && tipoFinal !== 'WIP') {
            await LoteInventario.create({
                codigoLote: lote,
                inventarioId: nuevo.id,
                tipoItem: tipoFinal,
                cantidadInicial: stockActual,
                cantidadDisponible: stockActual,
                fechaProduccion: new Date().toISOString().split('T')[0],
                fechaVencimiento: vencimiento,
                estadoCalidad: 'Liberado',
                ordenReferencia: 'SALDO-INICIAL'
            });
        }

        res.status(201).json({ msg: 'Item de inventario creado', data: nuevo });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ msg: 'El código de producto ya existe.' });
        }
        res.status(500).json({ msg: 'Error al crear item de inventario' });
    }
};

module.exports = { listar, crear, sincronizarEstadoWIP };
