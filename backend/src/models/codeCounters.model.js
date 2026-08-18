import { pool } from "../db.js";

export const codeCounterDefinitions = [
  { key: "lots", label: "Lotes recibidos", prefix: "LOT", tableName: "coffee_lots" },
  { key: "processedLots", label: "Lotes procesados", prefix: "PROC", tableName: "coffee_lots" },
  { key: "processes", label: "Ordenes de proceso", prefix: "PRO", tableName: "coffee_processes" },
  { key: "samples", label: "Muestras", prefix: "MUE", tableName: "sample_requests" },
  { key: "quotes", label: "Cotizaciones", prefix: "COT", tableName: "quotes" },
  { key: "priceLists", label: "Listas de precios", prefix: "LIST", tableName: "quotes" },
  { key: "sales", label: "Ventas", prefix: "VEN", tableName: "sales" },
  { key: "payables", label: "Cuentas por pagar", prefix: "CXP", tableName: "accounts_payable" },
  { key: "pasillas", label: "Pasillas", prefix: "PAS", tableName: "coffee_lots" },
  { key: "recoveries", label: "Recuperaciones", prefix: "REC", tableName: "coffee_lots" },
];

const getDefinitionByPrefix = (prefix) => {
  return codeCounterDefinitions.find((definition) => definition.prefix === prefix);
};

const getLastUsedNumber = async ({ prefix, tableName, year, client = pool }) => {
  const result = await client.query(
    `
    SELECT COALESCE(MAX((split_part(code, '-', 3))::integer), 0) AS last_number
    FROM ${tableName}
    WHERE code ~ $1
    `,
    [`^${prefix}-${year}-[0-9]+$`]
  );

  return Number(result.rows[0]?.last_number || 0);
};

const formatCode = ({ prefix, year, number }) => {
  return `${prefix}-${year}-${String(number).padStart(4, "0")}`;
};

const codeExists = async ({ prefix, tableName, year, number, client = pool }) => {
  const result = await client.query(
    `
    SELECT 1
    FROM ${tableName}
    WHERE code = $1
    LIMIT 1
    `,
    [formatCode({ prefix, year, number })]
  );

  return result.rowCount > 0;
};

export const listCodeCounters = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `
    SELECT *
    FROM code_counters
    WHERE year = $1
    ORDER BY prefix ASC
    `,
    [year]
  );
  const countersByPrefix = result.rows.reduce((indexed, counter) => ({
    ...indexed,
    [counter.prefix]: counter,
  }), {});

  return Promise.all(codeCounterDefinitions.map(async (definition) => {
    const current = countersByPrefix[definition.prefix];
    const lastUsedNumber = await getLastUsedNumber({
      prefix: definition.prefix,
      tableName: definition.tableName,
      year,
    });
    // El consecutivo visible siempre debe respetar los codigos reales existentes.
    // Esto evita repetir codigos cuando se crea o edita uno manualmente.
    const nextNumber = Math.max(Number(current?.next_number || 1), lastUsedNumber + 1);

    return {
      ...definition,
      year,
      nextNumber,
      lastUsedNumber,
      nextCode: formatCode({ prefix: definition.prefix, year, number: nextNumber }),
    };
  }));
};

export const setCodeCounter = async ({ prefix, year, nextNumber, userId }) => {
  const definition = getDefinitionByPrefix(prefix);

  if (!definition) {
    return null;
  }

  const result = await pool.query(
    `
    INSERT INTO code_counters (prefix, year, next_number, updated_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (prefix, year)
    DO UPDATE SET
      next_number = EXCLUDED.next_number,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING *
    `,
    [prefix, year, nextNumber, userId]
  );

  return result.rows[0];
};

export const getNextCode = async ({ prefix, tableName, client = pool }) => {
  const year = new Date().getFullYear();
  const counterResult = await client.query(
    `
    SELECT *
    FROM code_counters
    WHERE prefix = $1 AND year = $2
    FOR UPDATE
    `,
    [prefix, year]
  );

  const counter = counterResult.rows[0];
  const lastUsedNumber = await getLastUsedNumber({ prefix, tableName, year, client });
  let nextNumber = Math.max(Number(counter?.next_number || 1), lastUsedNumber + 1);

  // Si administracion configura un numero que ya existe, se avanza al siguiente libre.
  while (await codeExists({ prefix, tableName, year, number: nextNumber, client })) {
    nextNumber += 1;
  }

  if (counter) {
    await client.query(
      `
      UPDATE code_counters
      SET next_number = $1, last_generated_number = $2, updated_at = NOW()
      WHERE id = $3
      `,
      [nextNumber + 1, nextNumber, counter.id]
    );
  } else {
    await client.query(
      `
      INSERT INTO code_counters (prefix, year, next_number, last_generated_number)
      VALUES ($1, $2, $3, $4)
      `,
      [prefix, year, nextNumber + 1, nextNumber]
    );
  }

  return formatCode({ prefix, year, number: nextNumber });
};

export const advanceCounterFromCode = async ({ code, client = pool }) => {
  const match = String(code || "").match(/^([A-Z]+)-(\d{4})-(\d+)$/i);

  if (!match) return;

  const [, rawPrefix, rawYear, rawNumber] = match;
  const prefix = rawPrefix.toUpperCase();
  const year = Number(rawYear);
  const number = Number(rawNumber);
  const definition = getDefinitionByPrefix(prefix);

  if (!definition || !year || !number) return;

  await client.query(
    `
    INSERT INTO code_counters (prefix, year, next_number, last_generated_number)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (prefix, year)
    DO UPDATE SET
      next_number = GREATEST(code_counters.next_number, EXCLUDED.next_number),
      last_generated_number = GREATEST(COALESCE(code_counters.last_generated_number, 0), EXCLUDED.last_generated_number),
      updated_at = NOW()
    `,
    [prefix, year, number + 1, number]
  );
};

export const reserveNextCodes = async ({ prefix, tableName, count, client = pool }) => {
  const codes = [];

  for (let index = 0; index < count; index += 1) {
    codes.push(await getNextCode({ prefix, tableName, client }));
  }

  return codes;
};
