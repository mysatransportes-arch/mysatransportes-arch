# MYSA TRANSPORTES - Sistema Integral de Control y Automatización

Plataforma unificada para la gestión y control de **MYSA TRANSPORTES**, integrando:
- **WhatsApp Bot (Baileys)**: Atención inmediata de clientes y recepción de mensajes.
- **Centro de Flujos n8n**: 6 workflows automatizados para cotizaciones, reservas, recordatorios y panel de administración.
- **Google Sheets**: Registro automático y persistente de reservas y conversaciones.
- **Panel de Control Web Local**: Dashboard en tiempo real (`http://localhost:3000`) para monitorear el estado, probar la IA y enviar mensajes.

---

## 🚀 Inicio Rápido

En tu terminal (PowerShell o CMD):

```bash
npm start
```

1. **WhatsApp se conectará automáticamente** con tu sesión vinculada en `auth_info_baileys/`.
2. **El Panel de Control Web se levantará en:**
   👉 **[http://localhost:3050](http://localhost:3050)**

---

## 🗂️ Matriz de Workflows n8n Conectados

| # | Workflow | ID n8n | Función principal | Estado |
|---|---|---|---|---|
| **1** | **Crear pestaña Reservas** | `UmCjSgjZk0oU8iDR` | Crea la pestaña *Reservas* con 14 columnas en tu planilla | ✅ Creada en Google Sheets |
| **2** | **Chatbot con Memoria** | `QEvrTVlRY64sVT9U` | Agente Gemini que responde por WhatsApp y guarda en Sheets | ⚡ Enlazado en vivo con WhatsApp |
| **3** | **Formulario Web de Reserva** | `eHpAwlBhtnNoTVZC` | Formulario público de traslados con validación en Google Calendar | 🌐 [Abrir Formulario](https://mysatransportes.app.n8n.cloud/form/reserva-mysa) |
| **4** | **Recordatorio Diario** | `cvVkZ6C0DNzvrB9t` | Cron job a las 18:00 hrs con links de confirmación/cancelación | ⏰ Programado |
| **5** | **Confirmar o Cancelar** | `x0d2yyxNw65KbwEb` | Webhook que actualiza estado en Google Sheets y Calendar | 🔗 Webhook listo |
| **6** | **Panel de Administración** | `zsqk4HXfcdCiBeMu` | Formulario interno para reprogramar o cancelar traslados | 🛠️ Panel operativo |

---

## 🖥️ Funcionalidades del Panel Web (`http://localhost:3050`)
- **Monitoreo de Estado:** WhatsApp Baileys, n8n Cloud y Google Sheets en tiempo real.
- **Simulador de IA:** Envía mensajes de prueba y observa cómo responde el agente de n8n antes de responder a clientes reales.
- **Outbox de WhatsApp:** Envía cotizaciones o avisos directos a cualquier número desde tu computadora.
- **Inspección de Workflows:** Consulta los nodos y configuraciones de cada workflow con un clic.
