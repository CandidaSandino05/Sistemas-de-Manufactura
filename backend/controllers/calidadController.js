const { Calidad, Fabricacion, Inventario, LoteInventario, MovimientoInventario } = require('../models');
const { Op } = require('sequelize');
const { asignarStockLiberadoAPedidosPendientes } = require('./ventaController');
const { liberarReservasDeOF } = require('./fabricacionController');

const DISPOSICION_META = {
    Liberado: {
        accionFisica: 'Traslado físico a Almacén de Producto Terminado (Zona Verde) apto para despacho comercial inmediato.',
        impactoInventario: 'Descuenta Producto en Proceso (WIP), incrementa stock disponible en Producto Terminado (PT) y cierra la Orden de Fabricación.'
    },
    Cuarentena: {
        accionFisica: 'Aislamiento físico en Zona Amarilla de Retención para contramuestra microbiológica y verificación de vacío.',
        impactoInventario: 'Stock retenido en cuenta de bloqueo (Stock en Cuarentena). Bloqueado para ventas y despacho.'
    },
    Retrabajo: {
        accionFisica: 'Retorno del lote a línea de cocción/marmita para corrección de grados Brix, consistencia o re-envasado térmico.',
        impactoInventario: 'No suma a Producto Terminado. El lote permanece en WIP y la Orden de Fabricación pasa a estado En Retrabajo.'
    },
    Scrap: {
        accionFisica: 'Destrucción sanitaria controlada y disposición en contenedor de merma orgánica/vidrio según protocolo.',
        impactoInventario: 'Baja definitiva de las unidades rechazadas y contabilización en el indicador de Scrap.'
    }
};

const listar = async (req, res) => {
    try {
        const data = await Calidad.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']] });
        const ordenes = await Fabricacion.findAll();

        const conteoPorLote = {};
        const cronologico = [...data].reverse();
        const mapaNumeroCiclo = {};

        for (const item of cronologico) {
            const clave = String(item.lote || '').trim().toUpperCase();
            conteoPorLote[clave] = (conteoPorLote[clave] || 0) + 1;
            mapaNumeroCiclo[item.id] = conteoPorLote[clave];
        }

        const resultado = data.map(item => {
            const json = item.toJSON();
            const clave = String(item.lote || '').trim().toUpperCase();
            const ordenVinculada = ordenes.find(o =>
                String(o.numeroOF || '').trim().toUpperCase() === clave ||
                String(o.loteAsignado || '').trim().toUpperCase() === clave
            );
            const esRetrabajoFinalizado = ordenVinculada && (ordenVinculada.estado === 'Pendiente de Calidad (Retrabajo)' || ordenVinculada.estado === 'Pendiente de Calidad');
            const etiquetaCiclo = (item.disposicion === 'Retrabajo' && esRetrabajoFinalizado)
                ? '2da Inspección (Post-Retrabajo)'
                : (mapaNumeroCiclo[item.id] > 1 ? `${mapaNumeroCiclo[item.id]}ª Insp. (Post-Retrabajo)` : null);

            return {
                ...json,
                numeroInspeccion: mapaNumeroCiclo[item.id] || 1,
                totalInspeccionesLote: conteoPorLote[clave] || 1,
                estadoActualOF: ordenVinculada ? ordenVinculada.estado : null,
                loteAsignadoOF: ordenVinculada ? ordenVinculada.loteAsignado : null,
                cantidadOF: ordenVinculada ? ordenVinculada.cantidad : null,
                etiquetaCiclo
            };
        });

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar inspecciones' });
    }
};

