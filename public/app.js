/**
 * app.js - Lógica del Frontend para MYSA TRANSPORTES
 * Gestión de monitoreo, simulador de IA y centro de despacho logístico.
 */

async function updateStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        const waStatus = document.getElementById('wa-status-text');
        const waSub = document.getElementById('wa-sub-text');
        if (waStatus && waSub) {
            waStatus.innerText = data.whatsapp.connected ? 'Conectado' : 'Desconectado';
            waSub.innerText = data.whatsapp.user ? `Sesión: ${data.whatsapp.user}` : 'Sin sesión activa';
        }

        const logsContainer = document.getElementById('console-logs');
        if (logsContainer) {
            logsContainer.innerHTML = '';
            data.logs.forEach(log => {
                const div = document.createElement('div');
                div.className = `log-line ${log.type}`;
                div.innerText = `[${log.timestamp}] ${log.text}`;
                logsContainer.appendChild(div);
            });
        }
    } catch (e) {
        console.error('Error actualizando status:', e);
    }
}

async function handleSendChat(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const messagesContainer = document.getElementById('chat-messages');
    const role = document.getElementById('chat-role')?.value || 'client';
    const text = input.value.trim();
    if (!text) return;

    const userDiv = document.createElement('div');
    userDiv.className = 'chat-msg user';
    userDiv.innerHTML = `<div class="bubble">${text}</div>`;
    messagesContainer.appendChild(userDiv);
    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const res = await fetch('/api/test-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, isAdmin: role === 'admin' })
        });
        const data = await res.json();

        const botDiv = document.createElement('div');
        botDiv.className = 'chat-msg bot';
        botDiv.innerHTML = `<div class="bubble">🚚 <strong>Asistente:</strong> ${data.response}</div>`;
        messagesContainer.appendChild(botDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (e) {
        console.error('Error en chat:', e);
    }
}

async function handleSendWhatsApp(event) {
    event.preventDefault();
    const to = document.getElementById('wa-dest').value;
    const msg = document.getElementById('wa-msg').value;
    const feedback = document.getElementById('wa-send-feedback');

    try {
        const res = await fetch('/api/send-wa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, message: msg })
        });
        const data = await res.json();
        if (data.success) {
            feedback.innerText = '✅ Mensaje enviado con éxito';
            feedback.style.color = '#34d399';
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        feedback.innerText = '❌ Error: ' + e.message;
        feedback.style.color = '#ef4444';
    }
}

async function triggerDailyAgenda() {
    const btn = document.getElementById('btn-trigger-agenda');
    const feedback = document.getElementById('agenda-feedback');
    if (btn) btn.disabled = true;
    if (feedback) {
        feedback.innerText = '⏳ Procesando agenda...';
        feedback.style.color = 'var(--accent-cyan)';
    }

    try {
        const res = await fetch('/api/trigger-agenda', { method: 'POST' });
        const data = await res.json();
        if (feedback) {
            feedback.innerText = data.message;
            feedback.style.color = '#34d399';
        }
    } catch (e) {
        if (feedback) {
            feedback.innerText = '❌ Error al enviar agenda';
            feedback.style.color = '#ef4444';
        }
    } finally {
        if (btn) btn.disabled = false;
        if (feedback) {
            setTimeout(() => { feedback.innerText = ''; }, 7000);
        }
    }
}

async function fetchMedia() {
    const gallery = document.getElementById('media-gallery');
    if (!gallery) return;
    try {
        const res = await fetch('/api/media');
        const data = await res.json();
        gallery.innerHTML = '';
        if (!data.media || data.media.length === 0) {
            gallery.innerHTML = '<p class="empty-hint">Aún no se han recibido archivos multimedia.</p>';
            return;
        }
        data.media.forEach(item => {
            const div = document.createElement('div');
            div.className = 'media-item';
            div.innerHTML = `
                <span class="media-title">${item.name}</span>
                ${item.type === 'audio'
                    ? `<audio controls src="${item.url}" class="audio-player"></audio>`
                    : `<img src="${item.url}" class="media-thumb">`}
            `;
            gallery.appendChild(div);
        });
    } catch (e) {
        console.error('Error cargando media:', e);
    }
}

// --- MÓDULO DE DESPACHO LOGÍSTICO (NUEVO) ---

async function loadPendingReservations() {
    const tbody = document.getElementById('pending-reservations-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1rem;">Cargando reservas...</td></tr>';

    try {
        const res = await fetch('/api/reservas-pendientes');
        const data = await res.json();

        tbody.innerHTML = '';
        if (!data.reservas || data.reservas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1rem;">🎉 No hay reservas pendientes de asignación.</td></tr>';
            return;
        }

        data.reservas.forEach(reserva => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--border-color)';
            row.innerHTML = `
                <td style="padding: 0.75rem;">
                    <strong style="color: var(--text-primary)">${reserva.clientes?.nombre || 'Cliente'}</strong><br>
                    <span style="font-size: 0.75rem; color: var(--text-secondary)">${reserva.origen} $\rightarrow$ ${reserva.destino}</span>
                </td>
                <td style="padding: 0.75rem;">${reserva.fecha_traslado} <br> <span style="font-size: 0.75rem;">${reserva.hora_traslado || 'S/H'}</span></td>
                <td style="padding: 0.75rem;">${reserva.tipo_carga || 'General'}</td>
                <td style="padding: 0.75rem;">
                    <button class="btn-sm" style="background: var(--accent-blue); color: white;" onclick="openDriverSelector('${reserva.id}')">Asignar Chofer</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--accent-amber);">Error cargando reservas</td></tr>';
    }
}

async function openDriverSelector(reservaId) {
    try {
        const res = await fetch('/api/choferes');
        const data = await res.json();
        const choferes = data.choferes;

        if (!choferes || choferes.length === 0) {
            alert('❌ No hay choferes registrados en la base de datos.');
            return;
        }

        let optionsList = choferes.map((c, i) => `${i+1}. ${c.nombre} [${c.estado}]`).join('\n');
        const choice = prompt(`🚚 ASIGNACIÓN DE CHOFER\n\nSelecciona el número del chofer para esta reserva:\n\n${optionsList}`, '1');

        if (choice && choferes[parseInt(choice)-1]) {
            const selectedChofer = choferes[parseInt(choice)-1];
            await assignDriver(reservaId, selectedChofer.id);
        }
    } catch (e) {
        alert('Error al cargar choferes: ' + e.message);
    }
}

async function assignDriver(reservaId, choferId) {
    try {
        const res = await fetch('/api/asignar-chofer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservaId, choferId })
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ Chofer asignando y notificado vía WhatsApp exitosamente');
            loadPendingReservations();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (e) {
        alert('Error en el proceso de asignación');
    }
}

// Inicialización Global
document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    setInterval(updateStatus, 30000);
    fetchMedia();

    // Inyectar la UI del Centro de Despacho dinámicamente
    const dashboardBody = document.querySelector('.dashboard-//... (etc)
