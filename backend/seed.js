const { sequelize, Role, Usuario, Inventario, LoteInventario, Receta, SensorEstado, LecturaSensor } = require('./models');

const RECETAS_EXPANDIDAS = [
    {
        productoFinal: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MER-300',
        nivelBom: 1,
        componentePadre: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        cantidadProducida: 1,
        codigoIngrediente: 'WIP-BAS-01',
        ingrediente: 'Mermelada de Fresa en Cocción (WIP)',
        tipoComponente: 'WIP',
        cantidadRequerida: 0.30,
        unidadMedida: 'kg',
        mermaEstimadaPct: 1.5,
        costoEstandarUnit: 33.00
    },
    {
        productoFinal: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MER-300',
        nivelBom: 1,
        componentePadre: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-ENV-04',
        ingrediente: 'Frasco de Vidrio Hexagonal 300g + Tapa Twist-Off',
        tipoComponente: 'MP',
        cantidadRequerida: 1.00,
        unidadMedida: 'uds',
        mermaEstimadaPct: 0.5,
        costoEstandarUnit: 14.50
    },
    {
        productoFinal: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MER-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Fresa en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-FRE-01',
        ingrediente: 'Fresa Fresca Seleccionada (Categoría A)',
        tipoComponente: 'MP',
        cantidadRequerida: 0.20,
        unidadMedida: 'kg',
        mermaEstimadaPct: 4.0,
        costoEstandarUnit: 17.00
    },
    {
        productoFinal: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MER-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Fresa en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-AZU-02',
        ingrediente: 'Azúcar Blanca Refinada Especial',
        tipoComponente: 'MP',
        cantidadRequerida: 0.12,
        unidadMedida: 'kg',
        mermaEstimadaPct: 1.0,
        costoEstandarUnit: 3.36
    },
    {
        productoFinal: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MER-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Fresa en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-PEC-03',
        ingrediente: 'Pectina Cítrica de Alto Metoxilo',
        tipoComponente: 'MP',
        cantidadRequerida: 0.005,
        unidadMedida: 'kg',
        mermaEstimadaPct: 0.5,
        costoEstandarUnit: 2.10
    },

    {
        productoFinal: 'Mermelada de Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-PIN-300',
        nivelBom: 1,
        componentePadre: 'Mermelada de Piña Artesanal (Frasco 300g)',
        cantidadProducida: 1,
        codigoIngrediente: 'WIP-BAS-02',
        ingrediente: 'Mermelada de Piña en Cocción (WIP)',
        tipoComponente: 'WIP',
        cantidadRequerida: 0.30,
        unidadMedida: 'kg',
        mermaEstimadaPct: 1.5,
        costoEstandarUnit: 30.00
    },
    {
        productoFinal: 'Mermelada de Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-PIN-300',
        nivelBom: 1,
        componentePadre: 'Mermelada de Piña Artesanal (Frasco 300g)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-ENV-04',
        ingrediente: 'Frasco de Vidrio Hexagonal 300g + Tapa Twist-Off',
        tipoComponente: 'MP',
        cantidadRequerida: 1.00,
        unidadMedida: 'uds',
        mermaEstimadaPct: 0.5,
        costoEstandarUnit: 14.50
    },
    {
        productoFinal: 'Mermelada de Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-PIN-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Piña en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-PIN-05',
        ingrediente: 'Piña Golden Seleccionada',
        tipoComponente: 'MP',
        cantidadRequerida: 0.22,
        unidadMedida: 'kg',
        mermaEstimadaPct: 3.5,
        costoEstandarUnit: 9.90
    },
    {
        productoFinal: 'Mermelada de Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-PIN-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Piña en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-AZU-02',
        ingrediente: 'Azúcar Blanca Refinada Especial',
        tipoComponente: 'MP',
        cantidadRequerida: 0.12,
        unidadMedida: 'kg',
        mermaEstimadaPct: 1.0,
        costoEstandarUnit: 3.36
    },
    {
        productoFinal: 'Mermelada de Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-PIN-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Piña en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-PEC-03',
        ingrediente: 'Pectina Cítrica de Alto Metoxilo',
        tipoComponente: 'MP',
        cantidadRequerida: 0.005,
        unidadMedida: 'kg',
        mermaEstimadaPct: 0.5,
        costoEstandarUnit: 2.10
    },

    {
        productoFinal: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MIX-300',
        nivelBom: 1,
        componentePadre: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        cantidadProducida: 1,
        codigoIngrediente: 'WIP-BAS-03',
        ingrediente: 'Mermelada de Fresa y Piña en Cocción (WIP)',
        tipoComponente: 'WIP',
        cantidadRequerida: 0.30,
        unidadMedida: 'kg',
        mermaEstimadaPct: 1.5,
        costoEstandarUnit: 32.00
    },
    {
        productoFinal: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MIX-300',
        nivelBom: 1,
        componentePadre: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-ENV-04',
        ingrediente: 'Frasco de Vidrio Hexagonal 300g + Tapa Twist-Off',
        tipoComponente: 'MP',
        cantidadRequerida: 1.00,
        unidadMedida: 'uds',
        mermaEstimadaPct: 0.5,
        costoEstandarUnit: 14.50
    },
    {
        productoFinal: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MIX-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Fresa y Piña en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-FRE-01',
        ingrediente: 'Fresa Fresca Seleccionada (Categoría A)',
        tipoComponente: 'MP',
        cantidadRequerida: 0.11,
        unidadMedida: 'kg',
        mermaEstimadaPct: 3.5,
        costoEstandarUnit: 9.35
    },
    {
        productoFinal: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MIX-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Fresa y Piña en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-PIN-05',
        ingrediente: 'Piña Golden Seleccionada',
        tipoComponente: 'MP',
        cantidadRequerida: 0.11,
        unidadMedida: 'kg',
        mermaEstimadaPct: 3.0,
        costoEstandarUnit: 4.95
    },
    {
        productoFinal: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MIX-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Fresa y Piña en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-AZU-02',
        ingrediente: 'Azúcar Blanca Refinada Especial',
        tipoComponente: 'MP',
        cantidadRequerida: 0.12,
        unidadMedida: 'kg',
        mermaEstimadaPct: 1.0,
        costoEstandarUnit: 3.36
    },
    {
        productoFinal: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        codigoProductoFinal: 'PT-MIX-300',
        nivelBom: 2,
        componentePadre: 'Mermelada de Fresa y Piña en Cocción (WIP)',
        cantidadProducida: 1,
        codigoIngrediente: 'MP-PEC-03',
        ingrediente: 'Pectina Cítrica de Alto Metoxilo',
        tipoComponente: 'MP',
        cantidadRequerida: 0.005,
        unidadMedida: 'kg',
        mermaEstimadaPct: 0.5,
        costoEstandarUnit: 2.10
    }
];

