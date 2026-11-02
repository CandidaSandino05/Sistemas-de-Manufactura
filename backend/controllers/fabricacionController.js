const { Fabricacion, Inventario, Receta, Compra, Proveedor, LoteInventario, MovimientoInventario, SensorEstado } = require('../models');

const BOM_BASE_POR_FRASCO = [
    { codigo: 'MP-FRE-01', nombre: 'Fresa Fresca Seleccionada (Categoría A)', requeridoPorUnidad: 0.20, precioEst: 85.00, categoria: 'Fruta' },
    { codigo: 'MP-AZU-02', nombre: 'Azúcar Blanca Refinada Especial', requeridoPorUnidad: 0.12, precioEst: 28.00, categoria: 'Azúcar' },
    { codigo: 'MP-PEC-03', nombre: 'Pectina Cítrica de Alto Metoxilo', requeridoPorUnidad: 0.005, precioEst: 420.00, categoria: 'Pectina' },
    { codigo: 'MP-ENV-04', nombre: 'Frasco de Vidrio Hexagonal 300g + Tapa Twist-Off', requeridoPorUnidad: 1.00, precioEst: 14.50, categoria: 'Envase' }
];

const MAPA_PRODUCTOS = {
    'PT-MER-300': {
        codigo: 'PT-MER-300',
        nombre: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        wipCodigo: 'WIP-BAS-01',
        wipNombre: 'Mermelada de Fresa en Cocción (WIP)'
    },
    'PT-PIN-300': {
        codigo: 'PT-PIN-300',
        nombre: 'Mermelada de Piña Artesanal (Frasco 300g)',
        wipCodigo: 'WIP-BAS-02',
        wipNombre: 'Mermelada de Piña en Cocción (WIP)'
    },
    'PT-MIX-300': {
        codigo: 'PT-MIX-300',
        nombre: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        wipCodigo: 'WIP-BAS-03',
        wipNombre: 'Mermelada de Fresa y Piña en Cocción (WIP)'
    }
};

const resolverCodigoProducto = (productoTexto, codigoParam) => {
    if (codigoParam && MAPA_PRODUCTOS[codigoParam]) return codigoParam;
    const txt = String(productoTexto || '').toLowerCase();
    if (txt.includes('fresa y piña') || txt.includes('piña y fresa') || txt.includes('mixt')) return 'PT-MIX-300';
    if (txt.includes('piña') || txt.includes('pina')) return 'PT-PIN-300';
    return 'PT-MER-300';
};

const calcularHuellaCarbono = (cantidadFrascos, tempPromedio = 92, tiempoMin = 50) => {
    const factorCoccion = (tempPromedio / 90) * (tiempoMin / 45) * 0.145;
    const factorEnvase = 0.042;
    return +((cantidadFrascos * (factorCoccion + factorEnvase))).toFixed(3);
};

const obtenerInsumosRequeridosBOM = async (cantidadFabricar, productoCodigo = 'PT-MER-300') => {
    const recetasDB = await Receta.findAll({
        where: {
            codigoProductoFinal: productoCodigo,
            tipoComponente: 'MP'
        }
    });

    if (recetasDB && recetasDB.length > 0) {
        return recetasDB.map(r => {
            const factor = parseFloat(r.cantidadRequerida) / (parseFloat(r.cantidadProducida) || 1);
            return {
                codigo: r.codigoIngrediente,
                nombre: r.ingrediente,
                requeridoPorUnidad: factor,
                precioEst: parseFloat(r.costoEstandarUnit) || 20.00,
                categoria: r.tipoComponente,
                requeridoTotal: +(factor * cantidadFabricar).toFixed(2)
            };
        });
    }

    const recetasGenerales = await Receta.findAll();
    return BOM_BASE_POR_FRASCO.map(base => {
        const recMatch = recetasGenerales.find(r =>
            (r.codigoIngrediente && r.codigoIngrediente === base.codigo) ||
            (r.ingrediente && r.ingrediente.toLowerCase().includes(base.nombre.split(' ')[0].toLowerCase()))
        );
        const factor = recMatch ? parseFloat(recMatch.cantidadRequerida) / (parseFloat(recMatch.cantidadProducida) || 1) : base.requeridoPorUnidad;
        return {
            ...base,
            requeridoTotal: +(factor * cantidadFabricar).toFixed(2)
        };
    });
};

