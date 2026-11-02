const { Op } = require('sequelize');
const { Venta, Cliente, Inventario, Fabricacion, LoteInventario, MovimientoInventario, Compra } = require('../models');
const { verificarYGenerarComprasMP, calcularHuellaCarbono } = require('./fabricacionController');


const descontarLotesPTPorFEFO = async (inventarioId, cantidadRequerida) => {
    const lotesLiberados = await LoteInventario.findAll({
        where: {
            inventarioId,
            estadoCalidad: 'Liberado',
            cantidadDisponible: { [Op.gt]: 0 }
        },
        order: [
            ['fechaVencimiento', 'ASC'],
            ['createdAt', 'ASC']
        ]
    });

    let restante = parseFloat(cantidadRequerida) || 0;
    let lotePrincipalUsado = null;

    for (const lote of lotesLiberados) {
        if (restante <= 0) break;
        const dispLote = parseFloat(lote.cantidadDisponible) || 0;
        if (dispLote <= 0) continue;

        const aTomar = Math.min(dispLote, restante);
        const nuevoDisp = +(dispLote - aTomar).toFixed(2);
        await lote.update({ cantidadDisponible: nuevoDisp });

        if (!lotePrincipalUsado) {
            lotePrincipalUsado = lote.codigoLote;
        }
        restante = +(restante - aTomar).toFixed(2);
    }

    return lotePrincipalUsado;
};


const cerrarOFCubiertaPorStock = async (numeroOF, numeroPedido) => {
    if (!numeroOF) return;
    const of = await Fabricacion.findOne({ where: { numeroOF } });
    if (!of) return;

    if (!String(of.estado || '').startsWith('Terminada')) {
        const reservasActivas = await MovimientoInventario.findAll({
            where: {
                referencia: of.numeroOF,
                tipo: 'BLOQUEO'
            }
        });

        for (const resMov of reservasActivas) {
            const itemMP = await Inventario.findByPk(resMov.inventarioId);
            if (itemMP) {
                const cantRes = parseFloat(resMov.cantidad) || 0;
                const nuevoDisp = +((parseFloat(itemMP.stockActual) || 0) + cantRes).toFixed(2);
                const nuevoBloq = Math.max(0, +((parseFloat(itemMP.stockBloqueado) || 0) - cantRes).toFixed(2));
                await itemMP.update({
                    stockActual: nuevoDisp,
                    stockBloqueado: nuevoBloq,
                    estadoCalidad: nuevoBloq > 0 ? 'Reservado OF' : 'Liberado'
                });
            }
            await resMov.update({
                tipo: 'LIBERACION',
                motivo: `Reserva liberada: Pedido ${numeroPedido} cubierto con Stock PT Liberado`
            });
        }

        await Compra.update(
            { estado: 'Cancelada (Cubierta por Stock PT)' },
            {
                where: {
                    ofOrigen: of.numeroOF,
                    estado: 'Pendiente'
                }
            }
        );

        await of.update({
            estado: 'Terminada (Cubierta por Stock PT)'
        });
    }
};


