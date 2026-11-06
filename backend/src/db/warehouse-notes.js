export const addWarehouseNotesColumns = async (db) => {
  await db.query(`
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS warehouse_notes TEXT;
    ALTER TABLE sample_requests ADD COLUMN IF NOT EXISTS warehouse_notes TEXT;
  `);
};