const obtenerOCrearItemWIP = async (productoCodigo = 'PT-MER-300') => {
    const meta = MAPA_PRODUCTOS[productoCodigo] || MAPA_PRODUCTOS['PT-MER-300'];
    let itemWIP = await Inventario.findOne({ where: { codigo: meta.wipCodigo } });
    if (!itemWIP) {
        itemWIP = await Inventario.findOne({ where: { tipo: 'WIP' } });
    }
    if (!itemWIP) {
        itemWIP = await Inventario.create({
            codigo: meta.wipCodigo,
            producto: meta.wipNombre,
            tipo: 'WIP',
            unidadMedida: 'kg',
            stockActual: 0,
            stockMinimo: 0,
            stockBloqueado: 0,
            costoUnitario: 33.00,
            loteActual: 'LOTE-WIP-2610',
            fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            estadoCalidad: 'En Proceso',
            ubicacionAlmacen: 'Planta Cocción Marmita M-01'
        });
    } else if (itemWIP.producto.includes('Base Concentrada') || itemWIP.unidadMedida !== 'kg' || itemWIP.estadoCalidad === 'Liberado') {
        await itemWIP.update({
            producto: meta.wipNombre,
            unidadMedida: 'kg',
            stockMinimo: 0,
            estadoCalidad: parseFloat(itemWIP.stockActual) > 0 ? 'En Cocina' : 'En Proceso'
        });
    }
    return itemWIP;
};

