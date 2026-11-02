const { Compra, Proveedor, Inventario, MovimientoInventario, LoteInventario, Fabricacion } = require('../models');

const liberarReservaOFAlRecibirOC = async (compra, itemRecibido) => {
    const ordenesCandidatas = [];

    if (compra.ofOrigen) {
        const ofDirecta = await Fabricacion.findOne({ where: { numeroOF: compra.ofOrigen } });
        if (ofDirecta) ordenesCandidatas.push(ofDirecta);
    }

    const ofsPendientesMP = await Fabricacion.findAll({
        where: { estado: 'Pendiente MP (OC Sugerida)' }
    });
    for (const ofPend of ofsPendientesMP) {
        if (!ordenesCandidatas.some(o => o.numeroOF === ofPend.numeroOF)) {
            ordenesCandidatas.push(ofPend);
        }
    }

    for (const of of ordenesCandidatas) {
        const whereReserva = {
            referencia: of.numeroOF,
            tipo: 'BLOQUEO'
        };
        if (itemRecibido && !compra.ofOrigen) {
            whereReserva.inventarioId = itemRecibido.id;
        }

        const reservasActivas = await MovimientoInventario.findAll({ where: whereReserva });
        for (const resMov of reservasActivas) {
            const itemInv = await Inventario.findByPk(resMov.inventarioId);
            if (itemInv) {
                const cantRes = parseFloat(resMov.cantidad) || 0;
                const dispActual = parseFloat(itemInv.stockActual) || 0;
                const bloqActual = parseFloat(itemInv.stockBloqueado) || 0;
                const nuevoBloq = Math.max(0, +(bloqActual - cantRes).toFixed(2));
                const nuevoDisp = +(dispActual + cantRes).toFixed(2);

                await itemInv.update({
                    stockActual: nuevoDisp,
                    stockBloqueado: nuevoBloq,
                    estadoCalidad: nuevoBloq > 0 ? 'Reservado OF' : 'Liberado'
                });
            }

            await resMov.update({
                tipo: 'LIBERACION',
                motivo: `Reserva liberada tras recepción de ${compra.numeroOC}`
            });
        }

        const ocsPendientes = await Compra.count({
            where: {
                ofOrigen: of.numeroOF,
                estado: 'Pendiente'
            }
        });

        if (ocsPendientes === 0 && of.estado === 'Pendiente MP (OC Sugerida)') {
            await of.update({ estado: 'Pendiente por Iniciar' });
        }
    }
};

const listar = async (req, res) => {
    try {
        const data = await Compra.findAll({
            include: [{ model: Proveedor, as: 'proveedorDetalle', required: false }],
            order: [['createdAt', 'DESC']]
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar compras' });
    }
};

const listarProveedores = async (req, res) => {
    try {
        const proveedores = await Proveedor.findAll({
            include: [{ model: Compra, as: 'compras', required: false }],
            order: [['razonSocial', 'ASC']]
        });
        res.json(proveedores);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar proveedores' });
    }
};

const crearProveedor = async (req, res) => {
    try {
        const {
            codigoProveedor,
            ruc,
            razonSocial,
            contactoNombre,
            telefono,
            correo,
            direccion,
            categoriaInsumo,
            tiempoEntregaDias,
            calificacion
        } = req.body;

        if (!ruc || !razonSocial || !contactoNombre || !telefono) {
            return res.status(400).json({ msg: 'RUC, razón social, contacto y teléfono son obligatorios' });
        }

        const codigo = codigoProveedor || ('PROV-' + Date.now().toString().slice(-4));
        const nuevo = await Proveedor.create({
            codigoProveedor: codigo,
            ruc,
            razonSocial,
            contactoNombre,
            telefono,
            correo: correo || 'contacto@proveedor.com.ni',
            direccion: direccion || 'Managua, Nicaragua',
            categoriaInsumo: categoriaInsumo || 'Materia Prima General',
            tiempoEntregaDias: parseInt(tiempoEntregaDias, 10) || 3,
            calificacion: parseInt(calificacion, 10) || 5
        });

        res.status(201).json({ msg: 'Proveedor registrado exitosamente', data: nuevo });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ msg: 'El RUC o código de proveedor ya está registrado' });
        }
        res.status(500).json({ msg: 'Error al registrar proveedor' });
    }
};

