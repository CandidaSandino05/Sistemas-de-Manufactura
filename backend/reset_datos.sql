-- =============================================================================
-- SCRIPT DE RESET DE DATOS TRANSACCIONALES - FRUTITOS DE CASA ERP (PostgreSQL)
-- Archivo: reset_datos.sql
-- Descripción:
--   Vacía únicamente las tablas de movimiento diario (transaccionales) y
--   reinicia sus contadores de ID ( secuencias ) a 1.
--   Conserva intactos: Roles, Usuarios, Clientes, Proveedores, Recetas (BOM)
--   y el catálogo maestro de Inventario (restaurando su stock base inicial).
-- =============================================================================

BEGIN;

-- 1. Vaciar tablas transaccionales y reiniciar secuencias (IDs vuelven a 1)
TRUNCATE TABLE
    ventas,
    fabricaciones,
    compras,
    calidades,
    movimientos_inventario,
    lotes_inventario
RESTART IDENTITY CASCADE;

-- 2. Restaurar los saldos de la tabla maestra de Inventario a su estado limpio inicial
--    (Limpia reservas/bloqueos en 0.00, deja WIP en 0.00 kg con estado 'En Proceso' y restablece el stock base)
UPDATE inventarios
SET
    producto        = CASE WHEN tipo = 'WIP' THEN 'Mermelada de Fresa en Cocción (WIP)' ELSE producto END,
    unidad_medida   = CASE WHEN tipo = 'WIP' THEN 'kg' ELSE unidad_medida END,
    stock_minimo    = CASE WHEN tipo = 'WIP' THEN 0.00 ELSE stock_minimo END,
    stock_bloqueado = 0.00,
    estado_calidad  = CASE WHEN tipo = 'WIP' THEN 'En Proceso' ELSE 'Liberado' END,
    updated_at      = CURRENT_TIMESTAMP,
    stock_actual    = CASE codigo
        WHEN 'MP-FRE-01'  THEN 50.00
        WHEN 'MP-PIN-05'  THEN 40.00
        WHEN 'MP-AZU-02'  THEN 60.00
        WHEN 'MP-PEC-03'  THEN 5.00
        WHEN 'MP-ENV-04'  THEN 150.00
        WHEN 'MP-ETI-06'  THEN 200.00
        WHEN 'WIP-BAS-01' THEN 0.00
        WHEN 'WIP-BAS-02' THEN 0.00
        WHEN 'WIP-BAS-03' THEN 0.00
        WHEN 'PT-MER-300' THEN 35.00
        WHEN 'PT-PIN-300' THEN 30.00
        WHEN 'PT-MIX-300' THEN 25.00
        ELSE 0.00
    END;

UPDATE recetas
SET ingrediente = 'Mermelada de Fresa en Cocción (WIP)', unidad_medida = 'kg'
WHERE tipo_componente = 'WIP';

UPDATE recetas
SET componente_padre = 'Mermelada de Fresa en Cocción (WIP)'
WHERE nivel_bom = 2;

-- =============================================================================
-- OPCIÓN ALTERNATIVA (Opcional):
-- Si deseas iniciar absolutamente todos los stocks (MP, WIP y PT) en 0.00,
-- descomenta la siguiente línea y vuelve a ejecutar:
-- UPDATE inventarios SET stock_actual = 0.00, stock_bloqueado = 0.00, estado_calidad = 'Liberado';
-- =============================================================================

COMMIT;
