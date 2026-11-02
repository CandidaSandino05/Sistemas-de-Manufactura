const { LecturaSensor, SensorEstado, Fabricacion, Inventario, LoteInventario, MovimientoInventario, Calidad } = require('../models');
const { Op } = require('sequelize');

const LCS_TEMP = 98.0;
const LCI_TEMP = 88.0;
const BRIX_MIN = 65.0;
const FACTOR_CO2_HORA = 3.42;

const obtenerOCrearSensor = async () => {
    let sensor = await SensorEstado.findOne({ where: { codigoSensor: 'PT100-M01' } });
    if (!sensor) {
        sensor = await SensorEstado.create({
            codigoSensor: 'PT100-M01',
            nombre: 'Sensor PT100 Marmita M-01',
            horasUso: 385.00,
            horasMaximas: 500.00,
            estado: 'Normal',
            ultimaLecturaTemp: 92.5,
            ultimaLecturaBrix: 66.2
        });
    }
    return sensor;
};

const registrarLectura = async (req, res) => {
    try {
        const { temperatura, brix, numeroOF } = req.body;
        const tempNum = parseFloat(temperatura);
        const brixNum = parseFloat(brix);

        if (isNaN(tempNum) || isNaN(brixNum)) {
            return res.status(400).json({ msg: 'temperatura y brix son requeridos' });
        }

        const sensor = await obtenerOCrearSensor();
        const horasIncremento = +(5 / 3600).toFixed(4);
        const nuevasHoras = +(parseFloat(sensor.horasUso || 0) + horasIncremento).toFixed(2);
        const maxHoras = parseFloat(sensor.horasMaximas || 500);
        const porcentajeUso = +((nuevasHoras / maxHoras) * 100).toFixed(1);

        let estadoSensor = 'Normal';
        if (porcentajeUso >= 95.0) {
            estadoSensor = 'Critico';
        } else if (porcentajeUso >= 80.0) {
            estadoSensor = 'Preventivo';
        }

        await sensor.update({
            horasUso: nuevasHoras,
            estado: estadoSensor,
            ultimaLecturaTemp: tempNum,
            ultimaLecturaBrix: brixNum
        });

        const tempFuera = tempNum < LCI_TEMP || tempNum > LCS_TEMP;
        const brixBajo = brixNum < BRIX_MIN;
        const esAlerta = tempFuera || brixBajo;

        let motivoAlerta = null;
        if (tempFuera && brixBajo) {
            motivoAlerta = `Temperatura fuera de control (${tempNum}°C) y Grados Brix por debajo de norma (${brixNum}°Bx)`;
        } else if (tempFuera) {
            motivoAlerta = `Temperatura fuera de Límites SPC: ${tempNum}°C (Rango: ${LCI_TEMP}°C - ${LCS_TEMP}°C)`;
        } else if (brixBajo) {
            motivoAlerta = `Sólidos solubles insuficientes: ${brixNum}°Bx (Mínimo requerido: ${BRIX_MIN}°Bx)`;
        }

        let ofEncontrada = null;
        if (numeroOF) {
            ofEncontrada = await Fabricacion.findOne({
                where: {
                    numeroOF,
                    estado: {
                        [Op.in]: ['En Proceso', 'Pendiente por Iniciar', 'Listo para Calidad', 'Pendiente de Calidad']
                    }
                }
            });
        }
        if (!ofEncontrada) {
            ofEncontrada = await Fabricacion.findOne({
                where: {
                    estado: {
                        [Op.in]: ['En Proceso', 'Pendiente por Iniciar', 'Listo para Calidad', 'Pendiente de Calidad']
                    }
                },
                order: [['updatedAt', 'DESC']]
            });
        }

        let noConformidadGenerada = null;
        if (esAlerta && ofEncontrada && !ofEncontrada.estado.includes('Cuarentena')) {
            const loteCodigo = ofEncontrada.loteAsignado || ofEncontrada.numeroOF;
            const cantidadAfectada = parseInt(ofEncontrada.cantidad, 10) || 0;

            const calidadExistente = await Calidad.findOne({
                where: {
                    lote: ofEncontrada.numeroOF,
                    disposicion: 'Cuarentena',
                    inspector: 'Sistema IoT Automatizado (Sensor PT100 / Refractómetro)'
                }
            });

            if (!calidadExistente) {
                noConformidadGenerada = await Calidad.create({
                    lote: ofEncontrada.numeroOF,
                    inspector: 'Sistema IoT Automatizado (Sensor PT100 / Refractómetro)',
                    sellado: 'OK',
                    color: 'OK',
                    consistencia: 'Desviación Térmica / Brix',
                    brixGrados: brixNum,
                    phNivel: 3.25,
                    disposicion: 'Cuarentena',
                    cantidadRechazada: cantidadAfectada,
                    accionFisica: `[ALERTA AUTOMÁTICA IoT] Retención física inmediata en Zona Amarilla de Cuarentena. Motivo: ${motivoAlerta}.`,
                    impactoInventario: `Lote ${loteCodigo} (${cantidadAfectada} uds) bloqueado automáticamente en inventario. Stock trasladado a Cuarentena sin intervención humana.`,
                    observaciones: `Registro automático generado por telemetría IoT en tiempo real (${tempNum}°C, ${brixNum}°Bx).`
                });

                let itemPT = await Inventario.findOne({ where: { codigo: ofEncontrada.productoCodigo, tipo: 'PT' } });
                if (!itemPT) {
                    itemPT = await Inventario.findOne({ where: { tipo: 'PT' } });
                }

                if (itemPT) {
                    const nuevoBloqueado = +(parseFloat(itemPT.stockBloqueado || 0) + cantidadAfectada).toFixed(2);
                    await itemPT.update({
                        stockBloqueado: nuevoBloqueado,
                        estadoCalidad: 'Cuarentena',
                        loteActual: loteCodigo
                    });

                    await MovimientoInventario.create({
                        inventarioId: itemPT.id,
                        tipo: 'BLOQUEO',
                        cantidad: cantidadAfectada,
                        motivo: `Bloqueo automático IoT Cuarentena: ${motivoAlerta}`,
                        referencia: ofEncontrada.numeroOF,
                        lote: loteCodigo
                    });
                }

                const loteReg = await LoteInventario.findOne({ where: { codigoLote: loteCodigo } });
                if (loteReg) {
                    await loteReg.update({ estadoCalidad: 'Cuarentena' });
                }

                await ofEncontrada.update({
                    estado: 'En Cuarentena (No Conformidad IoT)',
                    temperaturaPromedio: tempNum,
                    brixAlcanzado: brixNum
                });
            }
        }

        const huellaHora = +(FACTOR_CO2_HORA * (5 / 3600)).toFixed(4);
        const lectura = await LecturaSensor.create({
            sensorId: sensor.codigoSensor,
            numeroOF: ofEncontrada ? ofEncontrada.numeroOF : (numeroOF || null),
            lote: ofEncontrada ? (ofEncontrada.loteAsignado || ofEncontrada.numeroOF) : null,
            temperatura: tempNum,
            brix: brixNum,
            lcsTemp: LCS_TEMP,
            lciTemp: LCI_TEMP,
            esAlerta,
            tipoAlerta: motivoAlerta,
            observaciones: esAlerta ? 'No Conformidad SPC' : 'Parámetros dentro de control',
            horasAcumuladasSensor: nuevasHoras,
            huellaCarbonoEstimada: huellaHora
        });

        res.status(201).json({
            ok: true,
            lectura,
            sensor: {
                codigo: sensor.codigoSensor,
                horasUso: nuevasHoras,
                horasMaximas: maxHoras,
                porcentajeUso,
                estado: estadoSensor
            },
            spc: {
                lcs: LCS_TEMP,
                lci: LCI_TEMP,
                brixMin: BRIX_MIN,
                enControl: !esAlerta,
                motivoAlerta
            },
            noConformidad: noConformidadGenerada
        });
    } catch (error) {
        res.status(500).json({ ok: false, msg: error.message });
    }
};

