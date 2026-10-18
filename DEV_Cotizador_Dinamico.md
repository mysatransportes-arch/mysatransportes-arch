# 💰 DISEÑO TÉCNICO: COTIZADOR DINÁMICO - MYSA TRANSPORTES

## 📌 Objetivo
Automatizar el cálculo de tarifas de traslados basándose en distancia, zona y tipo de carga, permitiendo que el cliente reciba una cotización estimada inmediata vía WhatsApp antes de finalizar la reserva.

## 📐 Lógica de Cálculo (Algoritmo)

La tarifa se calculará mediante la siguiente fórmula:
`Precio Final = Precio Base (Zona) + (Distancia KM * Precio por KM) + Recargo Carga`

### 📊 Componentes de la Tarifa
1. **Precio Base**: Costo fijo según la zona de origen (ej. Santiago: $15.000).
2. **Precio por KM**: Valor variable por kilómetro recorrido (ej. $800/km).
3. **Recargo de Carga**: Porcentaje adicional basado en el volumen/peso (ej. Carga Pesada: +20%).

---

## 🔄 Flujo de Trabajo (Workflow)

### 1. Trigger (Disparador)
El `StateEngine` en el servidor local detecta que se ha completado la captura de `Origen` y `Destino`. Envía una petición al workflow de cotización en n8n.

### 2. Proceso en n8n
- **Nodo de Distancia**: Consulta la API de Google Maps Distance Matrix para obtener los KM exactos.
- **Nodo de Tarifas**: Lee la pestaña `TARIFAS` de Google Sheets para obtener los valores actuales de Base y KM.
- **Nodo de Cálculo**: Ejecuta la fórmula matemática.
- **Nodo de Respuesta**: Formatea la respuesta en un mensaje amable y profesional.

### 3. Salida (Output)
El bot envía al cliente:
> "🚚 *Cotización Estimada:*
> 📍 **Ruta**: [Origen] $\rightarrow$ [Destino]
> 📏 **Distancia**: [X] km
> 💰 **Valor Total**: $[Monto]
> 
> _Este valor es una estimación. ¿Deseas continuar con la fecha y hora de tu reserva?_"

---

## 🛠️ Requerimientos de Implementación

### A. Google Sheets (Infraestructura)
Crear pestaña `TARIFAS` con las columnas:
- `Zona` | `Precio_Base` | `Precio_KM` | `Recargo_Pesada`

### B. Node.js (Servidor Local)
- Modificar `stateManager.js` para insertar la fase de cotización entre el paso de `Destino` y el de `Fecha`.
- Crear endpoint de validación de tarifa en `n8nClient.js`.

### C. n8n (Orquestador)
- Crear nuevo Workflow: `Cotizador_Dinamico_Mysa`.
- Integración con Google Maps API.

---

## ✅ Casos de Prueba (QA)
- **Test 1**: Viaje corto dentro de la misma ciudad (Validar Precio Base).
- **Test 2**: Viaje interregional (Validar Precio por KM).
- **Test 3**: Carga voluminosa (Validar aplicación de recargo).
