import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { askN8nWorkflow, triggerAgendaWorkflow } from './n8nClient.js';
import { processMediaMessage, getRecentMedia } from './mediaHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Estado global en memoria
let waSocket = null;
let isConnected = false;
let userPhone = null;
let activeAdminJid = '56979089410@s.whatsapp.net';
const recentLogs = [];

function logActivity(text, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  recentLogs.unshift({ timestamp, text, type });
  if (recentLogs.length > 50) recentLogs.pop();
}

// Iniciar Cliente de WhatsApp Baileys
async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  console.log('\n🚀 Iniciando cliente de WhatsApp Baileys para MYSA TRANSPORTES...');
  console.log('🔗 Conectado con Workflow de n8n: "Mysa - Chatbot con memoria y registro en Sheets"');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['MYSA TRANSPORTES', 'Chrome', '1.0.0'],
    printQRInTerminal: false
  });

  waSocket = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n===============================================================');
      console.log(' 📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP (MYSA TRANSPORTES)');
      console.log('===============================================================');
      qrcode.generate(qr, { small: true });
      isConnected = false;
    }

    if (connection === 'open') {
      isConnected = true;
      userPhone = sock.user?.id ? sock.user.id.split(':')[0] : 'Conectado';
      console.log('\n===============================================================');
      console.log(' ✅ ¡CONEXIÓN EXITOSA CON WHATSAPP!');
      console.log(` 🚚 Bot de MYSA TRANSPORTES activo (+${userPhone})`);
      console.log(` 🌐 Panel de Control Web: http://localhost:${PORT}`);
      console.log('===============================================================\n');
      logActivity(`WhatsApp conectado correctamente (+${userPhone})`, 'success');
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`\n⚠️ Conexión cerrada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);

      if (shouldReconnect) {
        console.log('🔄 Reconectando a WhatsApp en 3 segundos...');
        setTimeout(startWhatsAppBot, 3000);
      } else {
        console.log('❌ Sesión cerrada por el usuario.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@broadcast') || jid.includes('@newsletter')) continue;

      const cleanJid = jid.replace(/[^0-9]/g, '');
      const participant = (msg.key.participant || '').replace(/[^0-9]/g, '');
      const rawSender = (msg.pushName || '').trim();
      const isAdmin = (
        cleanJid.includes('56979089410') ||
        jid.includes('173134544138300') ||
        cleanJid.includes('173134544138300') ||
        participant.includes('56979089410') ||
        participant.includes('173134544138300') ||
        rawSender.toLowerCase().includes('mery') ||
        rawSender.toLowerCase().includes('meyrilin')
      );
      const senderName = isAdmin ? 'Meyrilin (Administradora)' : (rawSender || 'Cliente');

      let text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''
      ).trim();

      // Procesar contenido multimedia (Audios de voz, Fotos, Documentos)
      let mediaInfo = null;
      if (msg.message.audioMessage || msg.message.imageMessage || msg.message.documentMessage) {
        mediaInfo = await processMediaMessage(msg, senderName);
        if (mediaInfo?.text) {
          text = mediaInfo.text;
          logActivity(`📎 Archivo ${mediaInfo.type} recibido de ${senderName}`, 'info');
        }
      }

      if (!text) continue;

      if (isAdmin) {
        activeAdminJid = jid; // Guardar JID activo de Meyrilin para respuestas y alertas
        console.log(`\n👑 [MENSAJE DE MEYRILIN - JEFA DE MYSA TRANSPORTES] (${jid}): "${text}"`);
        logActivity(`👑 Mensaje de Meyrilin (Admin): "${text}"`, 'warn');

        // Atajos y Comandos inmediatos para la Jefa
        const cleanLower = text.trim().toLowerCase();
        if (cleanLower === '!agenda' || cleanLower === 'agenda') {
          await sock.sendMessage(jid, { text: `🚚 *Generando agenda de Mysa Transportes...* ⏳\nConsultando traslados con Google Sheets y Google Calendar...` }, { quoted: msg });
          try {
            await triggerAgendaWorkflow();
            await sock.sendMessage(jid, { text: `📅 *¡Agenda procesada con éxito!* ✅\n\nHe verificado los traslados de mañana y enviado el reporte consolidado a tu correo corporativo:\n📧 *mysa.transportes@gmail.com*\n\nPuedes ver tu calendario en vivo en:\n👉 https://calendar.google.com/calendar/r` });
            logActivity(`Agenda de mañana enviada por correo a Meyrilin`, 'success');
          } catch (e) {
            await sock.sendMessage(jid, { text: `⚠️ No se pudo procesar la agenda: ${e.message}` });
          }
          return;
        }
        if (cleanLower === '!calendar' || cleanLower === 'calendario') {
          await sock.sendMessage(jid, { text: `📅 *Google Calendar de Mysa Transportes*\n👉 https://calendar.google.com/calendar/r\n\nTodos los traslados confirmados se sincronizan automáticamente en tu cuenta corporativa mysa.transportes@gmail.com.` }, { quoted: msg });
          return;
        }
        if (cleanLower === '!admin' || cleanLower === 'gestion' || cleanLower === 'gestionar') {
          await sock.sendMessage(jid, { text: `🛠️ *Panel de Gestión de Reservas*\n👉 https://mysatransportes.app.n8n.cloud/form/panel-reservas-mysa\n\nAquí puedes completar, cancelar o reprogramar cualquier flete ingresando el código de reserva.` }, { quoted: msg });
          return;
        }
        if (cleanLower === '!panel' || cleanLower === 'panel') {
          await sock.sendMessage(jid, { text: `🚚 *Panel de Control de Mysa Transportes*\n👉 http://localhost:3050\n\nPuedes ver el estado del bot, escuchar audios, ver fotos y revisar actividad en vivo.` }, { quoted: msg });
          return;
        }
        if (cleanLower === '!sheets' || cleanLower === 'planilla' || cleanLower === 'reservas') {
          await sock.sendMessage(jid, { text: `📊 *Planilla de Reservas en Google Sheets*\n👉 https://docs.google.com/spreadsheets/d/17HI5dCua1GJfm2ZATpGAfk2BSmdNVfEse7CPws-7dqA/edit` }, { quoted: msg });
          return;
        }
        if (cleanLower === '!form' || cleanLower === 'formulario') {
          await sock.sendMessage(jid, { text: `📝 *Formulario Web de Clientes*\n👉 https://mysatransportes.app.n8n.cloud/form/reserva-mysa` }, { quoted: msg });
          return;
        }
        if (cleanLower === '!ayuda' || cleanLower === '!comandos' || cleanLower === 'comandos') {
          await sock.sendMessage(jid, { text: `👑 *Menú de Comandos para la Administradora (Meyrilin):*\n\n• *!agenda*: Envía la agenda y traslados de mañana a tu correo.\n• *!calendar*: Acceso a Google Calendar sincronizado.\n• *!admin*: Panel para completar/reprogramar traslados.\n• *!sheets*: Acceso directo a Google Sheets.\n• *!form*: Enlace al formulario web de clientes.\n• *!panel*: Panel de Control local en vivo.\n• O pregúntame naturalmente sobre tarifas por km, costos de fletes o choferes.` }, { quoted: msg });
          return;
        }
      } else {
        console.log(`\n📩 Mensaje de ${senderName} (${jid}): "${text}"`);
        logActivity(`Mensaje de ${senderName}: "${text}"`, 'info');
      }

      try {
        await sock.sendPresenceUpdate('composing', jid);
      } catch (_) {}

      console.log(`⏳ Consultando agente inteligente en n8n (Rol: ${isAdmin ? 'Administradora' : 'Cliente'})...`);
      const n8nResult = await askN8nWorkflow(text, senderName, isAdmin, cleanJid);

      let replyText = '';
      if (n8nResult) {
        replyText = typeof n8nResult === 'string' ? n8nResult : (n8nResult.text || '');
        console.log(`🤖 Respuesta obtenida de n8n (registrada en Sheets).`);
        logActivity(`Respuesta enviada a ${senderName}`, 'success');

        // Notificación automática instantánea a Meyrilin si se generó una reserva
        if (n8nResult.booking && !isAdmin) {
          const b = n8nResult.booking;
          const adminAlert = `🚨 *¡NUEVA RESERVA GENERADA EN WHATSAPP!* 🚚\n\n• *Cliente:* ${senderName} (+${cleanJid})\n• *Origen:* ${b.origen || 'No especificado'}\n• *Destino:* ${b.destino || 'No especificado'}\n• *Fecha:* ${b.fecha_traslado || 'A coordinar'}\n• *Hora:* ${b.hora_traslado || 'A coordinar'}\n• *Tipo de carga:* ${b.tipo_carga || 'General'}\n• *ID Reserva:* ${b.id_reserva || 'Nueva'}\n\n_Puedes revisarla en la planilla o en tu panel web: http://localhost:3050_`;
          try {
            await sock.sendMessage(activeAdminJid, { text: adminAlert });
            console.log(`📢 Alerta enviada a Meyrilin (${activeAdminJid}) por WhatsApp sobre nueva reserva.`);
            logActivity(`Alerta de nueva reserva enviada a Meyrilin`, 'warn');
          } catch (err) {
            console.error('Error enviando alerta a Meyrilin:', err.message);
          }
        }
      } else {
        console.log('⚠️ Usando respuesta local de contingencia.');
        if (isAdmin) {
          replyText = `🚚 *¡Hola Meyrilin!* 👑\n\nRecibí tu mensaje: _"${text}"_.\nEl sistema de Mysa Transportes está activo en el panel local (puerto 3050). Puedes usar los comandos directos:\n• *!agenda*: Enviar traslados a tu correo.\n• *!calendar*: Ver Google Calendar.\n• *!sheets*: Ver planilla en Sheets.\n• *!admin*: Reprogramar o cancelar.`;
        } else {
          replyText = `🚚 *¡Hola ${senderName}! Bienvenido a MYSA TRANSPORTES*\n\nRecibimos tu solicitud de traslado en Chile 🇨🇱.\nPuedes agendar directamente tu día y hora libre en nuestro calendario corporativo:\n👉 https://mysatransportes.app.n8n.cloud/form/reserva-mysa\n\nO déjanos tu origen, destino y tipo de carga para coordinar tu viaje de inmediato.`;
        }
      }

      try {
        await sock.sendPresenceUpdate('paused', jid);
      } catch (_) {}

      try {
        await sock.sendMessage(jid, { text: replyText }, { quoted: msg });
        console.log(`✅ Respuesta enviada a WhatsApp exitosamente.`);
      } catch (err) {
        console.error('Error enviando mensaje a WhatsApp, reintentando...', err.message);
        try {
          await new Promise(r => setTimeout(r, 1500));
          if (waSocket) {
            await waSocket.sendMessage(jid, { text: replyText });
            console.log(`✅ Respuesta enviada en reintento exitosamente.`);
          }
        } catch (retryErr) {
          console.error('Error definitivo al enviar respuesta a WhatsApp:', retryErr.message);
        }
      }
    }
  });
}