const verificarYGenerarComprasMP = async (cantidadFabricar, numeroOF, productoCodigo = 'PT-MER-300') => {
    const inventarioMP = await Inventario.findAll({ where: { tipo: 'MP' } });
    const proveedores = await Proveedor.findAll();
    const ordenesCompraCreadas = [];
    const desgloseMateriales = [];
    const reservasRealizadas = [];

    const insumosRequeridos = await obtenerInsumosRequeridosBOM(cantidadFabricar, productoCodigo);

    for (let i = 0; i < insumosRequeridos.length; i++) {
        const insumo = insumosRequeridos[i];
        let itemInv = inventarioMP.find(m => m.codigo === insumo.codigo) ||
                      inventarioMP.find(m => m.producto.toLowerCase().includes(insumo.nombre.split(' ')[0].toLowerCase()));

        const stockDisp = itemInv ? (parseFloat(itemInv.stockActual) || 0) : 0;
        const stockBloqActual = itemInv ? (parseFloat(itemInv.stockBloqueado) || 0) : 0;
        const stockMin = itemInv ? (parseFloat(itemInv.stockMinimo) || 10) : 10;
        const codigoUsar = itemInv ? itemInv.codigo : insumo.codigo;
        const faltante = +(insumo.requeridoTotal - stockDisp).toFixed(2);

        desgloseMateriales.push({
            codigo: codigoUsar,
            insumo: itemInv ? itemInv.producto : insumo.nombre,
            requerido: insumo.requeridoTotal,
            disponible: stockDisp,
            deficit: faltante > 0 ? faltante : 0
        });

        if (faltante <= 0 && itemInv) {
            const nuevoDisponible = +(stockDisp - insumo.requeridoTotal).toFixed(2);
            const nuevoBloqueado = +(stockBloqActual + insumo.requeridoTotal).toFixed(2);

            await itemInv.update({
                stockActual: nuevoDisponible,
                stockBloqueado: nuevoBloqueado,
                estadoCalidad: 'Reservado OF'
            });

            await MovimientoInventario.create({
                inventarioId: itemInv.id,
                tipo: 'BLOQUEO',
                cantidad: insumo.requeridoTotal,
                motivo: `Reserva BOM de Materia Prima para ${numeroOF}`,
                referencia: numeroOF,
                lote: itemInv.loteActual || 'LOTE-MP'
            });

            reservasRealizadas.push({
                codigo: codigoUsar,
                cantidadReservada: insumo.requeridoTotal
            });
        } else if (faltante > 0) {
            if (itemInv && stockDisp > 0) {
                const nuevoBloqueado = +(stockBloqActual + stockDisp).toFixed(2);
                await itemInv.update({
                    stockActual: 0,
                    stockBloqueado: nuevoBloqueado,
                    estadoCalidad: 'Reservado OF (Pendiente OC)'
                });

                await MovimientoInventario.create({
                    inventarioId: itemInv.id,
                    tipo: 'BLOQUEO',
                    cantidad: stockDisp,
                    motivo: `Reserva parcial BOM para ${numeroOF} (En espera de OC)`,
                    referencia: numeroOF,
                    lote: itemInv.loteActual || 'LOTE-MP'
                });
            }

            const cantComprar = +(faltante + stockMin).toFixed(2);
            const prov = proveedores[i % Math.max(1, proveedores.length)] || null;
            const precioUnit = itemInv && parseFloat(itemInv.costoUnitario) > 0 ? parseFloat(itemInv.costoUnitario) : insumo.precioEst;
            const totalOC = +(cantComprar * precioUnit).toFixed(2);
            const numeroOC = `OC-AUTO-${Date.now().toString().slice(-5)}-${i + 1}`;
            const fechaHoy = new Date().toISOString().split('T')[0];
            const fechaEntrega = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

            const nuevaOC = await Compra.create({
                numeroOC,
                proveedor: prov ? prov.razonSocial : 'Agroindustrias Fresas del Norte S.A.',
                proveedorId: prov ? prov.id : null,
                proveedorRuc: prov ? prov.ruc : 'J0310000145892',
                proveedorContacto: prov ? prov.contactoNombre : 'Ing. Carlos Montenegro',
                proveedorTelefono: prov ? prov.telefono : '+505 8842-1920',
                fecha: fechaHoy,
                fechaEntregaEstimada: fechaEntrega,
                producto_codigo: codigoUsar,
                cantidad: cantComprar,
                precio_unitario: precioUnit,
                total: totalOC,
                estado: 'Pendiente',
                ofOrigen: numeroOF
            });

            ordenesCompraCreadas.push(nuevaOC);
        }
    }

    return { ordenesCompraCreadas, desgloseMateriales, reservasRealizadas };
};

