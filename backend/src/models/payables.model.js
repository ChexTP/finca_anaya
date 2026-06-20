import { pool } from "../db.js";

export const findPayableCategoryById = async (id) => {
  const result = await pool.query("SELECT * FROM payable_categories WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0];
};

export const getNextPayableCode = async () => {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `
    SELECT code
    FROM accounts_payable
    WHERE code LIKE $1
    ORDER BY code DESC
    LIMIT 1
    `,
    [`CXP-${year}-%`]
  );

  const lastCode = result.rows[0]?.code;
  const lastNumber = lastCode ? Number(lastCode.split("-")[2]) : 0;
  const nextNumber = String(lastNumber + 1).padStart(4, "0");

  return `CXP-${year}-${nextNumber}`;
};

export const listPayables = async ({ status, categoryId, supplierId, lotId }) => {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`accounts_payable.status = $${params.length}`);
  }

  if (categoryId) {
    params.push(categoryId);
    conditions.push(`accounts_payable.category_id = $${params.length}`);
  }

  if (supplierId) {
    params.push(supplierId);
    conditions.push(`accounts_payable.supplier_id = $${params.length}`);
  }

  if (lotId) {
    params.push(lotId);
    conditions.push(`accounts_payable.lot_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT
      accounts_payable.*,
      payable_categories.name AS category_name,
      suppliers.name AS supplier_name,
      coffee_lots.code AS lot_code,
      users.name AS created_by_name
    FROM accounts_payable
    INNER JOIN payable_categories ON payable_categories.id = accounts_payable.category_id
    LEFT JOIN suppliers ON suppliers.id = accounts_payable.supplier_id
    LEFT JOIN coffee_lots ON coffee_lots.id = accounts_payable.lot_id
    LEFT JOIN users ON users.id = accounts_payable.created_by
    ${where}
    ORDER BY accounts_payable.created_at DESC
    `,
    params
  );

  return result.rows;
};

export const findPayableById = async (id) => {
  const payableResult = await pool.query(
    `
    SELECT
      accounts_payable.*,
      payable_categories.name AS category_name,
      suppliers.name AS supplier_name,
      coffee_lots.code AS lot_code,
      users.name AS created_by_name
    FROM accounts_payable
    INNER JOIN payable_categories ON payable_categories.id = accounts_payable.category_id
    LEFT JOIN suppliers ON suppliers.id = accounts_payable.supplier_id
    LEFT JOIN coffee_lots ON coffee_lots.id = accounts_payable.lot_id
    LEFT JOIN users ON users.id = accounts_payable.created_by
    WHERE accounts_payable.id = $1
    LIMIT 1
    `,
    [id]
  );
  const payable = payableResult.rows[0];

  if (!payable) {
    return null;
  }

  const paymentsResult = await pool.query(
    `
    SELECT
      accounts_payable_payments.*,
      payment_methods.name AS payment_method_name,
      users.name AS registered_by_name
    FROM accounts_payable_payments
    LEFT JOIN payment_methods ON payment_methods.id = accounts_payable_payments.payment_method_id
    LEFT JOIN users ON users.id = accounts_payable_payments.registered_by
    WHERE accounts_payable_payments.payable_id = $1
    ORDER BY accounts_payable_payments.paid_at ASC, accounts_payable_payments.id ASC
    `,
    [id]
  );

  return {
    ...payable,
    payments: paymentsResult.rows,
  };
};

export const createPayable = async ({
  code,
  categoryId,
  supplierId,
  lotId,
  status,
  thirdPartyName,
  description,
  total,
  amountPaid,
  dueDate,
  paymentMethodId,
  paymentReference,
  paidAt,
  notes,
  createdBy,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const balanceDue = Number((total - amountPaid).toFixed(2));

    const payableResult = await client.query(
      `
      INSERT INTO accounts_payable (
        code,
        category_id,
        supplier_id,
        lot_id,
        status,
        third_party_name,
        description,
        total,
        amount_paid,
        balance_due,
        due_date,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        code,
        categoryId,
        supplierId || null,
        lotId || null,
        status,
        thirdPartyName || null,
        description,
        total,
        amountPaid,
        balanceDue,
        dueDate || null,
        notes || null,
        createdBy,
      ]
    );
    const payable = payableResult.rows[0];

    if (amountPaid > 0) {
      await client.query(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          payable.id,
          amountPaid,
          paymentMethodId,
          paymentReference,
          paidAt || new Date(),
          "Pago inicial registrado al crear la cuenta por pagar",
          createdBy,
        ]
      );
    }

    await client.query("COMMIT");
    return payable;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const registerPayablePayment = async ({
  payableId,
  amount,
  paymentMethodId,
  paymentReference,
  paidAt,
  notes,
  registeredBy,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const payableResult = await client.query(
      `
      SELECT *
      FROM accounts_payable
      WHERE id = $1
      FOR UPDATE
      `,
      [payableId]
    );
    const payable = payableResult.rows[0];

    if (!payable) {
      await client.query("ROLLBACK");
      return null;
    }

    const currentBalance = Number(payable.balance_due);

    if (amount > currentBalance) {
      await client.query("ROLLBACK");
      return { amountTooHigh: true, payable };
    }

    await client.query(
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
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [payableId, amount, paymentMethodId, paymentReference, paidAt, notes || null, registeredBy]
    );

    const newAmountPaid = Number((Number(payable.amount_paid) + amount).toFixed(2));
    const newBalance = Number((Number(payable.total) - newAmountPaid).toFixed(2));
    const newStatus = newBalance === 0 ? "pagada" : "pago_parcial";

    const updateResult = await client.query(
      `
      UPDATE accounts_payable
      SET
        amount_paid = $1,
        balance_due = $2,
        status = $3,
        due_date = CASE WHEN $2 = 0 THEN NULL ELSE due_date END,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [newAmountPaid, newBalance, newStatus, payableId]
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
