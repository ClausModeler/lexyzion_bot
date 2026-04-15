const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const app = express();

// --- CONFIGURACIÓN ---
const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

// Estados independientes para cada PC
let servers = {
    pcA: { lastSeen: null, alertSent: false },
    pcB: { lastSeen: null, alertSent: false }
};

// --- RUTAS HTTP ---

app.get('/', (req, res) => {
    res.send('Monitor de Servidor Operacional');
});

app.get('/heartbeat', (req, res) => {
    const pc = req.query.id; // Espera ?id=pcA o ?id=pcB

    if (servers[pc]) {
        servers[pc].lastSeen = new Date();
        servers[pc].alertSent = false;
        console.log(`Ping recibido de ${pc}: ${servers[pc].lastSeen.toLocaleString()}`);
        res.status(200).send(`OK ${pc}`);
    } else {
        res.status(400).send('ID de PC no reconocido');
    }
});

// --- LÓGICA DE TELEGRAM ---

bot.on('message', (msg) => {
    if (msg.chat.id.toString() !== myChatId || !msg.text) return;

    // Guardar texto: "pcA: mensaje" o "pcB: mensaje"
    const regex = /^(pcA|pcB):\s*(.+)/i;
    const match = msg.text.match(regex);

    if (match) {
        const pcTarget = match[1].toLowerCase();
        const content = match[2];
        const fileName = `${pcTarget}_logs.txt`;
        const logEntry = `[${new Date().toLocaleString()}] ${content}\n`;

        fs.appendFile(fileName, logEntry, (err) => {
            if (err) {
                bot.sendMessage(myChatId, `? Error al guardar en ${fileName}`);
            } else {
                bot.sendMessage(myChatId, `? Guardado en registro de ${pcTarget.toUpperCase()}`);
            }
        });
    }
});

bot.onText(/\/status/, (msg) => {
    if (msg.chat.id.toString() !== myChatId) return;

    let respuesta = "?? **Estado de Servidores:**\n\n";
    for (const [name, data] of Object.entries(servers)) {
        if (!data.lastSeen) {
            respuesta += `? **${name.toUpperCase()}**: Sin registros.\n`;
        } else {
            const diffMin = Math.floor((new Date() - data.lastSeen) / 60000);
            const status = diffMin < 10 ? "?? ONLINE" : "?? OFFLINE";
            respuesta += `${status} **${name.toUpperCase()}**: hace ${diffMin} min.\n`;
        }
    }
    bot.sendMessage(myChatId, respuesta, { parse_mode: 'Markdown' });
});

// --- MONITOR DE CAÍDAS (Cada 5 min) ---
setInterval(() => {
    for (const [name, data] of Object.entries(servers)) {
        if (data.lastSeen && !data.alertSent) {
            const diffMin = (new Date() - data.lastSeen) / 60000;
            if (diffMin > 12) {
                bot.sendMessage(myChatId, `?? **ALERTA**: La **${name.toUpperCase()}** se ha desconectado.\nÚltima señal: ${data.lastSeen.toLocaleString()}`, { parse_mode: 'Markdown' });
                data.alertSent = true;
            }
        }
    }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));