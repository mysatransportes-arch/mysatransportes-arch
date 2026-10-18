// Cliente de integración con n8n MCP Server para MYSA TRANSPORTES

import dotenv from 'dotenv';
dotenv.config();

const N8N_MCP_URL = process.env.N8N_MCP_URL;
const N8N_BEARER_TOKEN = process.env.N8N_BEARER_TOKEN;
const WORKFLOW_ID = process.env.N8N_MAIN_WORKFLOW_ID;

let mcpSessionId = null;

async function getMcpHeaders() {
  const headers = {
    'Authorization': N8N_BEARER_TOKEN,
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };

  if (!mcpSessionId) {
    try {
      const initRes = await fetch(N8N_MCP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            clientInfo: { name: 'mysa-whatsapp-bot', version: '1.0' },
            capabilities: {}
          }
        })
      });
      const sid = initRes.headers.get('mcp-session-id');
      if (sid) {
        mcpSessionId = sid;
      }
    } catch (e) {
      console.error('[n8n] Error inicializando sesión MCP:', e.message);
    }
  }

  if (mcpSessionId) {
    headers['mcp-session-id'] = mcpSessionId;
  }

  return headers;
}

async function fetchWithRetry(url, options, retries = 3, backoff = 1500) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`[n8n] Error de conexión. Reintentando en ${backoff}ms... (${retries} reintentos restantes)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

/**
 * Envía el mensaje del usuario al workflow de n8n y devuelve la respuesta del asistente AI.
 * @param {string} userMessage - Mensaje enviado por el cliente en WhatsApp
 * @param {string} senderName - Nombre del remitente
 * @returns {Promise<string|null>} - Respuesta generada por n8n o null en caso de fallo
 */
export async function askN8nWorkflow(userMessage, senderName = '', isAdmin = false, clientPhone = '') {
  try {
    const headers = await getMcpHeaders();

    let promptToSend = userMessage;
    if (isAdmin) {
      promptToSend = `[ROL: MEYRILIN - JEFA Y ADMINISTRADORA DE MYSA TRANSPORTES]: "${userMessage}"\n(INSTRUCCIÓN OBLIGATORIA DEL SISTEMA: Estás conversando directamente con Meyrilin, la dueña y jefa general de Mysa Transportes en Chile. Trátala con respeto y profesionalismo como su copiloto y asistente de operaciones de alto nivel. NUNCA le hables como si fuera una clienta, NUNCA le pidas datos para cotizar un flete y NUNCA le ofrezcas que un ejecutivo la contacte, pues ella es la jefa. Asístela con cálculos de tarifas y costos por km en Chile, gestión de choferes, estado de reservas y administración de su flota).`;
    } else {
      promptToSend = `[CLIENTE: ${senderName}${clientPhone ? ' | Teléfono WhatsApp: +' + clientPhone : ''}]: "${userMessage}"\n(CONTEXTO OPERATIVO: Eres el asistente virtual de Mysa Transportes en Chile. Respondes con amabilidad, rapidez y claridad. Si el cliente consulta por fletes o traslados, pide origen, destino, fecha y tipo de carga. Si el cliente quiere agendar online por su cuenta, también puedes facilitarle el link de autoservicio: https://mysatransportes.app.n8n.cloud/form/reserva-mysa)`;
    }

    // Usamos la nueva función de reintento inteligente
    const execRes = await fetchWithRetry(N8N_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'execute_workflow',
          arguments: {
            workflowId: WORKFLOW_ID,
            executionMode: 'production',
            triggerNodeName: 'Chat de prueba',
            inputs: {
              chatInput: promptToSend
            }
          }
        }
      })
    });


    const execTxt = await execRes.text();
    const execDataLine = execTxt.split('\n').find(l => l.startsWith('data: '));
    if (!execDataLine) {
      console.error('[n8n] Respuesta inesperada al ejecutar workflow:', execTxt);
      return null;
    }

    const execJson = JSON.parse(execDataLine.replace('data: ', ''));
    if (execJson.isError) {
      console.error('[n8n] Error al iniciar ejecución:', execJson.result?.content?.[0]?.text);
      return null;
    }

    const rawContent = execJson.result?.content?.[0]?.text;
    const parsedContent = typeof rawContent === 'string' ? JSON.parse(rawContent) : (execJson.result?.structuredContent || {});
    const executionId = parsedContent.executionId;

    if (!executionId) {
      console.error('[n8n] No se obtuvo executionId');
      return null;
    }

    // 2. Consultar el estado y resultado de la ejecución (polling)
    const startTime = Date.now();
    const timeoutMs = 20000; // Máximo 20 segundos

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(res => setTimeout(res, 1200));

      const pollRes = await fetch(N8N_MCP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'get_workflow_execution',
            arguments: {
              workflowId: WORKFLOW_ID,
              executionId: executionId,
              includeData: true
            }
          }
        })
      });

      const pollTxt = await pollRes.text();
      const pollDataLine = pollTxt.split('\n').find(l => l.startsWith('data: '));
      if (!pollDataLine) continue;

      const pollJson = JSON.parse(pollDataLine.replace('data: ', ''));
      const parsedPoll = JSON.parse(pollJson.result?.content?.[0]?.text || '{}');
      const status = parsedPoll.execution?.status;

      if (status === 'success') {
        const runData = parsedPoll.data?.resultData?.runData;
        const agentOutput = runData?.['Asistente Mysa Transportes']?.[0]?.data?.main?.[0]?.[0]?.json?.output;
        const savedBooking = runData?.['save_booking']?.[0]?.data?.main?.[0]?.[0]?.json || null;
        if (agentOutput) {
          return {
            text: agentOutput,
            booking: savedBooking
          };
        }
      } else if (status === 'error') {
        console.error('[n8n] La ejecución falló:', parsedPoll.error);
        return null;
      }
    }

    console.warn('[n8n] Tiempo de espera agotado para la respuesta de n8n');
    return null;
  } catch (error) {
    console.error('[n8n] Excepción al consultar n8n:', error.message);
    return null;
  }
}

