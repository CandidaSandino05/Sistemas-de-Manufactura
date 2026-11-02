const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/sensores/lectura';
const INTERVALO_MS = 5000;

let contador = 0;

console.log('===============================================================');
console.log('  SIMULADOR EXTERNO DE SENSORES IoT - FRUTITOS DE CASA ERP');
console.log('  Marmita de Cocción M-01 | PT100 & Refractómetro Digital');
console.log(`  Frecuencia de muestreo: Cada ${INTERVALO_MS / 1000} segundos`);
console.log(`  Endpoint API: http://${API_HOST}:${API_PORT}${API_PATH}`);
console.log('===============================================================\n');

function generarLecturaAleatoria() {
    const temperatura = +(Math.random() * (100 - 80) + 80).toFixed(1);
    const brix = +(Math.random() * (70 - 60) + 60).toFixed(1);
    return { temperatura, brix };
}

function enviarLectura(lectura) {
    contador++;
    const postData = JSON.stringify(lectura);
    const ahora = new Date().toLocaleTimeString('es-NI');

    const options = {
        hostname: API_HOST,
        port: API_PORT,
        path: API_PATH,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 4000
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
            try {
                const data = JSON.parse(responseBody);
                const spc = data.spc || {};
                const sensor = data.sensor || {};
                const enControl = spc.enControl;

                console.log(`[#${contador} | ${ahora}] Temp: ${lectura.temperatura}°C | Brix: ${lectura.brix}°Bx`);

                if (enControl) {
                    console.log(`       SPC: [OK - EN CONTROL] Parámetros dentro de rango óptimo (LCI 88°C - LCS 98°C, Brix >= 65°)`);
                } else {
                    console.log(`  >>>  SPC: [ALERTA DE NO CONFORMIDAD] ${spc.motivoAlerta}`);
                    if (data.noConformidad) {
                        console.log(`  >>>  INVENTARIO: Lote bloqueado y transferido automáticamente a Cuarentena sin intervención humana.`);
                    }
                }

                console.log(`       Sensor PT100: ${sensor.horasUso}h / ${sensor.horasMaximas}h (${sensor.porcentajeUso}%) · Estado: ${sensor.estado}`);
                console.log('---------------------------------------------------------------');
            } catch (err) {
                console.log(`[#${contador} | ${ahora}] Respuesta HTTP ${res.statusCode}: ${responseBody.slice(0, 100)}`);
            }
        });
    });

    req.on('error', (error) => {
        console.error(`[#${contador} | ${ahora}] Error de conexión con el backend ERP (${error.message}). Reintentando en ${INTERVALO_MS / 1000}s...`);
    });

    req.on('timeout', () => {
        req.destroy();
        console.error(`[#${contador} | ${ahora}] Timeout al conectar con http://${API_HOST}:${API_PORT}`);
    });

    req.write(postData);
    req.end();
}

console.log('Iniciando transmisión continua de telemetría IoT...');
const primerDato = generarLecturaAleatoria();
enviarLectura(primerDato);

setInterval(() => {
    const lectura = generarLecturaAleatoria();
    enviarLectura(lectura);
}, INTERVALO_MS);