const obtenerLecturas = async (req, res) => {
    try {
        const limite = parseInt(req.query.limite, 10) || 30;
        const lecturas = await LecturaSensor.findAll({
            limit: limite,
            order: [['createdAt', 'DESC']]
        });
        res.json(lecturas.reverse());
    } catch (error) {
        res.status(500).json({ ok: false, msg: error.message });
    }
};

const obtenerEstadoSensor = async (req, res) => {
    try {
        const sensor = await obtenerOCrearSensor();
        const horas = parseFloat(sensor.horasUso || 0);
        const max = parseFloat(sensor.horasMaximas || 500);
        const pct = +((horas / max) * 100).toFixed(1);

        const totalLecturas = await LecturaSensor.count();
        const totalAlertas = await LecturaSensor.count({ where: { esAlerta: true } });

        const sumaTiempoMin = await Fabricacion.sum('tiempoCoccionMin') || 0;
        const totalHorasCoccion = +(sumaTiempoMin / 60).toFixed(2);
        const totalHuellaCO2 = +(totalHorasCoccion * FACTOR_CO2_HORA).toFixed(2);

        res.json({
            codigoSensor: sensor.codigoSensor,
            nombre: sensor.nombre,
            horasUso: horas,
            horasMaximas: max,
            porcentajeUso: pct,
            estado: sensor.estado,
            ultimaLecturaTemp: sensor.ultimaLecturaTemp,
            ultimaLecturaBrix: sensor.ultimaLecturaBrix,
            totalLecturas,
            totalAlertas,
            estadisticasCoccion: {
                totalHorasCoccion,
                factorCO2Hora: FACTOR_CO2_HORA,
                totalHuellaCO2
            }
        });
    } catch (error) {
        res.status(500).json({ ok: false, msg: error.message });
    }
};

const resetearSensor = async (req, res) => {
    try {
        const sensor = await obtenerOCrearSensor();
        await sensor.update({
            horasUso: 0.00,
            estado: 'Normal',
            ultimoMantenimiento: new Date().toISOString().split('T')[0]
        });
        res.json({ ok: true, msg: 'Sensor calibrado y horas de vida útil reiniciadas a 0', sensor });
    } catch (error) {
        res.status(500).json({ ok: false, msg: error.message });
    }
};

const simularHorasSensor = async (req, res) => {
    try {
        const { horas } = req.body;
        const horasNum = parseFloat(horas) || 410;
        const sensor = await obtenerOCrearSensor();
        const maxHoras = parseFloat(sensor.horasMaximas || 500);
        const pct = (horasNum / maxHoras) * 100;
        let estado = 'Normal';
        if (pct >= 95) estado = 'Critico';
        else if (pct >= 80) estado = 'Preventivo';

        await sensor.update({
            horasUso: horasNum,
            estado
        });
        res.json({ ok: true, sensor });
    } catch (error) {
        res.status(500).json({ ok: false, msg: error.message });
    }
};

module.exports = {
    registrarLectura,
    obtenerLecturas,
    obtenerEstadoSensor,
    resetearSensor,
    simularHorasSensor,
    obtenerOCrearSensor
};
