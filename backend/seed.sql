INSERT INTO roles (nombre, descripcion, modulos_permitidos) VALUES
    ('Administrador', 'Control gerencial y auditoría integral del ERP', 'dashboard,ventas,inventario,fabricacion,compras,calidad'),
    ('Produccion', 'Gestión de planta, MRP, inventario y compras de insumos', 'inventario,fabricacion,compras'),
    ('Ventas', 'Gestión comercial, cartera de clientes y pedidos', 'ventas'),
    ('Calidad', 'Inspección bromatológica, liberación de lotes y disposición', 'calidad')
ON CONFLICT (nombre) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    modulos_permitidos = EXCLUDED.modulos_permitidos;

UPDATE roles SET modulos_permitidos = 'dashboard,ventas,inventario,fabricacion,compras,calidad' WHERE LOWER(nombre) IN ('admin', 'administrador');
UPDATE roles SET modulos_permitidos = 'inventario,fabricacion,compras' WHERE LOWER(nombre) IN ('produccion', 'fabricacion');
UPDATE roles SET modulos_permitidos = 'ventas' WHERE LOWER(nombre) = 'ventas';
UPDATE roles SET modulos_permitidos = 'calidad' WHERE LOWER(nombre) = 'calidad';

INSERT INTO usuarios (nombre, usuario, password, role_id, created_at, updated_at) VALUES
    (
        'Administrador General',
        'admin',
        '$2b$10$mFgimzEjvXGTKyX4goatdek3ZvVQw0nzz0U7JdZd01NCIMQbTCKam',
        COALESCE(
            (SELECT id FROM roles WHERE LOWER(nombre) = 'administrador' LIMIT 1),
            (SELECT id FROM roles WHERE LOWER(nombre) = 'admin' LIMIT 1)
        ),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'Jefe de Planta y Fabricación',
        'fabricacion',
        '$2b$10$1q6WDLmPjV6ZXhzcofgcqOwW43RiOTeH1BNMsCHE3nhclec2Iyw6S',
        COALESCE(
            (SELECT id FROM roles WHERE LOWER(nombre) = 'produccion' LIMIT 1),
            (SELECT id FROM roles WHERE LOWER(nombre) = 'fabricacion' LIMIT 1)
        ),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'Ejecutivo de Ventas Comerciales',
        'ventas',
        '$2b$10$f2TO/A6VeggO84zd7cGFpOlC/qI2RWFZrKot5fQkbOSUw1krurFq2',
        (SELECT id FROM roles WHERE LOWER(nombre) = 'ventas' LIMIT 1),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'Inspector de Control de Calidad',
        'calidad',
        '$2b$10$.PVXa0iLoQh92liPeP6rzOf5.gykkbk2xSO/b7GnJpEam.fQAsvbi',
        (SELECT id FROM roles WHERE LOWER(nombre) = 'calidad' LIMIT 1),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (usuario) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    password = EXCLUDED.password,
    role_id = EXCLUDED.role_id,
    updated_at = CURRENT_TIMESTAMP;
