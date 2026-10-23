const bcrypt = require('bcryptjs');

const usuarios = [
    { nombre: 'admin', password: 'admin123' },
    { nombre: 'ventas', password: 'ventas123' },
    { nombre: 'produccion', password: 'produccion123' },
    { nombre: 'calidad', password: 'calidad123' }
];

(async () => {
    console.log('🔐 Generando hashes...\n');
    for (const u of usuarios) {
        const hash = await bcrypt.hash(u.password, 10);
        console.log(`-- ${u.nombre} (${u.password})`);
        console.log(`UPDATE usuarios SET password = '${hash}' WHERE usuario = '${u.nombre}';\n`);
    }
})();