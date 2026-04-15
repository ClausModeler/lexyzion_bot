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
    const pc = req.query.id; // Recibe ?id=pcA o ?id=pcB

    if (servers[pc]) {
        servers[pc].lastSeen = new Date();
        servers[pc].alertSent = false;

        // Extraer tareas para esta PC y limpiar su buzón
        const tasksToSend = [...servers[pc].pendingTasks];
        servers[pc].pendingTasks = []; 

        console.log(`Pulso de ${pc}. Enviando ${tasksToSend.length} tareas.`);
        
        // Responder a la PC con la lista de tareas
        res.status(200).json({ 
            status: 'OK', 
            tasks: tasksToSend 
        });
    } else {
        res.status(400).send('ID de PC no reconocido');
    }
});

// --- LÓGICA DE TELEGRAM ---

// Manejar mensajes de texto para guardar tareas
bot.on('message', (msg) => {
    // ESTO TE AYUDARÁ A VER SI LLEGAN MENSAJES
    console.log(`Mensaje recibido de: ${msg.chat.id}. Texto: ${msg.text}`);
    
    if (msg.chat.id.toString() !== myChatId || !msg.text) {
        console.log("Mensaje ignorado: ID no coincide o no hay texto.");
        return;
    }

    // Detectar si el mensaje empieza con pcA: o pcB:
    const regex = /^(pcA|pcB):\s*(.+)/i;
    const match = msg.text.match(regex);

    if (match) {
        const pcTarget = match[1].toLowerCase();
        const content = match[2];
        
        servers[pcTarget].pendingTasks.push(content);
        bot.sendMessage(myChatId, `?? Tarea en cola para ${pcTarget.toUpperCase()}. Se guardará en tu PC en su próximo pulso.`);
    }
});

// Comando de estado
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
            if (data.pendingTasks.length > 0) {
                respuesta += `   + ?? ${data.pendingTasks.length} tareas pendientes de bajar.\n`;
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