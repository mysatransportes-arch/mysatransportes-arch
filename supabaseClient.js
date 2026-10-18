import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let client = null;

if (supabaseUrl && supabaseKey) {
  try {
    client = createClient(supabaseUrl, supabaseKey);
    console.log('[Supabase] ✅ Cliente inicializado correctamente.');
  } catch (err) {
    console.error('[Supabase] ⚠️ Error inicializando cliente:', err.message);
  }
} else {
  console.warn('[Supabase] ℹ️ SUPABASE_URL o SUPABASE_KEY no configurados en .env (Modo Sheets/Local activo).');
}

// Fallback seguro para evitar caídas si no hay credenciales configuradas
const dummyQueryBuilder = {
  select: () => dummyQueryBuilder,
  insert: () => Promise.resolve({ data: null, error: new Error('Supabase no configurado en .env') }),
  update: () => dummyQueryBuilder,
  upsert: () => dummyQueryBuilder,
  eq: () => dummyQueryBuilder,
  single: () => Promise.resolve({ data: null, error: new Error('Supabase no configurado en .env') })
};

export const supabase = client || {
  from: () => dummyQueryBuilder
};

/**
 * Helper para guardar una reserva en Supabase
 * Implementa la estrategia de "Escritura Dual"
 */
export async function saveBookingToDb(bookingData) {
  if (!client) {
    console.warn('[Supabase] ℹ️ Omitiendo guardado en base de datos: Supabase no está configurado en .env.');
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('reservas')
      .insert([bookingData])
      .select();

    if (error) throw error;

    console.log('[Supabase] ✅ Reserva guardada exitosamente en base de datos');
    return data[0];
  } catch (error) {
    console.error('[Supabase] ❌ Error guardando reserva:', error.message);
    return null;
  }
}