const crear = async (req, res) => {
    try {
        const {
            numeroOC,
            proveedor,
            proveedorId,
            proveedorRuc,
            proveedorContacto,
            proveedorTelefono,
            total,
            estado,
            producto_codigo,
            cantidad,
            precio_unitario,
            ofOrigen
        } = req.body;

        const fecha = new Date().toISOString().split('T')[0];

        if (!numeroOC || !proveedor || total === undefined) {
            return res.status(400).json({ msg: 'Campos obligatorios incompletos' });
        }

        let provRecord = null;
        if (proveedorId) {
            provRecord = await Proveedor.findByPk(proveedorId);
        } else if (proveedor) {
            provRecord = await Proveedor.findOne({ where: { razonSocial: proveedor } });
        }

        const diasEntrega = provRecord ? (provRecord.tiempoEntregaDias || 3) : 3;
        const fechaEntrega = new Date(Date.now() + diasEntrega * 86400000).toISOString().split('T')[0];

        const estadoInicial = estado || 'Pendiente';
        const nueva = await Compra.create({
            numeroOC,
            proveedor: provRecord ? provRecord.razonSocial : proveedor,
            proveedorId: provRecord ? provRecord.id : null,
            proveedorRuc: proveedorRuc || (provRecord ? provRecord.ruc : null),
            proveedorContacto: proveedorContacto || (provRecord ? provRecord.contactoNombre : null),
            proveedorTelefono: proveedorTelefono || (provRecord ? provRecord.telefono : null),
            fecha,
            fechaEntregaEstimada: fechaEntrega,
            total,
            estado: estadoInicial,
            producto_codigo,
            cantidad,
            precio_unitario,
            ofOrigen: ofOrigen || null
        });

        if (estadoInicial === 'Recibida' && producto_codigo) {
            const item = await Inventario.findOne({ where: { codigo: producto_codigo } });
            if (item) {
                const cantNum = parseFloat(cantidad) || 0;
                const loteMP = 'LOTE-MP-' + Date.now().toString().slice(-5);
                const vencimiento = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
                await item.update({
                    stockActual: +(parseFloat(item.stockActual) + cantNum).toFixed(2),
                    costoUnitario: parseFloat(precio_unitario) || item.costoUnitario,
                    loteActual: loteMP,
                    fechaVencimiento: vencimiento,
                    estadoCalidad: 'Liberado'
                });
                await MovimientoInventario.create({
                    inventarioId: item.id,
                    tipo: 'ENTRADA',
                    cantidad: cantNum,
                    motivo: 'Recepción directa de OC',
                    referencia: numeroOC,
                    lote: loteMP
                });
                await liberarReservaOFAlRecibirOC(nueva, item);
            }
        }

        res.status(201).json({ msg: 'Orden de compra generada', data: nueva });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ msg: 'El número de orden ya existe.' });
        }
        res.status(500).json({ msg: 'Error al crear compra' });
    }
};

const recibirCompra = async (req, res) => {
    try {
        const { numeroOC } = req.params;
        const compra = await Compra.findOne({ where: { numeroOC } });
        if (!compra) {
            return res.status(404).json({ msg: 'Orden de compra no encontrada' });
        }
        if (compra.estado === 'Recibida') {
            return res.status(400).json({ msg: 'Esta orden de compra ya fue recibida en almacén' });
        }

        const item = await Inventario.findOne({ where: { codigo: compra.producto_codigo } });
        const cantNum = parseFloat(compra.cantidad) || 0;
        const loteMP = 'LOTE-MP-' + Date.now().toString().slice(-5);
        const vencimiento = new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0];

        await compra.update({ estado: 'Recibida' });

        if (item && cantNum > 0) {
            await item.update({
                stockActual: +((parseFloat(item.stockActual) || 0) + cantNum).toFixed(2),
                costoUnitario: parseFloat(compra.precio_unitario) || item.costoUnitario,
                loteActual: loteMP,
                fechaVencimiento: vencimiento,
                estadoCalidad: 'Liberado'
            });

            await LoteInventario.create({
                codigoLote: loteMP,
                inventarioId: item.id,
                tipoItem: item.tipo || 'MP',
                cantidadInicial: cantNum,
                cantidadDisponible: cantNum,
                fechaProduccion: new Date().toISOString().split('T')[0],
                fechaVencimiento: vencimiento,
                estadoCalidad: 'Liberado',
                ordenReferencia: compra.numeroOC
            });

            await MovimientoInventario.create({
                inventarioId: item.id,
                tipo: 'ENTRADA',
                cantidad: cantNum,
                motivo: 'Recepción de Orden de Compra en Almacén',
                referencia: compra.numeroOC,
                lote: loteMP
            });

            await liberarReservaOFAlRecibirOC(compra, item);
        }

        res.json({
            msg: compra.ofOrigen
                ? `Mercadería recibida, sumada al inventario disponible y reserva liberada para ${compra.ofOrigen}`
                : 'Mercadería recibida y sumada al inventario disponible',
            data: compra,
            loteGenerado: loteMP
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al recibir orden de compra' });
    }
};

module.exports = { listar, listarProveedores, crearProveedor, crear, recibirCompra, liberarReservaOFAlRecibirOC };
