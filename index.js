const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

let servers = {};

// --- COMANDO /STATUS ---
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== myChatId) return;

    let informe = "??? **ESTADO DE LOS SERVIDORES**\n\n";
    const ids = Object.keys(servers);

    if (ids.length === 0) {
        informe += "No hay PCs registradas todavía.";
    } else {
        ids.forEach(id => {
            const s = servers[id];
            const ahora = new Date();
            // Si no se ha visto en más de 2 minutos, la consideramos offline
            const estaOnline = s.lastSeen && (ahora - s.lastSeen < 120000); 
            
            informe += `?? **ID:** ${id.toUpperCase()}\n`;
            informe += `Estado: ${estaOnline ? "? Online" : "? Offline"}\n`;
            informe += `Visto por última vez: ${s.lastSeen ? s.lastSeen.toLocaleTimeString() : "Nunca"}\n`;
            informe += `Tareas pendientes: ${s.pendingTasks.length}\n`;
            informe += `----------------------------\n`;
        });
    }

    bot.sendMessage(chatId, informe, { parse_mode: 'Markdown' });
});

// --- FUNCIÓN PARA PROCESAR ENTRADA (MANDAR TAREAS) ---
async function procesarEntrada(chatId, texto, fileId = null) {
    if (chatId !== myChatId || !texto) return;

    const match = texto.match(/^(pc\w)[:\s\/]*(.*)/i);
    
    if (match) {
        const pcTarget = match[1].toLowerCase();
        const contenido = match[2].trim();

        if (!servers[pcTarget]) {
            bot.sendMessage(myChatId, `?? La PC "${pcTarget}" no existe en la base de datos.`);
            return;
        }

        if (fileId) {
            const link = await bot.getFileLink(fileId);
            servers[pcTarget].pendingTasks.push({ type: 'DOWNLOAD', url: link, name: `img_${Date.now()}.jpg` });
            bot.sendMessage(myChatId, `?? Imagen enviada a ${pcTarget.toUpperCase()}.`);
        } else if (contenido) {
            servers[pcTarget].pendingTasks.push({ type: 'TEXT', data: contenido });
            bot.sendMessage(myChatId, `?? Tarea guardada para ${pcTarget.toUpperCase()}`);
        }
    }
}

bot.on('photo', (msg) => {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    procesarEntrada(msg.chat.id.toString(), msg.caption, fileId);
});

bot.on('message', (msg) => {
    if (msg.photo || msg.text.startsWith('/')) return; // No procesar fotos ni comandos como texto
    procesarEntrada(msg.chat.id.toString(), msg.text);
});

// --- RUTA HEARTBEAT ---
app.get('/heartbeat', (req, res) => {
    const pc = req.query.id ? req.query.id.toLowerCase() : null;
    if (!pc) return res.status(400).send('Falta ID');

    if (!servers[pc]) {
        servers[pc] = { lastSeen: null, alertSent: false, pendingTasks: [] };
        bot.sendMessage(myChatId, `?? **PC Registrada**: ${pc.toUpperCase()}`);
    }

    servers[pc].lastSeen = new Date();
    servers[pc].alertSent = false;

    const tasksToSend = [...servers[pc].pendingTasks];
    servers[pc].pendingTasks = []; 

    res.status(200).json({ status: 'OK', tasks: tasksToSend });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor con /status activo en puerto ${PORT}`));