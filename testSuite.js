import { getState, setState, updateBookingData, clearState, STATES } from './stateManager.js';
import { askN8nWorkflow, getDynamicQuote } from './n8nClient.js';
import { supabase, saveBookingToDb } from './supabaseClient.js';

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 INICIANDO BATERÍA DE PRUEBAS - MYSA TRANSPORTES');
  console.log('===============================================================\n');

  const tests = [
    {
      name: 'Validación de Estado Inicial (IDLE)',
      test: async () => {
        const jid = 'test_user_1@s.whatsapp.net';
        clearState(jid);
        const state = getState(jid);
        return state.state === STATES.IDLE;
      }
    },
    {
      name: 'Flujo de Captura de Reserva (Step-by-Step: Origen -> Destino -> Fecha -> Carga)',
      test: async () => {
        const jid = 'test_user_2@s.whatsapp.net';
        clearState(jid);
        setState(jid, STATES.BOOKING, 0, {});

        const steps = ['Santiago', 'Valparaíso', '2026-11-01 10:00', '10 cajas de ropa'];
        let currentStep = 0;

        for (const val of steps) {
          const update = updateBookingData(jid, val);
          if (update.nextStep !== currentStep + 1) return false;
          currentStep = update.nextStep;
        }

        const finalState = getState(jid);
        return finalState.data.origen === 'Santiago' &&
               finalState.data.destino === 'Valparaíso' &&
               finalState.data.fecha === '2026-11-01 10:00' &&
               finalState.data.carga === '10 cajas de ropa';
      }
    },
    {
      name: 'Cálculo de Cotizador Dinámico (Ruta Santiago - Viña/Valparaíso con recargo)',
      test: async () => {
        const quoteNormal = await getDynamicQuote('Santiago', 'Valparaíso', 'Cajas normales');
        const quoteHeavy = await getDynamicQuote('Santiago', 'Valparaíso', 'Carga pesada / pallets');

        // Santiago - Valparaíso son aprox 120km
        // Tarifa pesada debe ser mayor que tarifa normal
        const validPrice = quoteNormal.precioFinal > 30000;
        const validSurcharge = quoteHeavy.precioFinal > quoteNormal.precioFinal;
        return validPrice && validSurcharge && quoteNormal.distanciaKm === 120;
      }
    },
    {
      name: 'Resiliencia de Supabase (Inicialización segura sin caídas)',
      test: async () => {
        // saveBookingToDb no debe lanzar excepciones no controladas
        const res = await saveBookingToDb({
          origen: 'Test Origen',
          destino: 'Test Destino'
        });
        // Si no está configurado devuelve null ordenadamente sin botar el proceso
        return res === null || typeof res === 'object';
      }
    },
    {
      name: 'Integración con n8n y Manejo de Respuestas / Contingencia',
      test: async () => {
        try {
          const result = await askN8nWorkflow('Hola, ¿están disponibles?', 'Test User', false, '56912345678');
          // Si n8n responde, retorna el objeto; si está en rate-limit (429), askN8nWorkflow devuelve null
          // En ambos casos la llamada debe completarse limpiamente sin excepciones
          return true;
        } catch (e) {
          console.error('Excepción no capturada en n8n:', e.message);
          return false;
        }
      }
    }
  ];

  let passed = 0;
  for (const t of tests) {
    process.stdout.write(`Testing: ${t.name}... `);
    try {
      const result = await t.test();
      if (result) {
        console.log('✅ PASSED');
        passed++;
      } else {
        console.log('❌ FAILED');
      }
    } catch (e) {
      console.log(`❌ ERROR: ${e.message}`);
    }
  }

  console.log('\n===============================================================');
  console.log(`📊 RESULTADO FINAL: ${passed}/${tests.length} PRUEBAS EXITOSAS`);
  console.log('===============================================================\n');

  return passed === tests.length;
}

export { runTests };

