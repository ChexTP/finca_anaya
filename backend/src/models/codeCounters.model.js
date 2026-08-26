import { pool } from "../db.js";

export const codeCounterDefinitions = [
  { key: "lots", label: "Lotes y procesos", prefix: "LOT", tableName: "coffee_lots" },
  { key: "processedLots", label: "Procesos en inventario", prefix: "PROC", tableName: "coffee_lots" },
  { key: "processes", label: "Ordenes de proceso", prefix: "PRO", tableName: "coffee_processes" },
  { key: "samples", label: "Muestras", prefix: "MUE", tableName: "sample_requests" },
  { key: "quotes", label: "Cotizaciones", prefix: "COT", tableName: "quotes" },
  { key: "priceLists", label: "Listas de precios", prefix: "LIST", tableName: "quotes" },
  { key: "sales", label: "Ventas", prefix: "VEN", tableName: "sales" },
  { key: "payables", label: "Cuentas por pagar", prefix: "CXP", tableName: "accounts_payable" },
  { key: "pasillas", label: "Pasillas", prefix: "PAS", tableName: "coffee_lots" },
  { key: "recoveries", label: "Recuperaciones", prefix: "REC", tableName: "coffee_lots" },
];

// LOT y PROC usan el mismo talonario fisico. Internamente se diferencian por
// prefijo, pero el numero consecutivo debe avanzar como una sola secuencia.
const sharedCounterGroups = {
  LOT: { counterPrefix: "LOT", prefixes: ["LOT", "PROC"] },
  PROC: { counterPrefix: "LOT", prefixes: ["LOT", "PROC"] },
};

const getCounterGroup = (prefix) => {
  return sharedCounterGroups[prefix] || { counterPrefix: prefix, prefixes: [prefix] };
};

const getDefinitionByPrefix = (prefix) => {
  return codeCounterDefinitions.find((definition) => definition.prefix === prefix);
};

const getLastUsedNumber = async ({ prefix, tableName, year, client = pool }) => {
  const group = getCounterGroup(prefix);
  const prefixPattern = group.prefixes.join("|");
  const result = await client.query(
    `
    SELECT COALESCE(MAX((split_part(code, '-', 3))::integer), 0) AS last_number
    FROM ${tableName}
    WHERE code ~ $1
    `,
    [`^(${prefixPattern})-${year}-[0-9]+$`]
  );

  return Number(result.rows[0]?.last_number || 0);
};

const formatCode = ({ prefix, year, number }) => {
  return `${prefix}-${year}-${String(number).padStart(4, "0")}`;
};

const codeExists = async ({ prefix, tableName, year, number, client = pool }) => {
  const group = getCounterGroup(prefix);
  const codesToCheck = group.prefixes.map((groupPrefix) => formatCode({ prefix: groupPrefix, year, number }));
  const result = await client.query(
    `
    SELECT 1
    FROM ${tableName}
    WHERE code = ANY($1)
    LIMIT 1
    `,
    [codesToCheck]
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
    const counterGroup = getCounterGroup(definition.prefix);
    const groupCounters = counterGroup.prefixes
      .map((prefix) => countersByPrefix[prefix])
      .filter(Boolean);
    const currentNextNumber = Math.max(
      1,
      ...groupCounters.map((counter) => Number(counter.next_number || 1))
    );
    const lastUsedNumber = await getLastUsedNumber({
      prefix: definition.prefix,
      tableName: definition.tableName,
      year,
    });
    // El consecutivo visible siempre debe respetar los codigos reales existentes.
    // Esto evita repetir codigos cuando se crea o edita uno manualmente.
    const nextNumber = Math.max(currentNextNumber, lastUsedNumber + 1);

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

  const counterGroup = getCounterGroup(prefix);
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
    [counterGroup.counterPrefix, year, nextNumber, userId]
  );

  return result.rows[0];
};

export const getNextCode = async ({ prefix, tableName, client = pool }) => {
  const year = new Date().getFullYear();
  const counterGroup = getCounterGroup(prefix);
  const counterResult = await client.query(
    `
    SELECT *
    FROM code_counters
    WHERE prefix = ANY($1) AND year = $2
    FOR UPDATE
    `,
    [counterGroup.prefixes, year]
  );

  const canonicalCounter = counterResult.rows.find((counter) => counter.prefix === counterGroup.counterPrefix);
  const currentNextNumber = Math.max(
    1,
    ...counterResult.rows.map((counter) => Number(counter.next_number || 1))
  );
  const lastUsedNumber = await getLastUsedNumber({ prefix, tableName, year, client });
  let nextNumber = Math.max(currentNextNumber, lastUsedNumber + 1);

  // Si administracion configura un numero que ya existe, se avanza al siguiente libre.
  while (await codeExists({ prefix, tableName, year, number: nextNumber, client })) {
    nextNumber += 1;
  }

  if (canonicalCounter) {
    await client.query(
      `
      UPDATE code_counters
      SET next_number = $1, last_generated_number = $2, updated_at = NOW()
      WHERE id = $3
      `,
      [nextNumber + 1, nextNumber, canonicalCounter.id]
    );
  } else {
    await client.query(
      `
      INSERT INTO code_counters (prefix, year, next_number, last_generated_number)
      VALUES ($1, $2, $3, $4)
      `,
      [counterGroup.counterPrefix, year, nextNumber + 1, nextNumber]
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

  const counterGroup = getCounterGroup(prefix);
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
    [counterGroup.counterPrefix, year, number + 1, number]
  );
};

export const reserveNextCodes = async ({ prefix, tableName, count, client = pool }) => {
  const codes = [];

  for (let index = 0; index < count; index += 1) {
    codes.push(await getNextCode({ prefix, tableName, client }));
  }

  return codes;
};
