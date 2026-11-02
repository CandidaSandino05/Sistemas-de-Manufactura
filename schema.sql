CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin') THEN
        CREATE ROLE admin WITH LOGIN PASSWORD 'FrutitosAdmin#2026!' SUPERUSER CREATEDB CREATEROLE;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'fabricacion') THEN
        CREATE ROLE fabricacion WITH LOGIN PASSWORD 'FrutitosFab#2026!' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ventas') THEN
        CREATE ROLE ventas WITH LOGIN PASSWORD 'FrutitosVen#2026!' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'calidad') THEN
        CREATE ROLE calidad WITH LOGIN PASSWORD 'FrutitosCal#2026!' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    modulos_permitidos TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    usuario VARCHAR(60) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    codigo_cliente VARCHAR(30) NOT NULL UNIQUE,
    ruc_dni VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    tipo_cliente VARCHAR(50) DEFAULT 'Mayorista',
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(40) NOT NULL,
    correo VARCHAR(120) NOT NULL,
    limite_credito NUMERIC(12, 2) DEFAULT 50000.00,
    estado VARCHAR(30) DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    codigo_proveedor VARCHAR(30) NOT NULL UNIQUE,
    ruc VARCHAR(30) NOT NULL UNIQUE,
    razon_social VARCHAR(150) NOT NULL,
    contacto_nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(40) NOT NULL,
    correo VARCHAR(120) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    categoria_insumo VARCHAR(80) NOT NULL,
    tiempo_entrega_dias INTEGER DEFAULT 3,
    calificacion INTEGER DEFAULT 5 CHECK (calificacion BETWEEN 1 AND 5),
    estado VARCHAR(30) DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventarios (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    producto VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('MP', 'WIP', 'PT')),
    unidad_medida VARCHAR(20) DEFAULT 'uds',
    stock_actual NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_minimo NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
    stock_bloqueado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    costo_unitario NUMERIC(12, 2) DEFAULT 0.00,
    lote_actual VARCHAR(60),
    fecha_vencimiento DATE,
    estado_calidad VARCHAR(30) DEFAULT 'Liberado',
    ubicacion_almacen VARCHAR(80) DEFAULT 'Almacén Central A1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lotes_inventario (
    id SERIAL PRIMARY KEY,
    codigo_lote VARCHAR(60) NOT NULL UNIQUE,
    inventario_id INTEGER NOT NULL REFERENCES inventarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
    tipo_item VARCHAR(20) NOT NULL CHECK (tipo_item IN ('MP', 'WIP', 'PT')),
    cantidad_inicial NUMERIC(12, 2) NOT NULL,
    cantidad_disponible NUMERIC(12, 2) NOT NULL,
    fecha_produccion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    estado_calidad VARCHAR(30) NOT NULL DEFAULT 'Cuarentena' CHECK (estado_calidad IN ('Liberado', 'Cuarentena', 'Retrabajo', 'Scrap')),
    orden_referencia VARCHAR(60),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recetas (
    id SERIAL PRIMARY KEY,
    producto_final VARCHAR(150) NOT NULL,
    codigo_producto_final VARCHAR(40) DEFAULT 'PT-MER-300',
    nivel_bom INTEGER NOT NULL DEFAULT 1,
    componente_padre VARCHAR(150) DEFAULT 'Mermelada de Fresa',
    cantidad_producida NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    codigo_ingrediente VARCHAR(40),
    ingrediente VARCHAR(150) NOT NULL,
    tipo_componente VARCHAR(20) DEFAULT 'MP' CHECK (tipo_componente IN ('MP', 'WIP')),
    cantidad_requerida NUMERIC(10, 4) NOT NULL,
    unidad_medida VARCHAR(20) DEFAULT 'kg',
    merma_estimada_pct NUMERIC(5, 2) DEFAULT 2.00,
    costo_estandar_unit NUMERIC(10, 2) DEFAULT 45.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fabricaciones (
    id SERIAL PRIMARY KEY,
    numero_of VARCHAR(50) NOT NULL UNIQUE,
    producto VARCHAR(150) NOT NULL,
    producto_codigo VARCHAR(40) DEFAULT 'PT-MER-300',
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    lote_asignado VARCHAR(60),
    estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente por Iniciar',
    temperatura_promedio DOUBLE PRECISION DEFAULT 0,
    tiempo_coccion_min INTEGER DEFAULT 0,
    brix_alcanzado DOUBLE PRECISION DEFAULT 65.0,
    curva_temperatura_json TEXT,
    huella_carbono_kg NUMERIC(10, 3) DEFAULT 0.000,
    pedido_origen VARCHAR(50),
    fecha_vencimiento_lote DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compras (
    id SERIAL PRIMARY KEY,
    numero_oc VARCHAR(50) NOT NULL UNIQUE,
    proveedor VARCHAR(150) NOT NULL,
    proveedor_id INTEGER REFERENCES proveedores(id) ON UPDATE CASCADE ON DELETE SET NULL,
    proveedor_ruc VARCHAR(30),
    proveedor_contacto VARCHAR(120),
    proveedor_telefono VARCHAR(40),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega_estimada DATE,
    producto_codigo VARCHAR(40) NOT NULL,
    cantidad NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    estado VARCHAR(40) NOT NULL DEFAULT 'Pendiente',
    of_origen VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    numero_pedido VARCHAR(50) NOT NULL UNIQUE,
    cliente VARCHAR(150) NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE SET NULL,
    ruc_dni VARCHAR(30),
    direccion_entrega VARCHAR(255),
    telefono_cliente VARCHAR(40),
    correo_cliente VARCHAR(120),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    producto_codigo VARCHAR(40) NOT NULL,
    cantidad NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    estado VARCHAR(60) NOT NULL DEFAULT 'Pendiente',
    of_generada VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calidades (
    id SERIAL PRIMARY KEY,
    lote VARCHAR(60) NOT NULL,
    inspector VARCHAR(120) NOT NULL,
    sellado VARCHAR(20) NOT NULL,
    color VARCHAR(20) NOT NULL,
    consistencia VARCHAR(20) NOT NULL,
    brix_grados NUMERIC(5, 2) DEFAULT 66.00,
    ph_nivel NUMERIC(4, 2) DEFAULT 3.25,
    disposicion VARCHAR(40) NOT NULL CHECK (disposicion IN ('Liberado', 'Cuarentena', 'Retrabajo', 'Scrap')),
    cantidad_rechazada INTEGER NOT NULL DEFAULT 0,
    accion_fisica TEXT,
    impacto_inventario TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER NOT NULL REFERENCES inventarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'BLOQUEO', 'LIBERACION', 'SCRAP')),
    cantidad NUMERIC(12, 2) NOT NULL,
    motivo VARCHAR(150),
    referencia VARCHAR(80),
    lote VARCHAR(60),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;

GRANT SELECT ON roles, usuarios, clientes, ventas, calidades TO fabricacion;
GRANT SELECT, INSERT, UPDATE ON fabricaciones, inventarios, lotes_inventario, movimientos_inventario, recetas, compras, proveedores TO fabricacion;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fabricacion;

GRANT SELECT ON roles, usuarios, inventarios, lotes_inventario, recetas, proveedores TO ventas;
GRANT SELECT, INSERT, UPDATE ON ventas, clientes, fabricaciones, compras, movimientos_inventario TO ventas;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ventas;

GRANT SELECT ON roles, usuarios, clientes, ventas, compras, proveedores, recetas TO calidad;
GRANT SELECT, INSERT, UPDATE ON calidades, fabricaciones, inventarios, lotes_inventario, movimientos_inventario TO calidad;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO calidad;

INSERT INTO roles (nombre, descripcion, modulos_permitidos) VALUES
    ('Administrador', 'Control gerencial y auditoría integral del ERP', 'dashboard,ventas,inventario,fabricacion,compras,calidad'),
    ('Produccion', 'Gestión de planta, MRP, inventario y compras de insumos', 'inventario,fabricacion,compras'),
    ('Ventas', 'Gestión comercial, cartera de clientes y pedidos', 'ventas'),
    ('Calidad', 'Inspección bromatológica, liberación de lotes y disposición', 'calidad')
ON CONFLICT (nombre) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    modulos_permitidos = EXCLUDED.modulos_permitidos;

INSERT INTO usuarios (nombre, usuario, password, role_id, activo, created_at, updated_at) VALUES
    (
        'Administrador General',
        'admin',
        '$2b$10$mFgimzEjvXGTKyX4goatdek3ZvVQw0nzz0U7JdZd01NCIMQbTCKam',
        (SELECT id FROM roles WHERE nombre = 'Administrador' LIMIT 1),
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'Jefe de Planta y Fabricación',
        'fabricacion',
        '$2b$10$1q6WDLmPjV6ZXhzcofgcqOwW43RiOTeH1BNMsCHE3nhclec2Iyw6S',
        (SELECT id FROM roles WHERE nombre = 'Produccion' LIMIT 1),
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'Ejecutivo de Ventas Comerciales',
        'ventas',
        '$2b$10$f2TO/A6VeggO84zd7cGFpOlC/qI2RWFZrKot5fQkbOSUw1krurFq2',
        (SELECT id FROM roles WHERE nombre = 'Ventas' LIMIT 1),
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'Inspector de Control de Calidad',
        'calidad',
        '$2b$10$.PVXa0iLoQh92liPeP6rzOf5.gykkbk2xSO/b7GnJpEam.fQAsvbi',
        (SELECT id FROM roles WHERE nombre = 'Calidad' LIMIT 1),
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (usuario) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    password = EXCLUDED.password,
    role_id = EXCLUDED.role_id,
    activo = TRUE,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO inventarios (codigo, producto, tipo, unidad_medida, stock_actual, stock_minimo, stock_bloqueado, costo_unitario, lote_actual, fecha_vencimiento, estado_calidad, ubicacion_almacen) VALUES
    ('MP-FRE-01', 'Fresa Fresca Seleccionada (Categoría A)', 'MP', 'kg', 45.00, 30.00, 0.00, 85.00, 'LOTE-MP-2610A', CURRENT_DATE + INTERVAL '12 days', 'Liberado', 'Cámara Frigorífica C1 (4°C)'),
    ('MP-AZU-02', 'Azúcar Blanca Refinada Especial', 'MP', 'kg', 60.00, 25.00, 0.00, 28.00, 'LOTE-MP-2610B', CURRENT_DATE + INTERVAL '365 days', 'Liberado', 'Bodega Seca Estante B2'),
    ('MP-PEC-03', 'Pectina Cítrica de Alto Metoxilo', 'MP', 'kg', 4.50, 2.00, 0.00, 420.00, 'LOTE-MP-2609P', CURRENT_DATE + INTERVAL '240 days', 'Liberado', 'Laboratorio Insumos L1'),
    ('MP-ENV-04', 'Frasco de Vidrio Hexagonal 300g + Tapa Twist-Off', 'MP', 'uds', 120.00, 80.00, 0.00, 14.50, 'LOTE-MP-2608E', CURRENT_DATE + INTERVAL '730 days', 'Liberado', 'Almacén Empaque E3'),
    ('WIP-BAS-01', 'Mermelada de Fresa en Cocción (WIP)', 'WIP', 'kg', 0.00, 0.00, 0.00, 110.00, 'LOTE-WIP-2610', CURRENT_DATE + INTERVAL '7 days', 'En Proceso', 'Planta Cocción Marmita M-01'),
    ('PT-MER-300', 'Mermelada de Fresa Artesanal (Frasco 300g)', 'PT', 'uds', 35.00, 20.00, 0.00, 68.00, 'LOTE-PT-2610-01', CURRENT_DATE + INTERVAL '180 days', 'Liberado', 'Almacén Producto Terminado A1')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO recetas (producto_final, codigo_producto_final, nivel_bom, componente_padre, cantidad_producida, codigo_ingrediente, ingrediente, tipo_componente, cantidad_requerida, unidad_medida, merma_estimada_pct, costo_estandar_unit) VALUES
    ('Mermelada de Fresa Artesanal (Frasco 300g)', 'PT-MER-300', 1, 'Mermelada de Fresa Artesanal (Frasco 300g)', 1.00, 'WIP-BAS-01', 'Mermelada de Fresa en Cocción (WIP)', 'WIP', 0.3000, 'kg', 1.50, 33.00),
    ('Mermelada de Fresa Artesanal (Frasco 300g)', 'PT-MER-300', 1, 'Mermelada de Fresa Artesanal (Frasco 300g)', 1.00, 'MP-ENV-04', 'Frasco de Vidrio Hexagonal 300g + Tapa Twist-Off', 'MP', 1.0000, 'uds', 0.50, 14.50),
    ('Mermelada de Fresa Artesanal (Frasco 300g)', 'PT-MER-300', 2, 'Mermelada de Fresa en Cocción (WIP)', 1.00, 'MP-FRE-01', 'Fresa Fresca Seleccionada (Categoría A)', 'MP', 0.2000, 'kg', 4.00, 17.00),
    ('Mermelada de Fresa Artesanal (Frasco 300g)', 'PT-MER-300', 2, 'Mermelada de Fresa en Cocción (WIP)', 1.00, 'MP-AZU-02', 'Azúcar Blanca Refinada Especial', 'MP', 0.1200, 'kg', 1.00, 3.36),
    ('Mermelada de Fresa Artesanal (Frasco 300g)', 'PT-MER-300', 2, 'Mermelada de Fresa en Cocción (WIP)', 1.00, 'MP-PEC-03', 'Pectina Cítrica de Alto Metoxilo', 'MP', 0.0050, 'kg', 0.50, 2.10);
