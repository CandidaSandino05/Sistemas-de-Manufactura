const { sequelize, Fabricacion, Inventario, Calidad, LoteInventario, MovimientoInventario } = require('./models');

async function limpiarInconsistencias() {
    console.log('=== INICIANDO SCRIPT DE LIMPIEZA Y SINCRONIZACIÓN ===\n');

    // 1. REVISIÓN DE ÓRDENES ACTIVAS
    const todasOFs = await Fabricacion.findAll();
    const ofsActivas = todasOFs.filter(o => {
        const est = String(o.estado || '').trim().toLowerCase();
        if (est.startsWith('terminada') || est.includes('scrap') || est.includes('rechazada') || est.includes('cancelada')) {
            return false;
        }
        return true;
    });
    console.log(`Órdenes de fabricación totales: ${todasOFs.length}`);
    console.log(`Órdenes de fabricación activas en planta: ${ofsActivas.length}`);

    // 2. LIBERACIÓN DE RESERVAS FALSAS DE MATERIA PRIMA
    console.log('\n--- 1. LIBERACIÓN DE RESERVAS FALSAS DE MATERIA PRIMA ---');
    const bloqueosMP = await MovimientoInventario.findAll({
        where: { tipo: 'BLOQUEO' },
        include: [{ model: Inventario, as: 'inventario' }]
    });

    let movimientosLiberados = 0;
    for (const mov of bloqueosMP) {
        if (mov.inventario && mov.inventario.tipo === 'MP') {
            const ofActiva = ofsActivas.find(o => o.numeroOF === mov.referencia);
            if (!ofActiva) {
                await mov.update({
                    tipo: 'LIBERACION',
                    motivo: `Reserva liberada: OF ${mov.referencia} ya completada / cerrada`
                });
                movimientosLiberados++;
                console.log(`  -> Movimiento #${mov.id} (${mov.referencia}, ${mov.cantidad} uds) actualizado a LIBERACION.`);
            }
        }
    }
    console.log(`Total movimientos de bloqueo de MP liberados: ${movimientosLiberados}`);

    const itemsMP = await Inventario.findAll({ where: { tipo: 'MP' } });
    for (const item of itemsMP) {
        const bloq = parseFloat(item.stockBloqueado) || 0;
        const disp = parseFloat(item.stockActual) || 0;
        if (bloq > 0 || item.estadoCalidad === 'Reservado OF') {
            const nuevoDisp = +(disp + bloq).toFixed(2);
            await item.update({
                stockActual: nuevoDisp,
                stockBloqueado: 0.00,
                estadoCalidad: 'Liberado'
            });
            console.log(`  -> MP [${item.codigo}] ${item.producto}: Stock Disp pasó de ${disp} a ${nuevoDisp}, Bloqueado pasó de ${bloq} a 0.00, Estado: 'Liberado'`);
        }
    }

    // 3. SINCRONIZACIÓN DE CUARENTENA
    console.log('\n--- 2. SINCRONIZACIÓN DE CUARENTENA ---');
    // Para OF-AUTO-857875 o cualquier OF que esté terminada pero tenga una inspección en Cuarentena sin resolución:
    const inspeccionesCuarentena = await Calidad.findAll({
        where: { disposicion: 'Cuarentena' },
        order: [['createdAt', 'DESC']]
    });

    for (const c of inspeccionesCuarentena) {
        const ordenVinculada = todasOFs.find(o => o.numeroOF === c.lote || o.loteAsignado === c.lote);
        const est = ordenVinculada ? String(ordenVinculada.estado || '').toLowerCase() : '';
        if (ordenVinculada && (est.startsWith('terminada') || est.includes('cancel'))) {
            // La orden ya fue terminada o cubierta; resolver la inspección
            await c.update({
                disposicion: 'Liberado',
                accionFisica: 'Resolución automática de cuarentena: Lote finalizado y cubierto por Stock PT Liberado',
                impactoInventario: `Stock liberado y asignado a pedido comercial (${c.lote})`,
                observaciones: `Sincronización de cuarentena: La OF ${c.lote} se encuentra en estado '${ordenVinculada.estado}'`
            });
            console.log(`  -> Inspección Calidad #${c.id} para [${c.lote}] sincronizada a 'Liberado' (OF ya terminada).`);
        }
    }

    // Asegurar que LoteInventario no tenga inconsistencias en Cuarentena si no hay stock
    const lotesCuarentena = await LoteInventario.findAll({ where: { estadoCalidad: 'Cuarentena' } });
    for (const l of lotesCuarentena) {
        const disp = parseFloat(l.cantidadDisponible) || 0;
        if (disp === 0) {
            await l.update({ estadoCalidad: 'Liberado' });
            console.log(`  -> LoteInventario #${l.id} (${l.codigoLote}) actualizado a 'Liberado' (Sin stock en cuarentena).`);
        }
    }

    // Asegurar que PT no tenga stock bloqueado residual si no hay cuarentenas activas
    const itemsPT = await Inventario.findAll({ where: { tipo: 'PT' } });
    for (const pt of itemsPT) {
        const bloq = parseFloat(pt.stockBloqueado) || 0;
        if (bloq > 0) {
            await pt.update({
                stockBloqueado: 0.00,
                estadoCalidad: 'Liberado'
            });
            console.log(`  -> PT [${pt.codigo}] ${pt.producto}: Stock bloqueado limpiado a 0.00.`);
        }
    }

    console.log('\n=== VERIFICACIÓN POST-LIMPIEZA ===');
    const invFinal = await Inventario.findAll({ attributes: ['codigo', 'producto', 'tipo', 'stockActual', 'stockBloqueado', 'estadoCalidad'], raw: true });
    console.table(invFinal);

    await sequelize.close();
    console.log('=== LIMPIEZA Y SINCRONIZACIÓN FINALIZADA CON ÉXITO ===');
}

limpiarInconsistencias().catch(err => {
    console.error('Error al ejecutar limpieza:', err);
    process.exit(1);
});
