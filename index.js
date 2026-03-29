const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

// --- CONFIGURACIÓN ---
// Estas variables las configurarás en el panel de Railway (Variables)
const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;

// Inicializar Bot
const bot = new TelegramBot(token, { polling: true });

// Variable para guardar el último momento en que la PC avisó que estaba encendida
let lastSeen = null;
let alertSent = false;

// --- RUTAS HTTP (Para recibir el Heartbeat de tu PC) ---

app.get('/', (req, res) => {
    res.send('Monitor de Servidor Operacional');
});

app.get('/heartbeat', (req, res) => {
    lastSeen = new Date();
    alertSent = false; // Resetear alerta si la PC vuelve a conectar
    console.log("Ping recibido de la PC local: " + lastSeen.toLocaleString());
    res.status(200).send('OK');
});

// --- COMANDOS DE TELEGRAM ---

bot.onText(/\/status/, (msg) => {
    // Seguridad: Solo responderte a ti
    if (msg.chat.id.toString() !== myChatId) return;

    if (!lastSeen) {
        bot.sendMessage(myChatId, "? No hay registros de la PC. ¿Está el script de la PC corriendo?");
    } else {
        const ahora = new Date();
        const diffMs = ahora - lastSeen;
        const diffMin = Math.floor(diffMs / 60000);
        
        if (diffMin < 8) {
            bot.sendMessage(myChatId, "? PC ONLINE\nÚltimo pulso: Hace " + diffMin + " min.");
        } else {
            bot.sendMessage(myChatId, "?? PC OFFLINE\nSin señal desde hace " + diffMin + " min.");
        }
    }
});

// --- SISTEMA DE ALERTA PROACTIVA ---
// Revisa cada 5 minutos si la PC se desconectó
setInterval(function() {
    if (lastSeen && !alertSent) {
        const ahora = new Date();
        const diffMin = (ahora - lastSeen) / 60000;

        if (diffMin > 12) { // Si pasan más de 12 min sin señal
            bot.sendMessage(myChatId, "?? ¡ALERTA! Tu PC/Servidor parece estar APAGADO.\nÚltima conexión: " + lastSeen.toLocaleString());
            alertSent = true; // No repetir la alerta hasta que vuelva a encender
        }
    }
}, 5 * 60 * 1000);

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor escuchando en puerto " + PORT);
    console.log("Esperando pings en /heartbeat");
});