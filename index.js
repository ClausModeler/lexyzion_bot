const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

// --- CONFIGURACIÓN ---
const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;
const bot = new TelegramBot(token, { polling: true });

// Almacén de estados y mensajes pendientes
let servers = {
    pcA: { lastSeen: null, alertSent: false, pendingTasks: [] },
    pcB: { lastSeen: null, alertSent: false, pendingTasks: [] }
};

// --- RUTA PARA LAS PCs (HEARTBEAT) ---
app.get('/heartbeat', (req, res) => {
    const pc = req.query.id; 

    if (servers[pc]) {
        // --- NUEVA LÓGICA DE PRIMER PULSO ---
        if (servers[pc].lastSeen === null) {
            bot.sendMessage(myChatId, `?? **Conexión Inicial**: La **${pc.toUpperCase()}** ha enviado su primer pulso y ya está activa.`, { parse_mode: 'Markdown' });
        }

        servers[pc].lastSeen = new Date();
        servers[pc].alertSent = false;

        const tasksToSend = [...servers[pc].pendingTasks];
        servers[pc].pendingTasks = []; 

        console.log(`Pulso de ${pc}. Enviando ${tasksToSend.length} tareas.`);
        
        res.status(200).json({ 
            status: 'OK', 
            tasks: tasksToSend 
        });
    } else {
        res.status(400).send('ID de PC no reconocido');
    }
});

// --- LÓGICA DE TELEGRAM ---

bot.on('message', (msg) => {
    const chatIdRecibido = msg.chat.id.toString();
    const texto = msg.text ? msg.text.trim() : "";

    if (chatIdRecibido !== myChatId || !texto) return;

    let pcTarget = null;
    let contenido = "";

    if (texto.toLowerCase().startsWith('pca')) {
        pcTarget = 'pcA';
        contenido = texto.replace(/^pca[:\s\/]*/i, '').trim();
    } else if (texto.toLowerCase().startsWith('pcb')) {
        pcTarget = 'pcB';
        contenido = texto.replace(/^pcb[:\s\/]*/i, '').trim();
    }

    if (pcTarget && contenido) {
        servers[pcTarget].pendingTasks.push(contenido);
        bot.sendMessage(myChatId, `? Tarea anotada para ${pcTarget.toUpperCase()}`);
    }
});

// Comando de estado
bot.onText(/\/status/, (msg) => {
    if (msg.chat.id.toString() !== myChatId) return;

    const pcsConectadas = Object.values(servers).filter(s => s.lastSeen !== null).length;
    const totalPcs = Object.keys(servers).length;

    let respuesta = `?? **Estado del Sistema** (${pcsConectadas}/${totalPcs} activas)\n\n`;

    for (const [name, data] of Object.entries(servers)) {
        if (!data.lastSeen) {
            respuesta += `? **${name.toUpperCase()}**: Sin registros.\n`;
        } else {
            const diffMin = Math.floor((new Date() - data.lastSeen) / 60000);
            const status = diffMin < 12 ? "?? ONLINE" : "?? OFFLINE";
            respuesta += `${status} **${name.toUpperCase()}**: hace ${diffMin} min.\n`;
            
            if (data.pendingTasks.length > 0) {
                respuesta += `    + ?? ${data.pendingTasks.length} tareas pendientes.\n`;
            }
        }
    }
    bot.sendMessage(myChatId, respuesta, { parse_mode: 'Markdown' });
});

// Monitor de alertas proactivas
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
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));