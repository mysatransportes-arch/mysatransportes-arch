# 🎨 DISEÑO TÉCNICO: PANEL DE DESPACHO LOGÍSTICO

## 📌 Objetivo
Transformar el Panel de Control de una herramienta de monitoreo pasivo a una herramienta de gestión activa, permitiendo la asignación de choferes a reservas pendientes de forma visual y rápida.

## 📐 Flujo de Usuario (User Experience)
1. **Visualización**: Meyrilin accede al panel y ve una tabla de "Reservas Pendientes".
2. **Selección**: Hace clic en una reserva específica.
3. **Asignación**: Se despliega un selector con los choferes marcados como "Disponible" en Supabase.
4. **Ejecución**: Al hacer clic en "Asignar", el sistema:
   - Actualiza el estado de la reserva en Supabase a `Asignado`.
   - Cambia el estado del chofer a `En Viaje`.
   - Envía el WhatsApp automático al conductor con la hoja de ruta.
5. **Feedback**: La reserva desaparece de la lista de pendientes y el panel muestra una notificación de éxito.

---

## 🛠️ Especificaciones Técnicas

### A. Nuevos Endpoints de API
- `GET /api/reservas-pendientes`: Retorna reservas donde `estado_viaje = 'Pendiente'`.
- `GET /api/choferes`: Retorna la lista de conductores y su estado.
- `POST /api/asignar-chofer`: Procesa la vinculación y dispara la notificación.

### B. Elementos de UI (Frontend)
- **`dispatch-container`**: Contenedor principal del módulo de despacho.
- **`pending-table`**: Tabla dinámica con filtrado rápido.
- **`driver-selector`**: Modal o dropdown con validación de disponibilidad.

---

## ✅ Criterios de Aceptación (QA)
- [ ] La lista de reservas se actualiza automáticamente cada 60 segundos.
- [ ] No se puede asignar un chofer que ya esté en estado "En Viaje".
- [ ] El mensaje de WhatsApp llega al chofer en menos de 5 segundos tras la asignación.
- [ ] El estado de la reserva cambia instantáneamente en Supabase.
