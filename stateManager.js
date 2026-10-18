/**
 * StateManager - Gestor de Estados de Conversación para MYSA TRANSPORTES
 *
 * Este módulo permite que el bot recuerde en qué paso de un proceso se encuentra un usuario,
 * evitando que el cliente olvide datos y permitiendo flujos guiados.
 */

const userStates = new Map();

const STATES = {
  IDLE: 'IDLE', // Esperando interacción general
  BOOKING: 'BOOKING', // En proceso de captura de reserva
  ADMIN_EDIT: 'ADMIN_EDIT', // Meyrilin editando una reserva específica
};

const BOOKING_STEPS = [
  { field: 'origen', question: '🚚 *Perfecto. Para comenzar, ¿desde dónde sería la carga? (Ciudad/Comuna)*' },
  { field: 'destino', question: '📍 *Entendido. ¿Cuál es el destino del traslado (Ciudad/Comuna)?*' },
  { field: 'fecha', question: '📅 *¿Para qué fecha y hora aproximada necesitas el servicio?*' },
  { field: 'carga', question: '📦 *Por último, cuéntame qué tipo de carga es y el volumen aproximado (ej: muebles, pallets, cajas).*' },
];

export function getState(jid) {
  return userStates.get(jid) || { state: STATES.IDLE, step: 0, data: {} };
}

export function setState(jid, state, step = 0, data = {}) {
  userStates.set(jid, { state, step, data });
}

export function updateBookingData(jid, value) {
  const current = getState(jid);
  const field = BOOKING_STEPS[current.step].field;

  const newData = { ...current.data, [field]: value };
  const nextStep = current.step + 1;

  setState(jid, STATES.BOOKING, nextStep, newData);
  return {
    field,
    nextStep,
    isComplete: nextStep >= BOOKING_STEPS.length,
    newData
  };
}

export function getNextBookingQuestion() {
  const current = getState(); // This is a placeholder, logic handled in index.js
  return ' la pregunta';
}

export function getBookingQuestion(step) {
  if (step >= 0 && step < BOOKING_STEPS.length) {
    return BOOKING_STEPS[step].question;
  }
  return null;
}

export function clearState(jid) {
  userStates.delete(jid);
}

export { STATES, BOOKING_STEPS };