/**
 * Dispara el workflow de agenda diaria y recordatorio de traslados a clientes y Meyrilin
 */
export async function triggerAgendaWorkflow() {
  try {
    const headers = await getMcpHeaders();
    const res = await fetch(N8N_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'execute_workflow',
          arguments: {
            workflowId: 'cvVkZ6C0DNzvrB9t',
            executionMode: 'production',
            triggerNodeName: 'Todos los días 18:00'
          }
        }
      })
    });
    const txt = await res.text();
    const line = txt.split('\n').find(l => l.startsWith('data: '));
    if (!line) throw new Error('Respuesta inesperada de n8n');
    const json = JSON.parse(line.replace('data: ', ''));
    if (json.isError) throw new Error(json.result?.content?.[0]?.text || 'Error ejecutando agenda');
    return true;
  } catch (err) {
    console.error('[n8n] Error ejecutando triggerAgendaWorkflow:', err.message);
    throw err;
  }
}

/**
 * Calcula una cotización dinámica estimada basada en origen, destino y carga
 */
export async function getDynamicQuote(origen, destino, tipoCarga = 'General') {
  const normOrig = (origen || '').toLowerCase();
  const normDest = (destino || '').toLowerCase();

  let basePrice = 25000;
  let kmEst = 25;

  if ((normOrig.includes('santiago') && normDest.includes('rancagua')) || (normOrig.includes('rancagua') && normDest.includes('santiago'))) {
    kmEst = 85;
    basePrice = 35000;
  } else if ((normOrig.includes('santiago') && (normDest.includes('viña') || normDest.includes('valparaíso') || normDest.includes('valparaiso'))) ||
             ((normOrig.includes('viña') || normOrig.includes('valparaíso')) && normDest.includes('santiago'))) {
    kmEst = 120;
    basePrice = 35000;
  } else if (normOrig.includes('santiago') && normDest.includes('santiago')) {
    kmEst = 25;
    basePrice = 25000;
  } else {
    kmEst = 35;
    basePrice = 30000;
  }

  const pricePerKm = 850;
  let total = basePrice + (kmEst * pricePerKm);

  const normCarga = (tipoCarga || '').toLowerCase();
  let recargoTexto = '';
  if (normCarga.includes('pesad') || normCarga.includes('palet') || normCarga.includes('pallet') || normCarga.includes('maquinaria')) {
    total = Math.round(total * 1.25);
    recargoTexto = ' (+25% por carga pesada)';
  } else if (normCarga.includes('mudanza')) {
    total = Math.round(total * 1.20);
    recargoTexto = ' (+20% por servicio de mudanza)';
  }

  total = Math.round(total / 1000) * 1000;

  return {
    distanciaKm: kmEst,
    precioBase: basePrice,
    precioFinal: total,
    moneda: 'CLP',
    mensaje: `🚚 *Cotización Estimada:*\n📍 *Ruta:* ${origen} ➔ ${destino}\n📏 *Distancia aprox:* ~${kmEst} km\n💰 *Tarifa estimada:* $${total.toLocaleString('es-CL')} CLP${recargoTexto}\n\n_Esta tarifa es referencial y se confirma al agendar._`
  };
}