const consumirMPYGenerarWIP = async (of) => {
    const consumoPrevio = await MovimientoInventario.findOne({
        where: {
            referencia: of.numeroOF,
            tipo: 'SALIDA',
            motivo: `Consumo físico BOM en cocción de ${of.numeroOF}`
        }
    });

    if (consumoPrevio) {
        return { yaConsumido: true, consumos: [] };
    }

    const inventarioMP = await Inventario.findAll({ where: { tipo: 'MP' } });
    const prodCod = of.productoCodigo || resolverCodigoProducto(of.producto);
    const insumosRequeridos = await obtenerInsumosRequeridosBOM(of.cantidad, prodCod);
    const consumos = [];

    for (const insumo of insumosRequeridos) {
        const itemInv = inventarioMP.find(m => m.codigo === insumo.codigo) ||
                        inventarioMP.find(m => m.producto.toLowerCase().includes(insumo.nombre.split(' ')[0].toLowerCase()));

        if (!itemInv) continue;

        const reservasActivas = await MovimientoInventario.findAll({
            where: {
                referencia: of.numeroOF,
                inventarioId: itemInv.id,
                tipo: 'BLOQUEO'
            }
        });

        const cantReservadaActiva = reservasActivas.reduce((acc, r) => acc + (parseFloat(r.cantidad) || 0), 0);
        const stockDispActual = parseFloat(itemInv.stockActual) || 0;
        const stockBloqActual = parseFloat(itemInv.stockBloqueado) || 0;

        const porDescontarDeDisponible = Math.max(0, +(insumo.requeridoTotal - cantReservadaActiva).toFixed(2));
        const nuevoDisponible = Math.max(0, +(stockDispActual - porDescontarDeDisponible).toFixed(2));
        const nuevoBloqueado = Math.max(0, +(stockBloqActual - cantReservadaActiva).toFixed(2));

        await itemInv.update({
            stockActual: nuevoDisponible,
            stockBloqueado: nuevoBloqueado,
            estadoCalidad: nuevoBloqueado > 0 ? 'Reservado OF' : 'Liberado'
        });

        for (const resMov of reservasActivas) {
            await resMov.update({
                tipo: 'LIBERACION',
                motivo: `Reserva consumida físicamente en cocción de ${of.numeroOF}`
            });
        }

        await MovimientoInventario.create({
            inventarioId: itemInv.id,
            tipo: 'SALIDA',
            cantidad: insumo.requeridoTotal,
            motivo: `Consumo físico BOM en cocción de ${of.numeroOF}`,
            referencia: of.numeroOF,
            lote: itemInv.loteActual || 'LOTE-MP'
        });

        consumos.push({
            codigo: itemInv.codigo,
            producto: itemInv.producto,
            consumido: insumo.requeridoTotal,
            stockRestante: nuevoDisponible
        });
    }

    const itemWIP = await obtenerOCrearItemWIP(prodCod);
    const lotePT = of.loteAsignado || ('LOTE-PT-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900));
    const kgCocidos = +(parseFloat(of.cantidad) * 0.30).toFixed(2);
    const wipRestante = Math.max(0, +((parseFloat(itemWIP.stockActual) || 0) - kgCocidos).toFixed(2));

    await itemWIP.update({
        stockActual: wipRestante,
        loteActual: lotePT,
        estadoCalidad: wipRestante > 0 ? 'En Cocina' : 'En Proceso'
    });

    let itemPT = await Inventario.findOne({ where: { codigo: prodCod, tipo: 'PT' } });
    if (!itemPT) {
        itemPT = await Inventario.findOne({ where: { tipo: 'PT' } });
    }

    if (itemPT) {
        const nuevoBloqueadoPT = +((parseFloat(itemPT.stockBloqueado) || 0) + parseFloat(of.cantidad)).toFixed(2);
        await itemPT.update({
            stockBloqueado: nuevoBloqueadoPT,
            loteActual: lotePT,
            estadoCalidad: 'Cuarentena'
        });

        await MovimientoInventario.create({
            inventarioId: itemPT.id,
            tipo: 'BLOQUEO',
            cantidad: of.cantidad,
            motivo: `Ingreso de lote envasado (${of.cantidad} frascos) en Cuarentena / En Revisión por Calidad`,
            referencia: of.numeroOF,
            lote: lotePT
        });
    }

    return {
        yaConsumido: false,
        consumos,
        wipGenerado: {
            codigo: itemWIP.codigo,
            producto: itemWIP.producto,
            kgConsumidosWIP: kgCocidos,
            stockActualWIP: wipRestante,
            frascosEnRevisionPT: of.cantidad
        }
    };
};

const listar = async (req, res) => {
    try {
        const data = await Fabricacion.findAll({ order: [['createdAt', 'DESC']] });
        res.json(data);
    } catch (error) {
        res.status(500).json({ msg: 'Error al listar fabricación' });
    }
};

const crear = async (req, res) => {
    try {
        const {
            numeroOF,
            producto,
            productoCodigo,
            cantidad,
            loteAsignado,
            estado,
            temperaturaPromedio,
            tiempoCoccionMin,
            brixAlcanzado,
            curvaTemperaturaJson
        } = req.body;

        if (!numeroOF || !producto || !cantidad) {
            return res.status(400).json({ msg: 'Campos obligatorios: numeroOF, producto, cantidad' });
        }

        const cantInt = parseInt(cantidad, 10);
        const lote = loteAsignado || ('LOTE-PT-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900));
        const vencimiento = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
        const temp = parseFloat(temperaturaPromedio) || 92.5;
        const tiempo = parseInt(tiempoCoccionMin, 10) || 48;
        const huella = calcularHuellaCarbono(cantInt, temp, tiempo);
        const codProd = productoCodigo || resolverCodigoProducto(producto, productoCodigo);

        await obtenerOCrearItemWIP(codProd);

        const { ordenesCompraCreadas, desgloseMateriales, reservasRealizadas } = await verificarYGenerarComprasMP(cantInt, numeroOF, codProd);
        const estadoFinal = ordenesCompraCreadas.length > 0 ? 'Pendiente MP (OC Sugerida)' : (estado || 'Pendiente por Iniciar');

        const nueva = await Fabricacion.create({
            numeroOF,
            producto,
            productoCodigo: codProd,
            cantidad: cantInt,
            loteAsignado: lote,
            estado: estadoFinal,
            temperaturaPromedio: temp,
            tiempoCoccionMin: tiempo,
            brixAlcanzado: parseFloat(brixAlcanzado) || 66.0,
            curvaTemperaturaJson: curvaTemperaturaJson || null,
            huellaCarbonoKg: huella,
            fechaVencimientoLote: vencimiento
        });

        let itemPT = await Inventario.findOne({ where: { codigo: codProd, tipo: 'PT' } });
        if (!itemPT) {
            itemPT = await Inventario.findOne({ where: { tipo: 'PT' } });
        }

        if (itemPT) {
            await LoteInventario.findOrCreate({
                where: { codigoLote: lote },
                defaults: {
                    codigoLote: lote,
                    inventarioId: itemPT.id,
                    tipoItem: 'PT',
                    cantidadInicial: cantInt,
                    cantidadDisponible: 0,
                    fechaProduccion: new Date().toISOString().split('T')[0],
                    fechaVencimiento: vencimiento,
                    estadoCalidad: 'Cuarentena',
                    ordenReferencia: numeroOF
                }
            });
        }

        res.status(201).json({
            msg: ordenesCompraCreadas.length > 0
                ? 'Orden de fabricación creada en espera de Materia Prima (OC generada)'
                : 'Orden de fabricación creada y Materia Prima reservada en inventario',
            data: nueva,
            ordenesCompraSugeridas: ordenesCompraCreadas,
            desgloseMateriales,
            reservasRealizadas
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al crear orden de fabricación' });
    }
};

const registrarIoT = async (req, res) => {
    try {
        const { numeroOF } = req.params;
        const {
            temperaturaPromedio,
            tiempoCoccionMin,
            brixAlcanzado,
            curvaTemperaturaJson,
            estado
        } = req.body;

        const of = await Fabricacion.findOne({ where: { numeroOF } });
        if (!of) {
            return res.status(404).json({ msg: 'Orden de fabricación no encontrada' });
        }

        const ocsPendientes = await Compra.count({
            where: {
                ofOrigen: numeroOF,
                estado: 'Pendiente'
            }
        });

        if (ocsPendientes > 0) {
            return res.status(400).json({
                msg: `La orden ${numeroOF} tiene ${ocsPendientes} Orden(es) de Compra de Materia Prima pendientes de recepción en el módulo de Compras.`
            });
        }

        const temp = parseFloat(temperaturaPromedio) || of.temperaturaPromedio || 92.5;
        const tiempo = parseInt(tiempoCoccionMin, 10) || of.tiempoCoccionMin || 48;
        const brix = parseFloat(brixAlcanzado) || of.brixAlcanzado || 66.0;
        const huella = calcularHuellaCarbono(of.cantidad, temp, tiempo);

        const resultadoInventario = await consumirMPYGenerarWIP(of);

        let nuevoEstado = estado || 'Listo para Calidad';
        if (of.estado === 'En Retrabajo' || String(of.estado).includes('Retrabajo')) {
            nuevoEstado = 'Pendiente de Calidad (Retrabajo)';
        } else if (nuevoEstado === 'En Proceso') {
            nuevoEstado = 'Listo para Calidad';
        }

        await of.update({
            temperaturaPromedio: temp,
            tiempoCoccionMin: tiempo,
            brixAlcanzado: brix,
            curvaTemperaturaJson: typeof curvaTemperaturaJson === 'object' ? JSON.stringify(curvaTemperaturaJson) : (curvaTemperaturaJson || of.curvaTemperaturaJson),
            huellaCarbonoKg: huella,
            estado: nuevoEstado
        });

        const sensor = await SensorEstado.findOne({ where: { codigoSensor: 'PT100-M01' } });
        if (sensor) {
            const horasCoccion = +(tiempo / 60).toFixed(2);
            const nuevasHoras = +(parseFloat(sensor.horasUso || 0) + horasCoccion).toFixed(2);
            const maxHoras = parseFloat(sensor.horasMaximas || 500);
            const pct = (nuevasHoras / maxHoras) * 100;
            let estadoSensor = 'Normal';
            if (pct >= 95) estadoSensor = 'Critico';
            else if (pct >= 80) estadoSensor = 'Preventivo';
            await sensor.update({
                horasUso: nuevasHoras,
                estado: estadoSensor,
                ultimaLecturaTemp: temp,
                ultimaLecturaBrix: brix
            });
        }

        res.json({
            msg: resultadoInventario.yaConsumido
                ? 'Telemetría de cocción IoT actualizada en la OF'
                : `Cocción finalizada: Materia Prima descontada, WIP en 0.00 kg y +${of.cantidad} frascos de PT en Cuarentena (En Revisión de Calidad)`,
            data: of,
            impactoInventario: resultadoInventario
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al registrar telemetría IoT' });
    }
};

const liberarReservasDeOF = async (numeroOF, motivo = 'OF finalizada o cancelada') => {
    if (!numeroOF) return;
    try {
        const reservasActivas = await MovimientoInventario.findAll({
            where: {
                referencia: numeroOF,
                tipo: 'BLOQUEO'
            }
        });

        for (const resMov of reservasActivas) {
            const item = await Inventario.findByPk(resMov.inventarioId);
            if (item && item.tipo === 'MP') {
                const cantRes = parseFloat(resMov.cantidad) || 0;
                const nuevoDisp = +((parseFloat(item.stockActual) || 0) + cantRes).toFixed(2);
                const nuevoBloq = Math.max(0, +((parseFloat(item.stockBloqueado) || 0) - cantRes).toFixed(2));

                await item.update({
                    stockActual: nuevoDisp,
                    stockBloqueado: nuevoBloq,
                    estadoCalidad: nuevoBloq > 0 ? 'Reservado OF' : 'Liberado'
                });

                await resMov.update({
                    tipo: 'LIBERACION',
                    motivo: `Reserva liberada: ${motivo}`
                });
            }
        }
    } catch (error) {
        console.error('Error al liberar reservas de OF:', error);
    }
};

module.exports = {
    listar,
    crear,
    registrarIoT,
    liberarReservasDeOF,
    verificarYGenerarComprasMP,
    consumirMPYGenerarWIP,
    obtenerOCrearItemWIP,
    calcularHuellaCarbono,
    resolverCodigoProducto
};
