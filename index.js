const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

let servers = {
    pcA: { lastSeen: null, alertSent: false, pendingTasks: [] },
    pcB: { lastSeen: null, alertSent: false, pendingTasks: [] }
};

// --- FUNCIÓN PARA PROCESAR MENSAJES (TEXTO O FOTOS) ---
async function procesarEntrada(chatId, texto, fileId = null) {
    if (chatId !== myChatId || !texto) return;

    let pcTarget = null;
    let contenido = "";

    if (texto.toLowerCase().startsWith('pca')) {
        pcTarget = 'pcA';
        contenido = texto.replace(/^pca[:\s\/]*/i, '').trim();
    } else if (texto.toLowerCase().startsWith('pcb')) {
        pcTarget = 'pcB';
        contenido = texto.replace(/^pcb[:\s\/]*/i, '').trim();
    }

    if (pcTarget) {
        if (fileId) {
            // Si hay una imagen, obtenemos el link de descarga de Telegram
            const link = await bot.getFileLink(fileId);
            // Guardamos un objeto especial para que la PC sepa que es una descarga
            servers[pcTarget].pendingTasks.push({ type: 'DOWNLOAD', url: link, name: `img_${Date.now()}.jpg` });
            bot.sendMessage(myChatId, `??? Imagen capturada para ${pcTarget.toUpperCase()}. Se descargará en el próximo pulso.`);
        } else if (contenido) {
            // Si es solo texto
            servers[pcTarget].pendingTasks.push({ type: 'TEXT', data: contenido });
            bot.sendMessage(myChatId, `? Tarea anotada para ${pcTarget.toUpperCase()}`);
        }
    }
}

// Escuchar fotos con comentario
bot.on('photo', (msg) => {
    const fileId = msg.photo[msg.photo.length - 1].file_id; // La mejor calidad
    procesarEntrada(msg.chat.id.toString(), msg.caption, fileId);
});

// Escuchar mensajes de texto normales
bot.on('message', (msg) => {
    if (msg.photo) return; // Evitar duplicar si es foto
    procesarEntrada(msg.chat.id.toString(), msg.text);
});

// --- RUTA HEARTBEAT ---
app.get('/heartbeat', (req, res) => {
    const pc = req.query.id; 
    if (servers[pc]) {
        if (servers[pc].lastSeen === null) {
            bot.sendMessage(myChatId, `?? **Conexión Inicial**: ${pc.toUpperCase()} activa.`);
        }
        servers[pc].lastSeen = new Date();
        servers[pc].alertSent = false;

        const tasksToSend = [...servers[pc].pendingTasks];
        servers[pc].pendingTasks = []; 

        res.status(200).json({ status: 'OK', tasks: tasksToSend });
    } else {
        res.status(400).send('ID no reconocido');
    }
});

// (Resto del código de status y alertas se mantiene igual...)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));