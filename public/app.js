// Cliente de control para MYSA TRANSPORTES

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const waStatus = document.getElementById('wa-status-text');
    const waSub = document.getElementById('wa-sub-text');
    if (data.whatsapp?.connected) {
      waStatus.innerText = 'Conectado';
      waStatus.style.color = '#34d399';
      waSub.innerText = data.whatsapp.user || 'Línea de Mysa Transportes';
    } else {
      waStatus.innerText = 'Desconectado';
      waStatus.style.color = '#f87171';
      waSub.innerText = 'Escaneo de QR requerido';
    }

    const n8nStatus = document.getElementById('n8n-status-text');
    if (data.n8n?.connected) {
      n8nStatus.innerText = 'Conectado';
      n8nStatus.style.color = '#34d399';
    }
  } catch (err) {
    console.error('Error obteniendo estado del sistema:', err);
  }
}

// Simulador de Chat con n8n
async function handleSendChat(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('btn-chat-send');
  const text = input.value.trim();
  if (!text) return;

  const role = document.getElementById('chat-role')?.value || 'client';
  const isAdmin = role === 'admin';

  appendChatMessage('user', `${isAdmin ? '👑 Meyrilin: ' : ''}${text}`);
  input.value = '';
  btn.disabled = true;
  btn.innerText = 'Pensando...';

  addConsoleLog(`[Simulador] (${isAdmin ? 'Rol Administradora' : 'Rol Cliente'}) Enviando a n8n: "${text}"`, 'info');

  try {
    const res = await fetch('/api/test-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, isAdmin })
    });
    const data = await res.json();

    if (data.response) {
      appendChatMessage('bot', `🚚 <strong>Asistente Mysa Transportes:</strong> ${data.response}`);
      addConsoleLog(`[Simulador] Respuesta recibida de Gemini y guardada en Sheets.`, 'success');
    } else {
      appendChatMessage('bot', '⚠️ No se pudo obtener respuesta de n8n en este momento.');
      addConsoleLog(`[Simulador] Error o timeout en n8n: ${data.error || 'Desconocido'}`, 'warn');
    }
  } catch (err) {
    appendChatMessage('bot', '❌ Error de conexión con el servidor.');
    addConsoleLog(`[Simulador] Error de red: ${err.message}`, 'warn');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Enviar';
  }
}

function appendChatMessage(sender, htmlContent) {
  const container = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${sender}`;
  msgDiv.innerHTML = `<div class="bubble">${htmlContent}</div>`;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function testChatPrompt(promptText) {
  document.getElementById('chat-input').value = promptText;
  document.getElementById('chat-form').dispatchEvent(new Event('submit'));
}

// Enviar WhatsApp desde el panel
async function handleSendWhatsApp(e) {
  e.preventDefault();
  const dest = document.getElementById('wa-dest').value.trim();
  const msg = document.getElementById('wa-msg').value.trim();
  const feedback = document.getElementById('wa-send-feedback');
  const btn = document.getElementById('btn-wa-send');

  if (!dest || !msg) return;

  btn.disabled = true;
  feedback.innerText = 'Enviando...';
  feedback.style.color = '#38bdf8';

  try {
    const res = await fetch('/api/send-wa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: dest, message: msg })
    });
    const data = await res.json();

    if (data.success) {
      feedback.innerText = '✅ Mensaje enviado exitosamente';
      feedback.style.color = '#34d399';
      addConsoleLog(`[WhatsApp Outbox] Mensaje enviado a ${dest}`, 'success');
      document.getElementById('wa-msg').value = '';
    } else {
      feedback.innerText = `❌ Error: ${data.error || 'No enviado'}`;
      feedback.style.color = '#f87171';
      addConsoleLog(`[WhatsApp Outbox] Falló envío a ${dest}: ${data.error}`, 'warn');
    }
  } catch (err) {
    feedback.innerText = '❌ Error de red';
    feedback.style.color = '#f87171';
  } finally {
    btn.disabled = false;
    setTimeout(() => { feedback.innerText = ''; }, 4000);
  }
}

// Inspeccionar un workflow
async function runWorkflowDetails(workflowId) {
  addConsoleLog(`[n8n] Consultando detalles del workflow ${workflowId}...`, 'info');
  try {
    const res = await fetch(`/api/workflow-info/${workflowId}`);
    const data = await res.json();
    if (data.workflow) {
      alert(`Workflow: ${data.workflow.name}\nNodos (${data.workflow.nodes.length}):\n${data.workflow.nodes.map(n => '• ' + n.name + ' (' + n.type + ')').join('\n')}`);
      addConsoleLog(`[n8n] Workflow ${data.workflow.name} verificado.`, 'success');
    } else {
      alert(`No se pudo obtener la información: ${data.error || 'Error'}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function runWorkflowTest(workflowId) {
  runWorkflowDetails(workflowId);
}

function addConsoleLog(message, type = 'info') {
  const box = document.getElementById('console-logs');
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const time = new Date().toLocaleTimeString();
  line.innerText = `[${time}] ${message}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function fetchRecentLogs() {
  addConsoleLog('Sincronizando estado con n8n Cloud y Baileys...', 'info');
  fetchStatus();
}

async function fetchMedia() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();
    const container = document.getElementById('media-gallery');

    if (!data.media || data.media.length === 0) {
      container.innerHTML = '<p class="empty-hint">Aún no se han recibido audios ni fotos.</p>';
      return;
    }

    container.innerHTML = '';
    data.media.slice(0, 8).forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'media-item';

      if (item.type === 'audio') {
        itemDiv.innerHTML = `
          <div class="media-title">🎙️ Nota de voz (${new Date(item.time).toLocaleTimeString()})</div>
          <audio controls src="${item.url}" class="audio-player"></audio>
        `;
      } else if (item.type === 'image') {
        itemDiv.innerHTML = `
          <div class="media-title">🖼️ Foto (${new Date(item.time).toLocaleTimeString()})</div>
          <a href="${item.url}" target="_blank">
            <img src="${item.url}" alt="Foto recibida" class="media-thumb">
          </a>
        `;
      }
      container.appendChild(itemDiv);
    });
  } catch (err) {
    console.error('Error cargando multimedia:', err);
  }
}

// Inicializar y chequear periódicamente
fetchStatus();
fetchMedia();
setInterval(fetchStatus, 10000);
setInterval(fetchMedia, 15000);

async function triggerDailyAgenda() {
  const btn = document.getElementById('btn-trigger-agenda');
  const feedback = document.getElementById('agenda-feedback');
  if (btn) btn.disabled = true;
  if (feedback) {
    feedback.style.color = 'var(--accent-cyan)';
    feedback.textContent = '⏳ Procesando traslados con Google Sheets y Calendario...';
  }

  try {
    const res = await fetch('/api/trigger-agenda', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (feedback) {
        feedback.style.color = '#00e676';
        feedback.textContent = '✅ ' + (data.message || 'Agenda enviada exitosamente a mysa.transportes@gmail.com');
      }
      fetchStatus();
    } else {
      if (feedback) {
        feedback.style.color = '#ff5252';
        feedback.textContent = '⚠️ ' + (data.error || 'Error al ejecutar la agenda');
      }
    }
  } catch (err) {
    if (feedback) {
      feedback.style.color = '#ff5252';
      feedback.textContent = '⚠️ Error de conexión: ' + err.message;
    }
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (feedback) feedback.textContent = '';
    }, 7000);
  }
}