const asignarStockLiberadoAPedidosPendientes = async () => {
    try {
        const pedidosPendientes = await Venta.findAll({
            where: {
                estado: {
                    [Op.in]: ['En Producción (Sin Stock)', 'Pendiente']
                }
            },
            order: [
                ['fecha', 'ASC'],
                ['createdAt', 'ASC'],
                ['id', 'ASC']
            ]
        });

        if (pedidosPendientes.length === 0) return [];

        const pedidosAsignados = [];

        for (const pedido of pedidosPendientes) {
            let itemPT = null;
            if (pedido.producto_codigo) {
                itemPT = await Inventario.findOne({ where: { codigo: pedido.producto_codigo } });
            }
            if (!itemPT) {
                itemPT = await Inventario.findOne({ where: { tipo: 'PT' } });
            }
            if (!itemPT) continue;

            const estadoCal = String(itemPT.estadoCalidad || 'Liberado');
            const estaLiberado = estadoCal.startsWith('Liberado');
            const stockDisponible = parseFloat(itemPT.stockActual) || 0;
            const cantSolicitada = parseFloat(pedido.cantidad) || 0;

            if (estaLiberado && cantSolicitada > 0 && stockDisponible >= cantSolicitada) {
                const loteFEFO = await descontarLotesPTPorFEFO(itemPT.id, cantSolicitada);
                const nuevoStockPT = +(stockDisponible - cantSolicitada).toFixed(2);

                await itemPT.update({
                    stockActual: nuevoStockPT
                });

                await MovimientoInventario.create({
                    inventarioId: itemPT.id,
                    tipo: 'SALIDA',
                    cantidad: cantSolicitada,
                    motivo: 'Asignación automática FEFO de Stock PT Liberado a Pedido',
                    referencia: pedido.numeroPedido,
                    lote: loteFEFO || itemPT.loteActual || 'LOTE-PT-FEFO'
                });

                if (pedido.ofGenerada) {
                    await cerrarOFCubiertaPorStock(pedido.ofGenerada, pedido.numeroPedido);
                }

                await pedido.update({
                    estado: 'Confirmado'
                });

                pedidosAsignados.push(pedido.numeroPedido);
            }
        }

        return pedidosAsignados;
    } catch (error) {
        console.error('Error en asignación automática FEFO:', error.message);
        return [];
    }
};

const listar = async (req, res) => {
    try {
        await asignarStockLiberadoAPedidosPendientes();

        const data = await Venta.findAll({
            include: [{ model: Cliente, as: 'clienteDetalle', required: false }],
            order: [['createdAt', 'DESC']]
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar ventas' });
    }
};

const listarClientes = async (req, res) => {
    try {
        await asignarStockLiberadoAPedidosPendientes();

        const clientes = await Cliente.findAll({
            include: [{ model: Venta, as: 'ventas', required: false }],
            order: [['nombre', 'ASC']]
        });
        const todosPedidos = await Venta.findAll({ order: [['createdAt', 'DESC']] });

        const resultado = clientes.map(c => {
            const json = c.toJSON();
            const historial = todosPedidos.filter(v =>
                v.clienteId === c.id ||
                (v.cliente && v.cliente.toLowerCase() === c.nombre.toLowerCase()) ||
                (v.rucDni && v.rucDni === c.rucDni)
            );
            const totalComprado = historial.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
            return {
                ...json,
                historialCompras: historial,
                totalComprado: +totalComprado.toFixed(2),
                cantidadPedidos: historial.length
            };
        });

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar clientes' });
    }
};

const crearCliente = async (req, res) => {
    try {
        const {
            codigoCliente,
            codigo_cliente,
            rucDni,
            ruc,
            ruc_dni,
            nombre,
            tipoCliente,
            tipo_cliente,
            direccion,
            telefono,
            correo,
            limiteCredito,
            limite_credito
        } = req.body;

        const rucFinal = rucDni || ruc || ruc_dni;
        const tipoFinal = tipoCliente || tipo_cliente || 'Mayorista';
        const creditoFinal = parseFloat(limiteCredito ?? limite_credito) || 50000.00;

        if (!rucFinal || !nombre || !direccion || !telefono) {
            return res.status(400).json({ msg: 'RUC/DNI, nombre, dirección y teléfono son obligatorios' });
        }

        const codigo = codigoCliente || codigo_cliente || ('CLI-' + Date.now().toString().slice(-4));
        const nuevo = await Cliente.create({
            codigoCliente: codigo,
            rucDni: rucFinal,
            nombre,
            tipoCliente: tipoFinal,
            direccion,
            telefono,
            correo: correo || 'compras@cliente.com.ni',
            limiteCredito: creditoFinal
        });

        res.status(201).json({ msg: 'Cliente registrado correctamente', data: nuevo });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ msg: 'El RUC/DNI o código de cliente ya existe en el sistema' });
        }
        res.status(500).json({ msg: 'Error al registrar cliente' });
    }
};