const crear = async (req, res) => {
    try {
        const {
            lote,
            inspector,
            sellado,
            color,
            consistencia,
            brixGrados,
            phNivel,
            disposicion,
            cantidadRechazada,
            observaciones
        } = req.body;

        if (!lote || !inspector || !disposicion) {
            return res.status(400).json({ msg: 'Lote, inspector y disposición final son obligatorios' });
        }

        const orden = await Fabricacion.findOne({
            where: {
                [Op.or]: [
                    { numeroOF: lote },
                    { loteAsignado: lote }
                ]
            }
        });

        const clavesBusqueda = [lote];
        if (orden && orden.numeroOF) clavesBusqueda.push(orden.numeroOF);
        if (orden && orden.loteAsignado) clavesBusqueda.push(orden.loteAsignado);

        const inspeccionesPrevias = await Calidad.findAll({
            where: {
                lote: { [Op.in]: clavesBusqueda }
            },
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });

        const ultimaInspeccion = inspeccionesPrevias.length > 0 ? inspeccionesPrevias[0] : null;

        if (ultimaInspeccion) {
            if (ultimaInspeccion.disposicion !== 'Retrabajo') {
                return res.status(400).json({
                    msg: `El lote / orden ${lote} ya cuenta con disposición definitiva (${ultimaInspeccion.disposicion}). Solo se permite reinspeccionar lotes que provienen de un ciclo de Retrabajo.`
                });
            }

            if (orden && orden.estado === 'En Retrabajo') {
                return res.status(400).json({
                    msg: `El lote ${lote} aún se encuentra "En Retrabajo" en Planta. Producción debe hacer clic en "Finalizar Retrabajo" para enviarlo de nuevo a Calidad.`
                });
            }
        }

        const numeroCiclo = inspeccionesPrevias.length + 1;
        const esReinspeccion = numeroCiclo > 1;

        let itemPT = null;
        if (orden && orden.productoCodigo) {
            itemPT = await Inventario.findOne({ where: { codigo: orden.productoCodigo } });
        }
        if (!itemPT) {
            itemPT = await Inventario.findOne({ where: { tipo: 'PT' } });
        }

        const itemWIP = await Inventario.findOne({ where: { tipo: 'WIP' } });

        const cantidadOrden = orden ? (parseInt(orden.cantidad, 10) || 0) : 0;
        const rechazadaInput = Math.max(0, parseInt(cantidadRechazada, 10) || 0);

        let cantidadMerma = 0;
        let cantidadAprobada = 0;

        if (disposicion === 'Liberado') {
            cantidadMerma = cantidadOrden > 0 ? Math.min(cantidadOrden, rechazadaInput) : rechazadaInput;
            cantidadAprobada = Math.max(0, cantidadOrden - cantidadMerma);
        } else {
            if (rechazadaInput > 0 && cantidadOrden > 0 && rechazadaInput < cantidadOrden) {
                cantidadMerma = rechazadaInput;
                cantidadAprobada = cantidadOrden - cantidadMerma;
            } else {
                cantidadMerma = cantidadOrden > 0 ? cantidadOrden : rechazadaInput;
                cantidadAprobada = 0;
            }
        }

        const hayLotSplitting = cantidadAprobada > 0 && cantidadMerma > 0;
        const metaBase = DISPOSICION_META[disposicion] || DISPOSICION_META.Cuarentena;
        const prefijoCiclo = esReinspeccion ? `[Reinspección #${numeroCiclo} Post-Retrabajo] ` : '';

        const destinoMermaTexto = disposicion === 'Liberado' ? 'Scrap' : disposicion;
        const accionFisicaFinal = prefijoCiclo + (hayLotSplitting
            ? `Lot Splitting (División de Lote): ${cantidadAprobada} uds aprobadas van a Almacén PT y ${cantidadMerma} uds van a ${destinoMermaTexto}.`
            : metaBase.accionFisica);

        const impactoInventarioFinal = hayLotSplitting
            ? `Stock dividido: +${cantidadAprobada} uds sumadas a Producto Terminado (PT) | ${cantidadMerma} uds registradas en ${destinoMermaTexto}.`
            : metaBase.impactoInventario;

        const nueva = await Calidad.create({
            lote: orden ? orden.numeroOF : lote,
            inspector,
            sellado: sellado || 'OK',
            color: color || 'OK',
            consistencia: consistencia || 'OK',
            brixGrados: parseFloat(brixGrados) || 66.0,
            phNivel: parseFloat(phNivel) || 3.25,
            disposicion,
            cantidadRechazada: cantidadMerma,
            accionFisica: accionFisicaFinal,
            impactoInventario: impactoInventarioFinal,
            observaciones: observaciones || (esReinspeccion
                ? `Reinspección #${numeroCiclo} tras Retrabajo (${disposicion})`
                : (hayLotSplitting ? `Lot Splitting: ${cantidadAprobada} PT / ${cantidadMerma} ${destinoMermaTexto}` : null))
        });

        const codigoLoteRef = orden && orden.loteAsignado ? orden.loteAsignado : lote;

        if (itemWIP) {
            if (disposicion === 'Retrabajo') {
                const kgRetrabajo = +(cantidadMerma * 0.30).toFixed(2);
                await itemWIP.update({
                    stockActual: kgRetrabajo,
                    unidadMedida: 'kg',
                    loteActual: codigoLoteRef,
                    estadoCalidad: 'En Cocina'
                });
            } else {
                await itemWIP.update({
                    stockActual: 0,
                    unidadMedida: 'kg',
                    estadoCalidad: 'En Proceso'
                });
            }
        }

        if (itemPT && cantidadOrden > 0) {
            const bloqPrevio = parseFloat(itemPT.stockBloqueado) || 0;
            if (bloqPrevio > 0) {
                await itemPT.update({
                    stockBloqueado: Math.max(0, +(bloqPrevio - cantidadOrden).toFixed(2))
                });
            }
        }

        if (itemPT && cantidadAprobada > 0) {
            const nuevoStock = +((parseFloat(itemPT.stockActual) || 0) + cantidadAprobada).toFixed(2);
            await itemPT.update({
                stockActual: nuevoStock,
                estadoCalidad: hayLotSplitting ? `Liberado Parcial (${disposicion})` : 'Liberado',
                loteActual: codigoLoteRef
            });
            await MovimientoInventario.create({
                inventarioId: itemPT.id,
                tipo: 'ENTRADA',
                cantidad: cantidadAprobada,
                motivo: esReinspeccion
                    ? `Liberación a PT tras Reinspección #${numeroCiclo} (Post-Retrabajo)`
                    : (hayLotSplitting ? 'Lot Splitting: Fracción Aprobada a PT' : 'Liberación de Calidad a PT'),
                referencia: orden ? orden.numeroOF : lote,
                lote: codigoLoteRef
            });
        }

        if (itemPT && cantidadMerma > 0) {
            if (disposicion === 'Cuarentena') {
                const nuevoBloqueo = +((parseFloat(itemPT.stockBloqueado) || 0) + cantidadMerma).toFixed(2);
                await itemPT.update({
                    stockBloqueado: nuevoBloqueo,
                    estadoCalidad: hayLotSplitting ? 'Liberado Parcial / Cuarentena' : 'Cuarentena'
                });
                await MovimientoInventario.create({
                    inventarioId: itemPT.id,
                    tipo: 'BLOQUEO',
                    cantidad: cantidadMerma,
                    motivo: hayLotSplitting ? 'Lot Splitting: Fracción Retenida en Cuarentena' : 'Retención en Cuarentena por Calidad',
                    referencia: orden ? orden.numeroOF : lote,
                    lote: codigoLoteRef
                });
            } else if (disposicion === 'Retrabajo') {
                await MovimientoInventario.create({
                    inventarioId: itemWIP ? itemWIP.id : itemPT.id,
                    tipo: 'BLOQUEO',
                    cantidad: cantidadMerma,
                    motivo: hayLotSplitting ? 'Lot Splitting: Fracción enviada a Retrabajo en Planta' : 'Lote enviado a Retrabajo en Planta',
                    referencia: orden ? orden.numeroOF : lote,
                    lote: codigoLoteRef
                });
            } else if (disposicion === 'Scrap' || disposicion === 'Liberado') {
                await MovimientoInventario.create({
                    inventarioId: itemPT.id,
                    tipo: 'SCRAP',
                    cantidad: cantidadMerma,
                    motivo: hayLotSplitting ? 'Lot Splitting: Fracción Desechada (Scrap)' : 'Baja por Scrap en Control de Calidad',
                    referencia: orden ? orden.numeroOF : lote,
                    lote: codigoLoteRef
                });
            }
        }

        if (orden) {
            let nuevoEstadoOF = 'Terminada';
            const updatePayload = {};

            if (disposicion === 'Retrabajo') {
                nuevoEstadoOF = 'En Retrabajo';
                if (hayLotSplitting && cantidadMerma > 0) {
                    updatePayload.cantidad = cantidadMerma;
                }
            } else if (hayLotSplitting) {
                nuevoEstadoOF = `Terminada (${cantidadAprobada} PT / ${cantidadMerma} ${destinoMermaTexto})`;
            } else if (disposicion === 'Cuarentena') {
                nuevoEstadoOF = 'En Cuarentena';
            } else if (disposicion === 'Scrap') {
                nuevoEstadoOF = 'Rechazada (Scrap)';
            }

            updatePayload.estado = nuevoEstadoOF;
            await orden.update(updatePayload);

            if (nuevoEstadoOF.startsWith('Terminada') || nuevoEstadoOF.includes('Scrap') || disposicion === 'Liberado' || disposicion === 'Scrap') {
                await liberarReservasDeOF(orden.numeroOF, `Dictamen de Calidad: ${disposicion} (${nuevoEstadoOF})`);
            }
        }

        const loteReg = await LoteInventario.findOne({ where: { codigoLote: codigoLoteRef } });
        if (loteReg) {
            await loteReg.update({
                estadoCalidad: cantidadAprobada > 0 ? 'Liberado' : disposicion,
                cantidadDisponible: disposicion === 'Retrabajo' ? 0 : (parseFloat(loteReg.cantidadDisponible || 0) + cantidadAprobada)
            });
        } else if (itemPT && cantidadAprobada > 0) {
            await LoteInventario.create({
                codigoLote: codigoLoteRef,
                inventarioId: itemPT.id,
                tipoItem: 'PT',
                cantidadInicial: cantidadOrden || cantidadAprobada,
                cantidadDisponible: cantidadAprobada,
                fechaProduccion: new Date().toISOString().split('T')[0],
                fechaVencimiento: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
                estadoCalidad: 'Liberado',
                ordenReferencia: orden ? orden.numeroOF : lote
            });
        }

        let pedidosAsignadosAuto = [];
        if (cantidadAprobada > 0) {
            pedidosAsignadosAuto = await asignarStockLiberadoAPedidosPendientes();
        }

        const msgPedidosAuto = pedidosAsignadosAuto.length > 0
            ? ` | Asignación FEFO automática: Pedido(s) ${pedidosAsignadosAuto.join(', ')} actualizado(s) a "Confirmado".`
            : '';

        res.status(201).json({
            msg: (disposicion === 'Retrabajo'
                ? `Lote enviado a Planta con estado "En Retrabajo" (${cantidadMerma} uds para corrección)`
                : (hayLotSplitting
                    ? `Inspección aplicada con Lot Splitting: ${cantidadAprobada} uds a PT y ${cantidadMerma} uds a ${destinoMermaTexto}`
                    : `Inspección #${numeroCiclo} registrada y aplicada al inventario`)) + msgPedidosAuto,
            data: nueva,
            pedidosConfirmadosFEFO: pedidosAsignadosAuto,
            lotSplitting: {
                totalLote: cantidadOrden,
                aprobadasPT: cantidadAprobada,
                afectadas: cantidadMerma,
                destinoAfectadas: destinoMermaTexto
            }
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al crear inspección de calidad' });
    }
};

const listarCuarentena = async (req, res) => {
    try {
        const lotesInv = await LoteInventario.findAll({
            where: { estadoCalidad: 'Cuarentena' },
            include: [{ model: Inventario, as: 'inventario' }],
            order: [['updatedAt', 'DESC']]
        });

        const ordenesCuarentena = await Fabricacion.findAll({
            where: {
                estado: {
                    [Op.like]: '%Cuarentena%'
                }
            },
            order: [['updatedAt', 'DESC']]
        });

        const calidadesCuarentena = await Calidad.findAll({
            where: { disposicion: 'Cuarentena' },
            order: [['createdAt', 'DESC']]
        });

        const inventariosBloqueados = await Inventario.findAll({
            where: {
                tipo: 'PT',
                stockBloqueado: { [Op.gt]: 0 }
            }
        });

        const mapaLotes = new Map();

        for (const l of lotesInv) {
            const cant = parseFloat(l.cantidadDisponible || l.cantidadInicial || 0);
            if (cant <= 0) continue;
            const clave = l.codigoLote;
            const ofMatch = ordenesCuarentena.find(o => o.loteAsignado === clave || o.numeroOF === clave);
            const calMatch = calidadesCuarentena.find(c => c.lote === clave || (ofMatch && c.lote === ofMatch.numeroOF));
            mapaLotes.set(clave, {
                lote: clave,
                ordenReferencia: l.ordenReferencia || (ofMatch ? ofMatch.numeroOF : clave),
                producto: l.inventario ? l.inventario.producto : (ofMatch ? ofMatch.producto : 'Producto Terminado'),
                productoCodigo: l.inventario ? l.inventario.codigo : (ofMatch ? ofMatch.productoCodigo : 'PT-MER-300'),
                cantidad: cant,
                ubicacion: l.inventario ? l.inventario.ubicacionAlmacen : 'Zona Amarilla de Retención',
                motivo: calMatch ? (calMatch.observaciones || calMatch.accionFisica) : 'Retención preventiva en cuarentena',
                fecha: l.createdAt,
                idLote: l.id
            });
        }

        for (const o of ordenesCuarentena) {
            const est = String(o.estado || '').toLowerCase();
            if (est.startsWith('terminada') || est.includes('cancel')) continue;

            const clave = o.loteAsignado || o.numeroOF;
            if (!mapaLotes.has(clave)) {
                const calMatch = calidadesCuarentena.find(c => c.lote === o.numeroOF || c.lote === o.loteAsignado);
                mapaLotes.set(clave, {
                    lote: clave,
                    ordenReferencia: o.numeroOF,
                    producto: o.producto,
                    productoCodigo: o.productoCodigo,
                    cantidad: parseFloat(o.cantidad),
                    ubicacion: 'Zona Amarilla de Retención',
                    motivo: calMatch ? (calMatch.observaciones || calMatch.accionFisica) : 'No conformidad en proceso de fabricación',
                    fecha: o.updatedAt,
                    idLote: null
                });
            }
        }

        for (const inv of inventariosBloqueados) {
            const clave = inv.loteActual || `LOTE-${inv.codigo}`;
            if (!mapaLotes.has(clave) && parseFloat(inv.stockBloqueado) > 0) {
                mapaLotes.set(clave, {
                    lote: clave,
                    ordenReferencia: clave,
                    producto: inv.producto,
                    productoCodigo: inv.codigo,
                    cantidad: parseFloat(inv.stockBloqueado),
                    ubicacion: inv.ubicacionAlmacen || 'Zona Amarilla de Retención',
                    motivo: 'Stock bloqueado en cuarentena para inspección',
                    fecha: inv.updatedAt,
                    idLote: null
                });
            }
        }

        // 4. Lotes cuya última inspección registrada en Calidad sea Cuarentena y sigan activos
        const todasInspecciones = await Calidad.findAll({
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        const ultimasPorLote = new Map();
        for (const insp of todasInspecciones) {
            const cClave = String(insp.lote || '').trim().toUpperCase();
            if (!ultimasPorLote.has(cClave)) {
                ultimasPorLote.set(cClave, insp);
            }
        }

        for (const [cClave, insp] of ultimasPorLote.entries()) {
            if (insp.disposicion === 'Cuarentena') {
                const ordenVinculada = await Fabricacion.findOne({
                    where: {
                        [Op.or]: [
                            { numeroOF: insp.lote },
                            { loteAsignado: insp.lote }
                        ]
                    }
                });
                const estadoOF = ordenVinculada ? String(ordenVinculada.estado || '').toLowerCase() : '';
                const estaCerrada = estadoOF.startsWith('terminada') || estadoOF.includes('cancel');

                if (!estaCerrada) {
                    const loteCodigo = ordenVinculada?.loteAsignado || insp.lote;
                    if (!mapaLotes.has(loteCodigo) && !mapaLotes.has(insp.lote)) {
                        mapaLotes.set(loteCodigo, {
                            lote: loteCodigo,
                            ordenReferencia: ordenVinculada ? ordenVinculada.numeroOF : insp.lote,
                            producto: ordenVinculada ? ordenVinculada.producto : 'Mermelada de Fresa Artesanal (Frasco 300g)',
                            productoCodigo: ordenVinculada ? ordenVinculada.productoCodigo : 'PT-MER-300',
                            cantidad: parseFloat(insp.cantidadRechazada || ordenVinculada?.cantidad || 0),
                            ubicacion: 'Zona Amarilla de Retención',
                            motivo: insp.observaciones || insp.accionFisica || 'Retención preventiva en cuarentena',
                            fecha: insp.createdAt,
                            idLote: null
                        });
                    }
                }
            }
        }

        res.json(Array.from(mapaLotes.values()));
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar lotes en cuarentena' });
    }
};

const gestionarCuarentena = async (req, res) => {
    try {
        const { lote, accion, observaciones, inspector } = req.body;
        if (!lote || !accion) {
            return res.status(400).json({ msg: 'Lote y acción son obligatorios' });
        }

        if (accion === 'MANTENER') {
            return res.json({ ok: true, msg: 'Lote mantenido en Cuarentena sin cambios de inventario.' });
        }

        const orden = await Fabricacion.findOne({
            where: {
                [Op.or]: [
                    { numeroOF: lote },
                    { loteAsignado: lote }
                ]
            }
        });

        let loteReg = await LoteInventario.findOne({ where: { codigoLote: lote } });
        if (!loteReg && orden && orden.loteAsignado) {
            loteReg = await LoteInventario.findOne({ where: { codigoLote: orden.loteAsignado } });
        }

        let itemPT = null;
        if (orden && orden.productoCodigo) {
            itemPT = await Inventario.findOne({ where: { codigo: orden.productoCodigo, tipo: 'PT' } });
        }
        if (!itemPT && loteReg) {
            itemPT = await Inventario.findByPk(loteReg.inventarioId);
        }
        if (!itemPT) {
            itemPT = await Inventario.findOne({ where: { tipo: 'PT' } });
        }

        const cantidad = orden ? parseInt(orden.cantidad, 10) : (loteReg ? parseInt(loteReg.cantidadInicial, 10) : (parseFloat(itemPT?.stockBloqueado) || 0));
        const nombreInspector = inspector || (req.user ? req.user.nombre : 'Control de Calidad');

        if (accion === 'LIBERAR') {
            if (itemPT) {
                const nuevoBloqueado = Math.max(0, +(parseFloat(itemPT.stockBloqueado || 0) - cantidad).toFixed(2));
                const nuevoActual = +(parseFloat(itemPT.stockActual || 0) + cantidad).toFixed(2);
                await itemPT.update({
                    stockBloqueado: nuevoBloqueado,
                    stockActual: nuevoActual,
                    estadoCalidad: 'Liberado',
                    loteActual: lote
                });

                await MovimientoInventario.create({
                    inventarioId: itemPT.id,
                    tipo: 'LIBERACION',
                    cantidad,
                    motivo: 'Resolución de Cuarentena: Liberado a PT Disponible para Venta',
                    referencia: orden ? orden.numeroOF : lote,
                    lote
                });
            }

            if (loteReg) {
                await loteReg.update({
                    estadoCalidad: 'Liberado',
                    cantidadDisponible: cantidad
                });
            }

            if (orden) {
                await orden.update({ estado: 'Terminada' });
                await liberarReservasDeOF(orden.numeroOF, 'Resolución de Cuarentena: LIBERAR');
            }

            await Calidad.create({
                lote: orden ? orden.numeroOF : lote,
                inspector: nombreInspector,
                sellado: 'OK',
                color: 'OK',
                consistencia: 'OK',
                brixGrados: 66.0,
                phNivel: 3.25,
                disposicion: 'Liberado',
                cantidadRechazada: 0,
                accionFisica: 'Traslado físico autorizado de Zona Amarilla a Almacén de Producto Terminado',
                impactoInventario: `+${cantidad} uds transferidas de Cuarentena a Stock Disponible para venta`,
                observaciones: observaciones || 'Liberación final de cuarentena aprobada por calidad'
            });

            await asignarStockLiberadoAPedidosPendientes();

            return res.json({
                ok: true,
                msg: `Lote ${lote} liberado exitosamente. +${cantidad} uds disponibles en Producto Terminado (PT).`
            });
        }

        if (accion === 'RETRABAJO') {
            if (itemPT) {
                const nuevoBloqueado = Math.max(0, +(parseFloat(itemPT.stockBloqueado || 0) - cantidad).toFixed(2));
                await itemPT.update({
                    stockBloqueado: nuevoBloqueado,
                    estadoCalidad: nuevoBloqueado > 0 ? 'Cuarentena' : 'Liberado'
                });

                await MovimientoInventario.create({
                    inventarioId: itemPT.id,
                    tipo: 'BLOQUEO',
                    cantidad,
                    motivo: 'Resolución de Cuarentena: Retiro de PT para Reprocesamiento en Planta (Retrabajo)',
                    referencia: orden ? orden.numeroOF : lote,
                    lote
                });
            }

            if (loteReg) {
                await loteReg.update({
                    estadoCalidad: 'Retrabajo',
                    cantidadDisponible: 0
                });
            }

            const nuevaOFNum = `OF-RET-${Date.now().toString().slice(-5)}`;
            const loteRet = lote.endsWith('-RET') ? lote : `${lote}-RET`;

            await Fabricacion.create({
                numeroOF: nuevaOFNum,
                producto: orden ? orden.producto : itemPT.producto,
                productoCodigo: orden ? orden.productoCodigo : itemPT.codigo,
                cantidad,
                loteAsignado: loteRet,
                estado: 'Pendiente en Cola',
                temperaturaPromedio: 0,
                tiempoCoccionMin: 0,
                brixAlcanzado: 65.0,
                fechaVencimientoLote: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0]
            });

            if (orden) {
                await orden.update({ estado: `En Retrabajo (Reasignada a ${nuevaOFNum})` });
            }

            await Calidad.create({
                lote: orden ? orden.numeroOF : lote,
                inspector: nombreInspector,
                sellado: 'OK',
                color: 'OK',
                consistencia: 'Ajuste Requerido',
                brixGrados: 64.0,
                phNivel: 3.25,
                disposicion: 'Retrabajo',
                cantidadRechazada: cantidad,
                accionFisica: `Retorno físico a planta. Generada ${nuevaOFNum} en estado 'Pendiente en Cola'`,
                impactoInventario: `Descontadas ${cantidad} uds de PT retenido. Orden enviada a Fabricación para reprocesamiento`,
                observaciones: observaciones || 'Retrabajo derivado desde resolución de cuarentena'
            });

            return res.json({
                ok: true,
                msg: `Lote ${lote} enviado a Retrabajo. Se generó la orden ${nuevaOFNum} en estado 'Pendiente en Cola' en Fabricación.`
            });
        }

        if (accion === 'SCRAP') {
            if (itemPT) {
                const nuevoBloqueado = Math.max(0, +(parseFloat(itemPT.stockBloqueado || 0) - cantidad).toFixed(2));
                await itemPT.update({
                    stockBloqueado: nuevoBloqueado,
                    estadoCalidad: nuevoBloqueado > 0 ? 'Cuarentena' : 'Liberado'
                });

                await MovimientoInventario.create({
                    inventarioId: itemPT.id,
                    tipo: 'SCRAP',
                    cantidad,
                    motivo: 'Resolución de Cuarentena: Baja definitiva por Scrap / Desecho',
                    referencia: orden ? orden.numeroOF : lote,
                    lote
                });
            }

            if (loteReg) {
                await loteReg.update({
                    estadoCalidad: 'Scrap',
                    cantidadDisponible: 0
                });
            }

            if (orden) {
                await orden.update({ estado: 'Rechazada (Scrap)' });
                await liberarReservasDeOF(orden.numeroOF, 'Resolución de Cuarentena: SCRAP');
            }

            await Calidad.create({
                lote: orden ? orden.numeroOF : lote,
                inspector: nombreInspector,
                sellado: 'Falló',
                color: 'Descartado',
                consistencia: 'Descartado',
                brixGrados: 0,
                phNivel: 0,
                disposicion: 'Scrap',
                cantidadRechazada: cantidad,
                accionFisica: 'Destrucción sanitaria y disposición final en contenedor de merma orgánica/vidrio',
                impactoInventario: `Baja definitiva de ${cantidad} uds de inventario físico. Computado en indicador de Scrap del Dashboard`,
                observaciones: observaciones || 'Baja definitiva por resolución de cuarentena'
            });

            return res.json({
                ok: true,
                msg: `Lote ${lote} dado de baja definitiva por Scrap (${cantidad} uds). Registrado en el Dashboard.`
            });
        }

        res.status(400).json({ msg: 'Acción no reconocida' });
    } catch (error) {
        res.status(500).json({ msg: 'Error al gestionar cuarentena' });
    }
};

module.exports = { listar, crear, listarCuarentena, gestionarCuarentena };