const INVENTARIOS_BASE = [
    {
        codigo: 'PT-MER-300',
        producto: 'Mermelada de Fresa Artesanal (Frasco 300g)',
        tipo: 'PT',
        unidadMedida: 'uds',
        stockActual: 35.00,
        stockMinimo: 20.00,
        stockBloqueado: 0.00,
        costoUnitario: 33.00,
        loteActual: 'LOTE-PT-2610-01',
        fechaVencimiento: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Almacén Producto Terminado A1'
    },
    {
        codigo: 'PT-PIN-300',
        producto: 'Mermelada de Piña Artesanal (Frasco 300g)',
        tipo: 'PT',
        unidadMedida: 'uds',
        stockActual: 30.00,
        stockMinimo: 15.00,
        stockBloqueado: 0.00,
        costoUnitario: 30.00,
        loteActual: 'LOTE-PT-2610-02',
        fechaVencimiento: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Almacén Producto Terminado A1'
    },
    {
        codigo: 'PT-MIX-300',
        producto: 'Mermelada de Fresa y Piña Artesanal (Frasco 300g)',
        tipo: 'PT',
        unidadMedida: 'uds',
        stockActual: 25.00,
        stockMinimo: 15.00,
        stockBloqueado: 0.00,
        costoUnitario: 32.00,
        loteActual: 'LOTE-PT-2610-03',
        fechaVencimiento: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Almacén Producto Terminado A1'
    },

    {
        codigo: 'WIP-BAS-01',
        producto: 'Mermelada de Fresa en Cocción (WIP)',
        tipo: 'WIP',
        unidadMedida: 'kg',
        stockActual: 0.00,
        stockMinimo: 0.00,
        stockBloqueado: 0.00,
        costoUnitario: 33.00,
        loteActual: 'LOTE-WIP-2610-F',
        fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'En Proceso',
        ubicacionAlmacen: 'Planta Cocción Marmita M-01'
    },
    {
        codigo: 'WIP-BAS-02',
        producto: 'Mermelada de Piña en Cocción (WIP)',
        tipo: 'WIP',
        unidadMedida: 'kg',
        stockActual: 0.00,
        stockMinimo: 0.00,
        stockBloqueado: 0.00,
        costoUnitario: 30.00,
        loteActual: 'LOTE-WIP-2610-P',
        fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'En Proceso',
        ubicacionAlmacen: 'Planta Cocción Marmita M-01'
    },
    {
        codigo: 'WIP-BAS-03',
        producto: 'Mermelada de Fresa y Piña en Cocción (WIP)',
        tipo: 'WIP',
        unidadMedida: 'kg',
        stockActual: 0.00,
        stockMinimo: 0.00,
        stockBloqueado: 0.00,
        costoUnitario: 32.00,
        loteActual: 'LOTE-WIP-2610-M',
        fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'En Proceso',
        ubicacionAlmacen: 'Planta Cocción Marmita M-01'
    },

    {
        codigo: 'MP-FRE-01',
        producto: 'Fresa Fresca Seleccionada (Categoría A)',
        tipo: 'MP',
        unidadMedida: 'kg',
        stockActual: 50.00,
        stockMinimo: 30.00,
        stockBloqueado: 0.00,
        costoUnitario: 85.00,
        loteActual: 'LOTE-MP-2610A',
        fechaVencimiento: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Cámara Frigorífica C1 (4°C)'
    },
    {
        codigo: 'MP-PIN-05',
        producto: 'Piña Golden Seleccionada',
        tipo: 'MP',
        unidadMedida: 'kg',
        stockActual: 40.00,
        stockMinimo: 20.00,
        stockBloqueado: 0.00,
        costoUnitario: 45.00,
        loteActual: 'LOTE-MP-2610PIN',
        fechaVencimiento: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Cámara Frigorífica C2 (8°C)'
    },
    {
        codigo: 'MP-AZU-02',
        producto: 'Azúcar Blanca Refinada Especial',
        tipo: 'MP',
        unidadMedida: 'kg',
        stockActual: 60.00,
        stockMinimo: 25.00,
        stockBloqueado: 0.00,
        costoUnitario: 28.00,
        loteActual: 'LOTE-MP-2610B',
        fechaVencimiento: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Bodega Seca Estante B2'
    },
    {
        codigo: 'MP-PEC-03',
        producto: 'Pectina Cítrica de Alto Metoxilo',
        tipo: 'MP',
        unidadMedida: 'kg',
        stockActual: 5.00,
        stockMinimo: 2.00,
        stockBloqueado: 0.00,
        costoUnitario: 420.00,
        loteActual: 'LOTE-MP-2609P',
        fechaVencimiento: new Date(Date.now() + 240 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Laboratorio Insumos L1'
    },
    {
        codigo: 'MP-ENV-04',
        producto: 'Frasco de Vidrio Hexagonal 300g + Tapa Twist-Off',
        tipo: 'MP',
        unidadMedida: 'uds',
        stockActual: 150.00,
        stockMinimo: 80.00,
        stockBloqueado: 0.00,
        costoUnitario: 14.50,
        loteActual: 'LOTE-MP-2608E',
        fechaVencimiento: new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Almacén Empaque E3'
    },
    {
        codigo: 'MP-ETI-06',
        producto: 'Etiquetas Autoadhesivas Frutitos de Casa',
        tipo: 'MP',
        unidadMedida: 'uds',
        stockActual: 200.00,
        stockMinimo: 50.00,
        stockBloqueado: 0.00,
        costoUnitario: 2.50,
        loteActual: 'LOTE-MP-2610ETI',
        fechaVencimiento: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        estadoCalidad: 'Liberado',
        ubicacionAlmacen: 'Almacén Empaque E3'
    }
];

const MAPA_HOMOLOGACION = {
    'PT-MERM-FRESA': 'PT-MER-300',
    'MP-FRESA': 'MP-FRE-01',
    'MP-AZUCAR': 'MP-AZU-02',
    'MP-FRASCO': 'MP-ENV-04',
    'MP-ETIQUETA': 'MP-ETI-06'
};

const ejecutarSeed = async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: true });

        for (const [antiguo, nuevo] of Object.entries(MAPA_HOMOLOGACION)) {
            const itemAntiguo = await Inventario.findOne({ where: { codigo: antiguo } });
            const itemNuevo = await Inventario.findOne({ where: { codigo: nuevo } });
            if (itemAntiguo && itemNuevo) {
                await Inventario.destroy({ where: { id: itemAntiguo.id } });
            } else if (itemAntiguo && !itemNuevo) {
                await itemAntiguo.update({ codigo: nuevo });
            }
        }

        for (const item of INVENTARIOS_BASE) {
            const existente = await Inventario.findOne({ where: { codigo: item.codigo } });
            if (existente) {
                await existente.update({
                    producto: item.producto,
                    tipo: item.tipo,
                    unidadMedida: item.unidadMedida,
                    stockActual: item.stockActual,
                    stockMinimo: item.stockMinimo,
                    costoUnitario: item.costoUnitario,
                    loteActual: item.loteActual,
                    fechaVencimiento: item.fechaVencimiento,
                    estadoCalidad: item.estadoCalidad,
                    ubicacionAlmacen: item.ubicacionAlmacen
                });
            } else {
                await Inventario.create(item);
            }

            if (item.tipo === 'PT') {
                const itemRef = await Inventario.findOne({ where: { codigo: item.codigo } });
                const loteEx = await LoteInventario.findOne({ where: { codigoLote: item.loteActual } });
                if (!loteEx && itemRef) {
                    await LoteInventario.create({
                        codigoLote: item.loteActual,
                        inventarioId: itemRef.id,
                        tipoItem: 'PT',
                        cantidadInicial: item.stockActual,
                        cantidadDisponible: item.stockActual,
                        fechaProduccion: new Date().toISOString().split('T')[0],
                        fechaVencimiento: item.fechaVencimiento,
                        estadoCalidad: 'Liberado',
                        ordenReferencia: 'INICIAL-PT'
                    });
                }
            }
        }

        await Receta.destroy({ where: {} });
        await Receta.bulkCreate(RECETAS_EXPANDIDAS);

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

        const countLecturas = await LecturaSensor.count();
        if (countLecturas === 0) {
            const lecturasDemo = [];
            const tempsBase = [91.2, 92.0, 93.4, 94.1, 93.8, 92.9, 94.5, 95.2, 94.0, 93.1, 92.6, 93.5, 94.2, 93.7, 94.8];
            const brixsBase = [65.8, 66.0, 66.1, 66.3, 66.4, 66.2, 66.5, 66.7, 66.4, 66.2, 66.3, 66.6, 66.5, 66.4, 66.5];
            const ahora = Date.now();

            for (let i = 0; i < tempsBase.length; i++) {
                lecturasDemo.push({
                    sensorId: 'PT100-M01',
                    numeroOF: 'OF-DEMO-01',
                    lote: 'LOTE-PT-2610-01',
                    temperatura: tempsBase[i],
                    brix: brixsBase[i],
                    lcsTemp: 98.0,
                    lciTemp: 88.0,
                    esAlerta: false,
                    tipoAlerta: null,
                    observaciones: 'Control estadístico normal',
                    horasAcumuladasSensor: +(385 + (i * 0.05)).toFixed(2),
                    huellaCarbonoEstimada: 0.057,
                    fecha: new Date(ahora - (tempsBase.length - i) * 60000)
                });
            }
            await LecturaSensor.bulkCreate(lecturasDemo);
        }

        console.log('Seed ejecutado exitosamente: 3 productos con BOM de 2 niveles, stock inicial e IoT.');
    } catch (error) {
        console.error('Error en seed:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    ejecutarSeed().then(() => process.exit(0));
}

module.exports = { ejecutarSeed };
