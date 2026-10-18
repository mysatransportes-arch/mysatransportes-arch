import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEDIA_DIR = path.join(__dirname, 'public', 'media');
const AUDIOS_DIR = path.join(MEDIA_DIR, 'audios');
const IMAGES_DIR = path.join(MEDIA_DIR, 'images');

// Crear carpetas si no existen
if (!fs.existsSync(AUDIOS_DIR)) fs.mkdirSync(AUDIOS_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Inicializar cliente Gemini si existe la API Key
let aiClient = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.error('[Multimodal] Error inicializando cliente Gemini:', err.message);
  }
}

/**
 * Procesa mensajes multimedia (audios de voz, fotos, documentos)
 * @param {object} msg - Objeto mensaje de Baileys
 * @param {string} senderName - Nombre del remitente
 * @returns {Promise<{ text: string, mediaUrl?: string, type: string }|null>}
 */
export async function processMediaMessage(msg, senderName = 'Cliente') {
  if (!msg.message) return null;

  const timestamp = Date.now();
  const isAudio = Boolean(msg.message.audioMessage);
  const isImage = Boolean(msg.message.imageMessage);
  const isDocument = Boolean(msg.message.documentMessage);

  if (!isAudio && !isImage && !isDocument) {
    return null; // Es un mensaje de texto normal
  }

  try {
    console.log(`\n📥 Descargando archivo multimedia recibido de ${senderName}...`);
    const buffer = await downloadMediaMessage(msg, 'buffer', {});

    // 1. Procesamiento de Audios / Notas de Voz
    if (isAudio) {
      const filename = `audio_${timestamp}.ogg`;
      const filepath = path.join(AUDIOS_DIR, filename);
      fs.writeFileSync(filepath, buffer);
      const mediaUrl = `/media/audios/${filename}`;
      const duration = msg.message.audioMessage.seconds || 0;

      console.log(`🎙️ Nota de voz guardada (${duration}s): ${mediaUrl}`);

      if (aiClient) {
        console.log('🤖 Transcribiendo audio con Google Gemini...');
        try {
          const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'audio/ogg',
                  data: buffer.toString('base64')
                }
              },
              'Eres el transcriptor del sistema de Mysa Transportes (Chile). Transcribe exactamente en español chileno lo que dice el cliente en este audio. Si pide cotizar o da direcciones (origen, destino, carga), asegúrate de reflejarlo claramente en la transcripción.'
            ]
          });

          const transcription = response.text ? response.text.trim() : '';
          console.log(`📝 Transcripción obtenida: "${transcription}"`);

          return {
            type: 'audio',
            mediaUrl,
            text: `[Nota de voz de ${senderName} (${duration}s)]: "${transcription}"`
          };
        } catch (genAiErr) {
          console.error('[Multimodal] Error al transcribir con Gemini:', genAiErr.message);
        }
      }

      // Si no hay API key o falló
      return {
        type: 'audio',
        mediaUrl,
        text: `[Nota de voz de ${senderName} (${duration}s recibida]: El cliente envió un audio de voz. (Audio disponible en el panel web).`
      };
    }

    // 2. Procesamiento de Imágenes / Fotos
    if (isImage) {
      const filename = `img_${timestamp}.jpg`;
      const filepath = path.join(IMAGES_DIR, filename);
      fs.writeFileSync(filepath, buffer);
      const mediaUrl = `/media/images/${filename}`;
      const caption = (msg.message.imageMessage.caption || '').trim();

      console.log(`🖼️ Imagen guardada: ${mediaUrl}`);

      if (aiClient) {
        console.log('🤖 Analizando contenido de la imagen con Google Gemini...');
        try {
          const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: buffer.toString('base64')
                }
              },
              `Analiza esta imagen enviada por un cliente a Mysa Transportes. Indica detalladamente qué se observa (por ejemplo: si es una guía de despacho, remito, etiqueta de envío, bulto o tipo de carga, dirección, patente o vehículo). Extrae todos los datos útiles como direcciones, remitente, destinatario o tipo de carga. ${caption ? 'El cliente añadió este texto: ' + caption : ''}`
            ]
          });

          const analysis = response.text ? response.text.trim() : '';
          console.log(`🔍 Análisis visual: "${analysis.slice(0, 100)}..."`);

          return {
            type: 'image',
            mediaUrl,
            text: `[Foto enviada por ${senderName}]: ${analysis}${caption ? ' (Comentario: ' + caption + ')' : ''}`
          };
        } catch (genAiErr) {
          console.error('[Multimodal] Error al analizar imagen con Gemini:', genAiErr.message);
        }
      }

      return {
        type: 'image',
        mediaUrl,
        text: `[Foto enviada por ${senderName}]: ${caption ? 'Comentario: ' + caption : 'El cliente adjuntó una imagen.'} (Ver en el panel web)`
      };
    }

    // 3. Documentos (PDF, etc.)
    if (isDocument) {
      const docName = msg.message.documentMessage.fileName || `doc_${timestamp}.pdf`;
      const filepath = path.join(MEDIA_DIR, docName);
      fs.writeFileSync(filepath, buffer);
      return {
        type: 'document',
        mediaUrl: `/media/${docName}`,
        text: `[Documento adjunto de ${senderName}]: ${docName}`
      };
    }
  } catch (err) {
    console.error('[Multimodal] Error descargando o procesando archivo:', err);
    return null;
  }

  return null;
}

/**
 * Obtiene la lista de medios recientes guardados en el servidor
 */
export function getRecentMedia() {
  const audios = fs.existsSync(AUDIOS_DIR)
    ? fs.readdirSync(AUDIOS_DIR).map(f => ({ name: f, type: 'audio', url: `/media/audios/${f}`, time: fs.statSync(path.join(AUDIOS_DIR, f)).mtime }))
    : [];

  const images = fs.existsSync(IMAGES_DIR)
    ? fs.readdirSync(IMAGES_DIR).map(f => ({ name: f, type: 'image', url: `/media/images/${f}`, time: fs.statSync(path.join(IMAGES_DIR, f)).mtime }))
    : [];

  return [...audios, ...images].sort((a, b) => b.time - a.time).slice(0, 30);
}
