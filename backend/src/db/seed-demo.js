import bcrypt from "bcryptjs";
import { pool } from "../db.js";

const getOne = async (query, params = []) => {
  const result = await pool.query(query, params);
  return result.rows[0];
};

const ensureSeller = async () => {
  const existing = await getOne("SELECT id FROM users WHERE username = $1", ["vendedor1"]);

  if (existing) {
    return existing.id;
  }

  const role = await getOne("SELECT id FROM roles WHERE name = 'seller'");
  const passwordHash = await bcrypt.hash("vendedor123", 10);
  const seller = await getOne(
    `
    INSERT INTO users (name, username, password_hash, role_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    ["Vendedor Demo", "vendedor1", passwordHash, role.id]
  );

  return seller.id;
};

const upsertSupplier = async ({ name, phone, address, originZone, notes }) => {
  const supplier = await getOne(
    `
    INSERT INTO suppliers (name, phone, address, origin_zone, notes)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (phone)
    DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      origin_zone = EXCLUDED.origin_zone,
      notes = EXCLUDED.notes,
      is_active = TRUE,
      updated_at = NOW()
    RETURNING id
    `,
    [name, phone, address, originZone, notes]
  );

  return supplier.id;
};

const upsertClient = async ({ name, documentType, documentNumber, phone, email, address, city, country }) => {
  const client = await getOne(
    `
    INSERT INTO clients (
      name,
      document_type,
      document_number,
      phone,
      email,
      address,
      city,
      country,
      shipping_notes,
      billing_notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (phone)
    DO UPDATE SET
      name = EXCLUDED.name,
      document_type = EXCLUDED.document_type,
      document_number = EXCLUDED.document_number,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      updated_at = NOW()
    RETURNING id
    `,
    [
      name,
      documentType,
      documentNumber,
      phone,
      email,
      address,
      city,
      country,
      "Enviar con confirmacion previa",
      "Datos de facturacion de prueba",
    ]
  );

  return client.id;
};

const upsertLot = async (lot) => {
  const result = await getOne(
    `
    INSERT INTO coffee_lots (
      code,
      supplier_id,
      coffee_type_id,
      coffee_profile_id,
      status,
      lot_kind,
      gross_weight_kg,
      packaging_type_id,
      packaging_quantity,
      inner_bag_quantity,
      tare_weight_kg,
      net_weight_kg,
      available_weight_kg,
      humidity_percent,
      visual_status,
      visual_defect_percent,
      visual_notes,
      lab_aroma,
      lab_fragrance,
      lab_flavor,
      lab_acidity,
      lab_sweetness,
      lab_body,
      lab_balance,
      lab_uniformity,
      lab_residual,
      lab_clean_cup,
      lab_score,
      lab_notes,
      lab_reviewed_by,
      lab_reviewed_at,
      origin_zone,
      initial_comment,
      purchase_price_per_kg,
      purchase_total,
      purchase_paid,
      purchase_payment_method_id,
      purchase_payment_reference,
      purchase_paid_at,
      purchase_registered_by,
      created_by
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
      $41
    )
    ON CONFLICT (code)
    DO UPDATE SET
      status = EXCLUDED.status,
      coffee_profile_id = EXCLUDED.coffee_profile_id,
      available_weight_kg = EXCLUDED.available_weight_kg,
      humidity_percent = EXCLUDED.humidity_percent,
      lab_score = EXCLUDED.lab_score,
      purchase_paid = EXCLUDED.purchase_paid,
      updated_at = NOW()
    RETURNING id
    `,
    [
      lot.code,
      lot.supplierId,
      lot.coffeeTypeId,
      lot.coffeeProfileId,
      lot.status,
      lot.lotKind,
      lot.grossWeightKg,
      lot.packagingTypeId,
      lot.packagingQuantity,
      lot.innerBagQuantity,
      lot.tareWeightKg,
      lot.netWeightKg,
      lot.availableWeightKg,
      lot.humidityPercent,
      lot.visualStatus,
      lot.visualDefectPercent,
      lot.visualNotes,
      lot.labAroma,
      lot.labFragrance,
      lot.labFlavor,
      lot.labAcidity,
      lot.labSweetness,
      lot.labBody,
      lot.labBalance,
      lot.labUniformity,
      lot.labResidual,
      lot.labCleanCup,
      lot.labScore,
      lot.labNotes,
      lot.labReviewedBy,
      lot.labReviewedAt,
      lot.originZone,
      lot.initialComment,
      lot.purchasePricePerKg,
      lot.purchaseTotal,
      lot.purchasePaid,
      lot.purchasePaymentMethodId,
      lot.purchasePaymentReference,
      lot.purchasePaidAt,
      lot.purchaseRegisteredBy,
      lot.createdBy,
    ]
  );

  return result.id;
};

const ensureMovement = async ({ lotId, movementType, quantityKg, notes, createdBy }) => {
  await pool.query(
    `
    INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
    SELECT $1, $2::varchar, $3, $4::text, $5
    WHERE NOT EXISTS (
      SELECT 1
      FROM inventory_movements
      WHERE lot_id = $1 AND movement_type = $2::varchar AND notes = $4::text
    )
    `,
    [lotId, movementType, quantityKg, notes, createdBy]
  );
};

const ensurePendingProcess = async ({ code, lotId, quantityKg, processLocation, notes, createdBy }) => {
  const existing = await getOne("SELECT id, status FROM coffee_processes WHERE code = $1", [code]);

  if (existing?.status === "en_proceso") {
    await pool.query(
      `
      UPDATE coffee_lots
      SET
        available_weight_kg = GREATEST(available_weight_kg - $1, 0),
        status = CASE WHEN GREATEST(available_weight_kg - $1, 0) = 0 THEN 'en_proceso' ELSE 'disponible' END,
        updated_at = NOW()
      WHERE id = $2
      `,
      [quantityKg, lotId]
    );
    return existing.id;
  }

  let processCode = code;

  if (existing) {
    const lastDemoProcess = await getOne(
      `
      SELECT code
      FROM coffee_processes
      WHERE code LIKE 'PRO-2026-8%'
      ORDER BY code DESC
      LIMIT 1
      `
    );
    const lastNumber = lastDemoProcess?.code ? Number(lastDemoProcess.code.split("-")[2]) : 8000;
    processCode = `PRO-2026-${String(lastNumber + 1).padStart(4, "0")}`;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lotResult = await client.query(
      `
      SELECT *
      FROM coffee_lots
      WHERE id = $1
      FOR UPDATE
      `,
      [lotId]
    );
    const lot = lotResult.rows[0];

    if (!lot || Number(lot.available_weight_kg) < quantityKg) {
      throw new Error("No hay inventario suficiente para crear el proceso demo");
    }

    const newAvailable = Number((Number(lot.available_weight_kg) - quantityKg).toFixed(3));
    const newStatus = newAvailable === 0 ? "en_proceso" : "disponible";

    const processResult = await client.query(
      `
      INSERT INTO coffee_processes (code, status, process_location, notes, total_input_kg, created_by)
      VALUES ($1, 'en_proceso', $2, $3, $4, $5)
      RETURNING id
      `,
      [processCode, processLocation, notes, quantityKg, createdBy]
    );
    const process = processResult.rows[0];

    await client.query(
      `
      INSERT INTO coffee_process_inputs (process_id, lot_id, quantity_kg)
      VALUES ($1, $2, $3)
      `,
      [process.id, lotId, quantityKg]
    );

    await client.query(
      `
      UPDATE coffee_lots
      SET available_weight_kg = $1, status = $2, updated_at = NOW()
      WHERE id = $3
      `,
      [newAvailable, newStatus, lotId]
    );

    await client.query(
      `
      INSERT INTO inventory_movements (lot_id, movement_type, quantity_kg, notes, created_by)
      VALUES ($1, 'proceso_salida', $2, $3, $4)
      `,
      [lotId, quantityKg, `Demo: cafe enviado al proceso ${processCode}`, createdBy]
    );

    await client.query("COMMIT");
    return process.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const runDemoSeed = async () => {
  try {
    const admin = await getOne("SELECT id FROM users WHERE username = 'admin'");
    const warehouse = await getOne("SELECT id FROM users WHERE username = 'bodega'");
    const laboratory = await getOne("SELECT id FROM users WHERE username = 'laboratorio'");
    const accounting = await getOne("SELECT id FROM users WHERE username = 'contabilidad'");
    const sellerId = await ensureSeller();

    const pergamino = await getOne("SELECT id FROM coffee_types WHERE name = 'Pergamino'");
    const trillado = await getOne("SELECT id FROM coffee_types WHERE name = 'Trillado'");
    const costal = await getOne("SELECT id, tare_kg FROM packaging_types WHERE name = 'Costal o saco de fique'");
    const tula = await getOne("SELECT id, tare_kg FROM packaging_types WHERE name = 'Tula o estopa'");
    const transferencia = await getOne("SELECT id FROM payment_methods WHERE name = 'Transferencia'");
    const efectivo = await getOne("SELECT id FROM payment_methods WHERE name = 'Efectivo'");
    const loteCafeCategory = await getOne("SELECT id FROM payable_categories WHERE name = 'Lote de cafe'");
    const transporteCategory = await getOne("SELECT id FROM payable_categories WHERE name = 'Transporte'");

    await pool.query("UPDATE coffee_profiles SET base_price_cop = 18500, base_price_usd = 4.65 WHERE name = 'Perfil 1'");
    await pool.query("UPDATE coffee_profiles SET base_price_cop = 22500, base_price_usd = 5.8 WHERE name = 'Perfil 2'");
    await pool.query("UPDATE coffee_profiles SET base_price_cop = 27000, base_price_usd = 7.1 WHERE name = 'Perfil 3'");

    const perfil1 = await getOne("SELECT id FROM coffee_profiles WHERE name = 'Perfil 1'");
    const perfil2 = await getOne("SELECT id FROM coffee_profiles WHERE name = 'Perfil 2'");
    const perfil3 = await getOne("SELECT id FROM coffee_profiles WHERE name = 'Perfil 3'");

    const supplier1 = await upsertSupplier({
      name: "Finca La Primavera",
      phone: "3001112233",
      address: "Vereda El Roble, Palestina",
      originZone: "Palestina - Caldas",
      notes: "Proveedor demo con cafe pergamino de buena humedad.",
    });
    const supplier2 = await upsertSupplier({
      name: "Asociacion Monte Verde",
      phone: "3002223344",
      address: "Vereda La Quiebra, Chinchina",
      originZone: "Chinchina - Caldas",
      notes: "Proveedor demo para lotes especiales.",
    });
    const supplier3 = await upsertSupplier({
      name: "Finca El Arrayan",
      phone: "3003334455",
      address: "Vereda Buenos Aires, Manizales",
      originZone: "Manizales - Caldas",
      notes: "Proveedor demo para cafe trillado.",
    });

    const client1 = await upsertClient({
      name: "Tostadora Norte SAS",
      documentType: "NIT",
      documentNumber: "900111222-1",
      phone: "3101112233",
      email: "compras@tostadoranorte.test",
      address: "Carrera 12 # 45-20",
      city: "Bogota",
      country: "Colombia",
    });
    const client2 = await upsertClient({
      name: "Importadora Andes Coffee",
      documentType: "NIT",
      documentNumber: "901222333-5",
      phone: "3102223344",
      email: "orders@andescoffee.test",
      address: "120 Coffee St",
      city: "Miami",
      country: "Estados Unidos",
    });

    const pendingLabLot = await upsertLot({
      code: "LOT-2026-8001",
      supplierId: supplier1,
      coffeeTypeId: pergamino.id,
      coffeeProfileId: null,
      status: "pendiente_laboratorio",
      lotKind: "LOT",
      grossWeightKg: 253.4,
      packagingTypeId: costal.id,
      packagingQuantity: 4,
      innerBagQuantity: 4,
      tareWeightKg: 3.0,
      netWeightKg: 250.4,
      availableWeightKg: 0,
      humidityPercent: 11.4,
      visualStatus: "aprobado",
      visualDefectPercent: 2.5,
      visualNotes: "Color parejo, sin olores extranos.",
      labAroma: null,
      labFragrance: null,
      labFlavor: null,
      labAcidity: null,
      labSweetness: null,
      labBody: null,
      labBalance: null,
      labUniformity: null,
      labResidual: null,
      labCleanCup: null,
      labScore: null,
      labNotes: null,
      labReviewedBy: null,
      labReviewedAt: null,
      originZone: "Palestina - Caldas",
      initialComment: "Lote demo pendiente para que laboratorio lo revise.",
      purchasePricePerKg: null,
      purchaseTotal: null,
      purchasePaid: false,
      purchasePaymentMethodId: null,
      purchasePaymentReference: null,
      purchasePaidAt: null,
      purchaseRegisteredBy: null,
      createdBy: warehouse.id,
    });

    const approvedLot = await upsertLot({
      code: "LOT-2026-8002",
      supplierId: supplier2,
      coffeeTypeId: pergamino.id,
      coffeeProfileId: null,
      status: "aprobado",
      lotKind: "LOT",
      grossWeightKg: 181.2,
      packagingTypeId: costal.id,
      packagingQuantity: 3,
      innerBagQuantity: 3,
      tareWeightKg: 2.25,
      netWeightKg: 178.95,
      availableWeightKg: 0,
      humidityPercent: 10.8,
      visualStatus: "aprobado",
      visualDefectPercent: 1.8,
      visualNotes: "Buena apariencia general.",
      labAroma: "Caramelo",
      labFragrance: "Panela",
      labFlavor: "Chocolate y nuez",
      labAcidity: "Media",
      labSweetness: "Alta",
      labBody: "Medio",
      labBalance: "Bueno",
      labUniformity: "Alta",
      labResidual: "Limpio",
      labCleanCup: "Si",
      labScore: 84.5,
      labNotes: "Aprobado por laboratorio, pendiente de registrar compra.",
      labReviewedBy: laboratory.id,
      labReviewedAt: new Date(),
      originZone: "Chinchina - Caldas",
      initialComment: "Lote demo aprobado pero aun no pagado.",
      purchasePricePerKg: null,
      purchaseTotal: null,
      purchasePaid: false,
      purchasePaymentMethodId: null,
      purchasePaymentReference: null,
      purchasePaidAt: null,
      purchaseRegisteredBy: null,
      createdBy: warehouse.id,
    });

    const availableLot = await upsertLot({
      code: "LOT-2026-8003",
      supplierId: supplier3,
      coffeeTypeId: trillado.id,
      coffeeProfileId: null,
      status: "disponible",
      lotKind: "LOT",
      grossWeightKg: 122.0,
      packagingTypeId: tula.id,
      packagingQuantity: 2,
      innerBagQuantity: 0,
      tareWeightKg: 0.4,
      netWeightKg: 121.6,
      availableWeightKg: 121.6,
      humidityPercent: 11.7,
      visualStatus: "aprobado",
      visualDefectPercent: 1.2,
      visualNotes: "Cafe trillado limpio.",
      labAroma: "Cacao",
      labFragrance: "Dulce",
      labFlavor: "Chocolate",
      labAcidity: "Baja",
      labSweetness: "Media",
      labBody: "Alto",
      labBalance: "Bueno",
      labUniformity: "Alta",
      labResidual: "Corto",
      labCleanCup: "Si",
      labScore: 82.0,
      labNotes: "Disponible para venta directa.",
      labReviewedBy: laboratory.id,
      labReviewedAt: new Date(),
      originZone: "Manizales - Caldas",
      initialComment: "Lote demo disponible para inventario.",
      purchasePricePerKg: 9800,
      purchaseTotal: 1191680,
      purchasePaid: true,
      purchasePaymentMethodId: transferencia.id,
      purchasePaymentReference: "DEMO-COMPRA-8003",
      purchasePaidAt: new Date(),
      purchaseRegisteredBy: accounting.id,
      createdBy: warehouse.id,
    });

    const processedLot = await upsertLot({
      code: "PROC-2026-8001",
      supplierId: supplier2,
      coffeeTypeId: pergamino.id,
      coffeeProfileId: perfil1.id,
      status: "disponible",
      lotKind: "PROC",
      grossWeightKg: 75,
      packagingTypeId: null,
      packagingQuantity: 0,
      innerBagQuantity: 0,
      tareWeightKg: 0,
      netWeightKg: 75,
      availableWeightKg: 75,
      humidityPercent: 10.9,
      visualStatus: "aprobado",
      visualDefectPercent: 0.8,
      visualNotes: "Producto procesado demo.",
      labAroma: "Floral",
      labFragrance: "Miel",
      labFlavor: "Frutos rojos",
      labAcidity: "Brillante",
      labSweetness: "Alta",
      labBody: "Sedoso",
      labBalance: "Muy bueno",
      labUniformity: "Alta",
      labResidual: "Dulce",
      labCleanCup: "Si",
      labScore: 87.25,
      labNotes: "Cafe especial listo para venta.",
      labReviewedBy: laboratory.id,
      labReviewedAt: new Date(),
      originZone: "Chinchina - Caldas",
      initialComment: "Lote procesado demo asociado a Perfil 1.",
      purchasePricePerKg: 12800,
      purchaseTotal: 960000,
      purchasePaid: true,
      purchasePaymentMethodId: transferencia.id,
      purchasePaymentReference: "DEMO-PROC-8001",
      purchasePaidAt: new Date(),
      purchaseRegisteredBy: accounting.id,
      createdBy: laboratory.id,
    });

    await ensureMovement({
      lotId: pendingLabLot,
      movementType: "recepcion",
      quantityKg: 250.4,
      notes: "Demo: lote recibido y pendiente de laboratorio",
      createdBy: warehouse.id,
    });
    await ensureMovement({
      lotId: approvedLot,
      movementType: "laboratorio_aprobado",
      quantityKg: 178.95,
      notes: "Demo: lote aprobado por laboratorio",
      createdBy: laboratory.id,
    });
    await ensureMovement({
      lotId: availableLot,
      movementType: "compra_pagada",
      quantityKg: 121.6,
      notes: "Demo: lote comprado y disponible",
      createdBy: accounting.id,
    });
    await ensureMovement({
      lotId: processedLot,
      movementType: "proceso_finalizado",
      quantityKg: 75,
      notes: "Demo: lote procesado disponible",
      createdBy: laboratory.id,
    });

    await ensurePendingProcess({
      code: "PRO-2026-8001",
      lotId: availableLot,
      quantityKg: 15,
      processLocation: "Finca de procesos demo",
      notes: "Proceso demo pendiente para que laboratorio lo finalice.",
      createdBy: warehouse.id,
    });

    const quote = await getOne(
      `
      INSERT INTO quotes (
        code,
        client_id,
        seller_id,
        quote_type,
        status,
        currency,
        payment_terms,
        delivery_terms,
        shipping_cost,
        estimated_delivery_date,
        notes,
        subtotal,
        total
      )
      VALUES (
        'COT-2026-8001',
        $1,
        $2,
        'inventario_disponible',
        'enviada',
        'COP',
        '50% anticipo, saldo contra despacho',
        'Despacho nacional',
        180000,
        CURRENT_DATE + INTERVAL '5 days',
        'Cotizacion demo para verificar PDF e historial.',
        925000,
        1105000
      )
      ON CONFLICT (code)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
      RETURNING id
      `,
      [client1, sellerId]
    );

    await pool.query(
      `
      INSERT INTO quote_items (
        quote_id,
        lot_id,
        coffee_profile_id,
        description,
        quantity_kg,
        unit_price,
        line_total
      )
      SELECT $1, $2, $3, 'Perfil 1 - cafe especial demo', 50, 18500, 925000
      WHERE NOT EXISTS (
        SELECT 1 FROM quote_items WHERE quote_id = $1 AND description = 'Perfil 1 - cafe especial demo'
      )
      `,
      [quote.id, processedLot, perfil1.id]
    );

    const sale = await getOne(
      `
      INSERT INTO sales (
        code,
        client_id,
        seller_id,
        status,
        payment_status,
        currency,
        subtotal,
        shipping_cost,
        total,
        amount_paid,
        balance_due,
        estimated_payment_date,
        external_invoice_reference,
        notes,
        created_by
      )
      VALUES (
        'VEN-2026-8001',
        $1,
        $2,
        'pendiente_alistamiento',
        'pago_parcial',
        'COP',
        630000,
        120000,
        750000,
        300000,
        450000,
        CURRENT_DATE,
        'FAC-DEMO-001',
        'Venta demo con saldo pendiente para revisar cuentas por cobrar.',
        $3
      )
      ON CONFLICT (code)
      DO UPDATE SET
        payment_status = EXCLUDED.payment_status,
        amount_paid = EXCLUDED.amount_paid,
        balance_due = EXCLUDED.balance_due,
        updated_at = NOW()
      RETURNING id
      `,
      [client2, sellerId, accounting.id]
    );

    const saleItem = await getOne(
      `
      INSERT INTO sale_items (
        sale_id,
        lot_id,
        coffee_profile_id,
        description,
        quantity_kg,
        unit_price,
        line_total
      )
      SELECT $1, $2, $3, 'Perfil 2 - venta demo internacional', 30, 21000, 630000
      WHERE NOT EXISTS (
        SELECT 1 FROM sale_items WHERE sale_id = $1 AND description = 'Perfil 2 - venta demo internacional'
      )
      RETURNING id
      `,
      [sale.id, processedLot, perfil2.id]
    );

    if (saleItem) {
      await pool.query(
        `
        INSERT INTO sale_item_lots (sale_item_id, lot_id, quantity_kg)
        SELECT $1, $2, 30
        WHERE NOT EXISTS (
          SELECT 1 FROM sale_item_lots WHERE sale_item_id = $1 AND lot_id = $2
        )
        `,
        [saleItem.id, processedLot]
      );
    }

    await pool.query(
      `
      INSERT INTO sale_payments (
        sale_id,
        amount,
        payment_method_id,
        payment_reference,
        paid_at,
        notes,
        registered_by
      )
      SELECT $1, 300000, $2, 'DEMO-ABONO-001', CURRENT_DATE, 'Abono demo inicial', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM sale_payments WHERE sale_id = $1 AND payment_reference = 'DEMO-ABONO-001'
      )
      `,
      [sale.id, transferencia.id, accounting.id]
    );

    const payableLot = await getOne(
      `
      INSERT INTO accounts_payable (
        code,
        category_id,
        supplier_id,
        lot_id,
        status,
        description,
        total,
        amount_paid,
        balance_due,
        due_date,
        notes,
        created_by
      )
      VALUES (
        'CXP-2026-8001',
        $1,
        $2,
        $3,
        'pagada',
        'Compra demo del lote LOT-2026-8003',
        1191680,
        1191680,
        0,
        CURRENT_DATE,
        'Cuenta por pagar demo asociada a lote.',
        $4
      )
      ON CONFLICT (code)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
      RETURNING id
      `,
      [loteCafeCategory.id, supplier3, availableLot, accounting.id]
    );

    await pool.query(
      `
      INSERT INTO accounts_payable_payments (
        payable_id,
        amount,
        payment_method_id,
        payment_reference,
        paid_at,
        notes,
        registered_by
      )
      SELECT $1, 1191680, $2, 'DEMO-PAGO-CXP-8001', CURRENT_DATE, 'Pago demo completo', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM accounts_payable_payments WHERE payable_id = $1 AND payment_reference = 'DEMO-PAGO-CXP-8001'
      )
      `,
      [payableLot.id, transferencia.id, accounting.id]
    );

    await pool.query(
      `
      INSERT INTO accounts_payable (
        code,
        category_id,
        third_party_name,
        status,
        description,
        total,
        amount_paid,
        balance_due,
        due_date,
        notes,
        created_by
      )
      VALUES (
        'CXP-2026-8002',
        $1,
        'Transportes Demo Express',
        'pendiente',
        'Flete demo pendiente',
        240000,
        0,
        240000,
        CURRENT_DATE + INTERVAL '3 days',
        'Gasto demo para probar cuentas por pagar pendientes.',
        $2
      )
      ON CONFLICT (code)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
      `,
      [transporteCategory.id, accounting.id]
    );

    console.log("Datos demo creados correctamente");
    console.log("Usuario vendedor demo: vendedor1 / vendedor123");
    console.log("Lotes demo: LOT-2026-8001, LOT-2026-8002, LOT-2026-8003, PROC-2026-8001");
    console.log("Proceso demo pendiente: PRO-2026-8001");
    console.log("Cotizacion demo: COT-2026-8001");
    console.log("Venta demo: VEN-2026-8001");
  } catch (error) {
    console.error("Error al crear datos demo:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

runDemoSeed();