// Rutas de API para el Panel de Control Web
app.get('/api/status', (req, res) => {
  res.json({
    whatsapp: {
      connected: isConnected,
      user: userPhone ? `+${userPhone}` : null
    },
    n8n: {
      connected: true,
      url: 'https://mysatransportes.app.n8n.cloud'
    },
    logs: recentLogs
  });
});

app.get('/api/media', (req, res) => {
  res.json({ media: getRecentMedia() });
});

app.post('/api/test-chat', async (req, res) => {
  const { message, isAdmin } = req.body;
  if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

  try {
    const sender = isAdmin ? 'Meyrilin (Administradora)' : 'Simulador Cliente';
    const reply = await askN8nWorkflow(message, sender, Boolean(isAdmin));
    res.json({ response: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-wa', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Faltan parámetros' });
  if (!waSocket || !isConnected) return res.status(503).json({ error: 'WhatsApp no está conectado' });

  let cleanTo = to.replace(/[^0-9]/g, '');
  if (!cleanTo.endsWith('@s.whatsapp.net')) cleanTo += '@s.whatsapp.net';

  try {
    await waSocket.sendMessage(cleanTo, { text: message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trigger-agenda', async (req, res) => {
  try {
    await triggerAgendaWorkflow();
    logActivity('Agenda de mañana enviada por correo a mysa.transportes@gmail.com', 'success');
    res.json({ success: true, message: 'Agenda de traslados enviada a mysa.transportes@gmail.com con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workflow-info/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const url = 'https://mysatransportes.app.n8n.cloud/mcp-server/http';
    const headers = {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzNzU4YWYwZC02NGFjLTRhYzEtODc0YS1mZWEzMjdhZDYzNjMiLCJpc3MiOiJuOG4iLCJqdGkiOiI0Y2ZmMTAwYi04OTdkLTRmZTAtODI1Mi02NWVlMjhmZjJhYjAiLCJpYXQiOjE3OTIzNDYzNjAsImF1ZCI6Im1jcC1zZXJ2ZXItYXBpIn0.iPx1ywtRijh0OLo94cAbxf20m2ThGu6_Wo92XTdzkco',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };
    const initRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', clientInfo: { name: 'admin-panel', version: '1.0' }, capabilities: {} }
      })
    });
    const sessionId = initRes.headers.get('mcp-session-id');
    if (sessionId) headers['mcp-session-id'] = sessionId;

    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_workflow_details',
          arguments: { workflowId: id }
        }
      })
    });
    const txt = await r.text();
    const dataLine = txt.split('\n').find(l => l.startsWith('data: '));
    const json = JSON.parse(dataLine.replace('data: ', ''));
    const parsed = JSON.parse(json.result.content[0].text);
    res.json({ workflow: parsed.workflow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar Servidor Web y WhatsApp Bot con protección Singleton
const server = app.listen(PORT, () => {
  console.log(`\n===============================================================`);
  console.log(` 🚚 PANEL DE CONTROL MYSA TRANSPORTES INICIADO`);
  console.log(` 🌐 Accede desde tu navegador en: http://localhost:${PORT}`);
  console.log(`===============================================================\n`);
  startWhatsAppBot().catch(console.error);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n⚠️ [AVISO DE SEGURIDAD]: El puerto ${PORT} ya está en uso.`);
    console.warn(`👉 Ya hay un proceso de MYSA TRANSPORTES corriendo activamente en este computador.`);
    console.warn(`👉 Este proceso secundario se detendrá para evitar que se dupliquen las conexiones y se caiga WhatsApp.\n`);
    process.exit(0);
  } else {
    console.error('Error en el servidor HTTP:', err);
  }
});