const crear = async (req, res) => {
    try {
        const {
            numeroPedido,
            cliente,
            clienteId,
            rucDni,
            direccionEntrega,
            telefonoCliente,
            correoCliente,
            total,
            producto_codigo,
            cantidad,
            precio_unitario
        } = req.body;

        const fecha = new Date().toISOString().split('T')[0];

        if (!numeroPedido || !cliente || total === undefined) {
            return res.status(400).json({ msg: 'Campos obligatorios incompletos' });
        }

        let clienteReg = null;
        if (clienteId) {
            clienteReg = await Cliente.findByPk(clienteId);
        } else if (rucDni) {
            clienteReg = await Cliente.findOne({ where: { rucDni } });
        } else if (cliente) {
            clienteReg = await Cliente.findOne({ where: { nombre: cliente } });
        }

        if (!clienteReg && rucDni) {
            clienteReg = await Cliente.create({
                codigoCliente: 'CLI-' + Date.now().toString().slice(-4),
                rucDni,
                nombre,
                tipoCliente: 'Comercial',
                direccion: direccionEntrega || 'Managua, Nicaragua',
                telefono: telefonoCliente || '+505 8800-0000',
                correo: correoCliente || 'contacto@cliente.ni'
            });
        }

        let producto = null;
        if (producto_codigo) {
            producto = await Inventario.findOne({ where: { codigo: producto_codigo, tipo: 'PT' } });
        }
        if (!producto) {
            producto = await Inventario.findOne({ where: { tipo: 'PT' } });
        }

        let estadoFinal = 'Confirmado';
        let ordenFabricacionCreada = null;
        let ordenesCompraSugeridas = [];
        let desgloseMateriales = [];
        let numeroOFGenerada = null;

        if (producto) {
            const stockActual = parseFloat(producto.stockActual) || 0;
            const cantSolicitada = parseFloat(cantidad) || 1;
            const estadoCalPT = String(producto.estadoCalidad || 'Liberado');
            const ptEstaLiberado = estadoCalPT.startsWith('Liberado');

            if (ptEstaLiberado && stockActual >= cantSolicitada) {
                const loteFEFO = await descontarLotesPTPorFEFO(producto.id, cantSolicitada);
                const nuevoStock = +(stockActual - cantSolicitada).toFixed(2);
                await producto.update({ stockActual: nuevoStock });

                await MovimientoInventario.create({
                    inventarioId: producto.id,
                    tipo: 'SALIDA',
                    cantidad: cantSolicitada,
                    motivo: 'Asignación directa FEFO de PT Liberado a Pedido de Venta',
                    referencia: numeroPedido,
                    lote: loteFEFO || producto.loteActual || 'LOTE-PT-DISP'
                });

                estadoFinal = 'Confirmado';
                numeroOFGenerada = null;
            } else {
                const stockUtilizable = ptEstaLiberado ? stockActual : 0;
                const cantidadFaltante = Math.ceil(cantSolicitada - stockUtilizable);
                numeroOFGenerada = 'OF-AUTO-' + Date.now().toString().slice(-6);
                const loteAsignado = 'LOTE-PT-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
                const vencimiento = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

                const resultadoMRP = await verificarYGenerarComprasMP(cantidadFaltante, numeroOFGenerada);
                ordenesCompraSugeridas = resultadoMRP.ordenesCompraCreadas;
                desgloseMateriales = resultadoMRP.desgloseMateriales;

                estadoFinal = 'En Producción (Sin Stock)';
                const estadoOF = ordenesCompraSugeridas.length > 0
                    ? 'Pendiente MP (OC Sugerida)'
                    : 'Pendiente por Iniciar';

                ordenFabricacionCreada = await Fabricacion.create({
                    numeroOF: numeroOFGenerada,
                    producto: producto.producto,
                    productoCodigo: producto.codigo,
                    cantidad: cantidadFaltante,
                    loteAsignado,
                    estado: estadoOF,
                    temperaturaPromedio: 92.0,
                    tiempoCoccionMin: 48,
                    brixAlcanzado: 66.0,
                    huellaCarbonoKg: calcularHuellaCarbono(cantidadFaltante, 92.0, 48),
                    pedidoOrigen: numeroPedido,
                    fechaVencimientoLote: vencimiento
                });

                await LoteInventario.findOrCreate({
                    where: { codigoLote: loteAsignado },
                    defaults: {
                        codigoLote: loteAsignado,
                        inventarioId: producto.id,
                        tipoItem: 'PT',
                        cantidadInicial: cantidadFaltante,
                        cantidadDisponible: 0,
                        fechaProduccion: fecha,
                        fechaVencimiento: vencimiento,
                        estadoCalidad: 'Cuarentena',
                        ordenReferencia: numeroOFGenerada
                    }
                });
            }
        }

        const nueva = await Venta.create({
            numeroPedido,
            cliente: clienteReg ? clienteReg.nombre : cliente,
            clienteId: clienteReg ? clienteReg.id : null,
            rucDni: rucDni || (clienteReg ? clienteReg.rucDni : null),
            direccionEntrega: direccionEntrega || (clienteReg ? clienteReg.direccion : null),
            telefonoCliente: telefonoCliente || (clienteReg ? clienteReg.telefono : null),
            correoCliente: correoCliente || (clienteReg ? clienteReg.correo : null),
            fecha,
            total,
            estado: estadoFinal,
            producto_codigo: producto ? producto.codigo : producto_codigo,
            cantidad,
            precio_unitario,
            ofGenerada: numeroOFGenerada
        });

        let mensajeAlerta = null;
        if (ordenFabricacionCreada) {
            mensajeAlerta = `Stock insuficiente de PT Liberado. Se disparó automáticamente la Orden de Fabricación ${numeroOFGenerada} por ${ordenFabricacionCreada.cantidad} frascos (Lote ${ordenFabricacionCreada.loteAsignado}). Cuando Calidad libere stock de PT, el pedido se asignará y confirmará automáticamente por FEFO.`;
            if (ordenesCompraSugeridas.length > 0) {
                const codigosOC = ordenesCompraSugeridas.map(oc => `${oc.numeroOC} (${oc.producto_codigo}: ${oc.cantidad})`).join(', ');
                mensajeAlerta += ` Además, por falta de materia prima en BOM se generaron automáticamente ${ordenesCompraSugeridas.length} Orden(es) de Compra: ${codigosOC}.`;
            }
        }

        res.status(201).json({
            msg: ordenFabricacionCreada
                ? 'Pedido registrado en espera de producción (MRP activado)'
                : 'Pedido confirmado con stock PT Liberado (Asignación FEFO inmediata, sin generar OF)',
            data: nueva,
            alerta: mensajeAlerta,
            ordenFabricacion: ordenFabricacionCreada,
            ordenesCompraSugeridas,
            desgloseMateriales
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ msg: 'El número de pedido ya existe.' });
        }
        res.status(500).json({ msg: 'Error al crear venta' });
    }
};

const despachar = async (req, res) => {
    try {
        const { numeroPedido } = req.params;
        const venta = await Venta.findOne({ where: { numeroPedido } });

        if (!venta) {
            return res.status(404).json({ msg: 'Pedido no encontrado' });
        }

        await venta.update({ estado: 'Despachado / Facturado' });
        res.json({ msg: 'Pedido despachado con éxito', data: venta });
    } catch (error) {
        res.status(500).json({ msg: 'Error al despachar pedido' });
    }
};

module.exports = {
    listar,
    listarClientes,
    crearCliente,
    crear,
    despachar,
    asignarStockLiberadoAPedidosPendientes
};
