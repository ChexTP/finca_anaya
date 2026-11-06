import { isDeepStrictEqual } from "node:util";

const text = (value) => value == null || value === "" ? null : String(value);
const date = (value) => value ? new Date(value).toISOString().slice(0, 10) : null;
const number = (value) => value == null || value === "" ? null : Number(value);

// Notes do not change quantities, assignments or the preparation workflow.
export const quoteContentUnchanged = (quote, items, data) => {
  const textFields = {
    code: "code", clientId: "client_id", quoteType: "quote_type", status: "status",
    currency: "currency", paymentTerms: "payment_terms", deliveryTerms: "delivery_terms",
  };
  if (Object.entries(textFields).some(([key, column]) => text(data[key]) !== text(quote[column]))) return false;
  if (date(data.estimatedDeliveryDate) !== date(quote.estimated_delivery_date)) return false;
  if (["shippingCost", "subtotal", "total"].some((key) => (
    number(data[key]) !== number(quote[{ shippingCost: "shipping_cost", subtotal: "subtotal", total: "total" }[key]])
  ))) return false;
  if (!isDeepStrictEqual(data.terms || {}, quote.quote_terms || {})) return false;
  if (items.length !== data.items.length) return false;
  return items.every((item, index) => {
    const next = data.items[index];
    const strings = { description: "description", productForm: "product_form", processType: "process_type", variety: "variety", priceBasis: "price_basis" };
    const numbers = { lotId: "lot_id", coffeeTypeId: "coffee_type_id", coffeeProfileId: "coffee_profile_id", quantityKg: "quantity_kg", operationalWeightKg: "operational_weight_kg", unitPrice: "unit_price", lineTotal: "line_total" };
    return Object.entries(strings).every(([key, column]) => text(next[key]) === text(item[column]))
      && Object.entries(numbers).every(([key, column]) => number(next[key]) === number(item[column]))
      && isDeepStrictEqual(next.pricingSnapshot || {}, item.pricing_snapshot || {});
  });
};
