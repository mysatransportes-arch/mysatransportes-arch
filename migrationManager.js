/**
 * MigrationManager - Gestor de Migración de Datos para MYSA TRANSPORTES
 *
 * Este módulo se encarga de trasladar los datos históricos desde Google Sheets
 * hacia la base de datos profesional de Supabase.
 */

import { supabase } from './supabaseClient.js';
import { askN8nWorkflow } from './n8nClient.js';

export async function migrateSheetsToSupabase() {
  console.log('\n🚀 Iniciando migración de datos: Google Sheets $\rightarrow$ Supabase...');

  try {
    // 1. Obtenemos los datos de la planilla a través de un workflow de n8n
    // El workflow debe devolver un array de todas las reservas existentes
    const data = await askN8nWorkflow('EXPORT_ALL_RESERVAS_SHEETS', 'MigrationBot', true, 'system');

    if (!data || !Array.isArray(data.reservas)) {
      throw new Error('No se pudieron obtener datos válidos de la planilla.');
    }

    console.log(`📦 Procesando ${data.reservas.length} registros...`);
    let imported = 0;
    let errors = 0;

    for (const row of data.reservas) {
      try {
        // A. Asegurar que el cliente existe o crearlo
        const { data: cliente, error: cError } = await supabase
          .from('clientes')
          .upsert({ telefono: row.telefono, nombre: row.nombre })
          .select()
          .single();

        if (cError) throw cError;

        // B. Insertar la reserva vinculada al cliente
        const { error: rError } = await supabase
          .from('reservas')
          .insert([{
            cliente_id: cliente.id,
            origen: row.origen,
            destino: row.destino,
            fecha_traslado: row.fecha,
            hora_traslado: row.hora,
            tipo_carga: row.carga,
            precio_cotizado: row.precio,
            estado_viaje: 'Pendiente'
          }]);

        if (rError) throw rError;
        imported++;
      } catch (e) {
        console.error(`❌ Error migrando fila ${row.id}: ${e.message}`);
        errors++;
      }
    }

    console.log(`\n✅ MIGRACIÓN COMPLETADA:`);
    console.log(`- Importados: ${imported}`);
    console.log(`- Errores: ${errors}`);

  } catch (error) {
    console.error('[Migration] Error crítico en la migración:', error.message);
  }
}
