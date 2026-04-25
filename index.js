const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

// Empezamos con un objeto vacío
let servers = {};

// --- FUNCIÓN PARA PROCESAR ENTRADA ---
async function procesarEntrada(chatId, texto, fileId = null) {
    if (chatId !== myChatId || !texto) return;

    // Detectar dinámicamente cualquier prefijo "pcX" (ej: pca, pcb, pcc, pcZ...)
    const match = texto.match(/^(pc\w)[:\s\/]*(.*)/i);
    
    if (match) {
        const pcTarget = match[1].toLowerCase(); // Ejemplo: "pcc"
        const contenido = match[2].trim();

        // Verificar si esa PC ha enviado un pulso alguna vez
        if (!servers[pcTarget]) {
            bot.sendMessage(myChatId, `?? La PC "${pcTarget}" no se ha conectado todavía.`);
            return;
        }

        if (fileId) {
            const link = await bot.getFileLink(fileId);
            servers[pcTarget].pendingTasks.push({ type: 'DOWNLOAD', url: link, name: `img_${Date.now()}.jpg` });
            bot.sendMessage(myChatId, `?? Imagen capturada para ${pcTarget.toUpperCase()}.`);
        } else if (contenido) {
            servers[pcTarget].pendingTasks.push({ type: 'TEXT', data: contenido });
            bot.sendMessage(myChatId, `?? Tarea anotada para ${pcTarget.toUpperCase()}`);
        }
    }
}

bot.on('photo', (msg) => {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    procesarEntrada(msg.chat.id.toString(), msg.caption, fileId);
});

bot.on('message', (msg) => {
    if (msg.photo) return;
    procesarEntrada(msg.chat.id.toString(), msg.text);
});

// --- RUTA HEARTBEAT DINÁMICA ---
app.get('/heartbeat', (req, res) => {
    const pc = req.query.id ? req.query.id.toLowerCase() : null;

    if (!pc) return res.status(400).send('Falta ID');

    // REGISTRO AUTOMÁTICO: Si no existe, lo creamos
    if (!servers[pc]) {
        servers[pc] = { lastSeen: null, alertSent: false, pendingTasks: [] };
        bot.sendMessage(myChatId, `?? **Nueva PC Detectada**: ${pc.toUpperCase()} se ha registrado automáticamente.`);
    }

    if (servers[pc].lastSeen === null) {
        bot.sendMessage(myChatId, `?? **Conexión Establecida**: ${pc.toUpperCase()} está enviando datos.`);
    }

    servers[pc].lastSeen = new Date();
    servers[pc].alertSent = false;

    const tasksToSend = [...servers[pc].pendingTasks];
    servers[pc].pendingTasks = []; 

    res.status(200).json({ status: 'OK', tasks: tasksToSend });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor dinámico iniciado en puerto ${PORT}`));