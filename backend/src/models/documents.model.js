import { findQuoteById } from "./quotes.model.js";
import { findSaleById } from "./sales.model.js";

const companyInfo = {
  name: "Finca Anaya",
  document: "",
  phone: "",
  email: "",
  address: "",
};

export const buildQuoteDocument = async (id) => {
  const quote = await findQuoteById(id);

  if (!quote) {
    return null;
  }

  return {
    documentType: quote.quote_type === "preventa" ? "Preventa" : "Cotizacion",
    title: quote.quote_type === "preventa" ? "Preventa de cafe" : "Cotizacion de cafe",
    code: quote.code,
    status: quote.status,
    company: companyInfo,
    client: {
      name: quote.client_name,
      phone: quote.client_phone,
      email: quote.client_email,
      address: quote.client_address,
      documentType: quote.client_document_type,
      documentNumber: quote.client_document_number,
      city: quote.client_city,
      country: quote.client_country,
    },
    seller: {
      name: quote.seller_name,
    },
    dates: {
      createdAt: quote.created_at,
      estimatedDeliveryDate: quote.estimated_delivery_date,
    },
    terms: {
      paymentTerms: quote.payment_terms,
      deliveryTerms: quote.delivery_terms,
      ...(quote.quote_terms || {}),
    },
    items: quote.items.map((item) => ({
      lotCode: item.lot_code,
      coffeeType: item.coffee_type_name,
      coffeeProfile: item.coffee_profile_name,
      description: item.description,
      productForm: item.product_form,
      processType: item.process_type,
      variety: item.variety,
      quantityKg: item.quantity_kg,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      priceBasis: item.price_basis,
      pricingSnapshot: item.pricing_snapshot || {},
    })),
    totals: {
      currency: quote.currency,
      subtotal: quote.subtotal,
      shippingCost: quote.shipping_cost,
      total: quote.total,
    },
    notes: quote.notes,
  };
};

export const buildSaleDocument = async ({ id, includePayments = false }) => {
  const sale = await findSaleById(id);

  if (!sale) {
    return null;
  }

  return {
    documentType: "Venta",
    title: "Factura interna de venta",
    code: sale.code,
    externalInvoiceReference: sale.external_invoice_reference,
    quoteCode: sale.quote_code,
    status: sale.status,
    paymentStatus: sale.payment_status,
    company: companyInfo,
    client: {
      name: sale.client_name,
      phone: sale.client_phone,
      email: sale.client_email,
      address: sale.client_address,
      documentType: sale.client_document_type,
      documentNumber: sale.client_document_number,
      city: sale.client_city,
      country: sale.client_country,
    },
    seller: {
      name: sale.seller_name,
    },
    dates: {
      createdAt: sale.created_at,
      estimatedPaymentDate: sale.estimated_payment_date,
    },
    items: sale.items.map((item) => ({
      lotCode: item.lot_code,
      coffeeType: item.coffee_type_name,
      coffeeProfile: item.coffee_profile_name,
      description: item.description,
      productForm: item.product_form,
      processType: item.process_type,
      variety: item.variety,
      quantityKg: item.quantity_kg,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      labReview: {
        humidity: item.sale_humidity_percent,
        aroma: item.sale_lab_aroma,
        flavor: item.sale_lab_flavor,
        sweetness: item.sale_lab_sweetness,
        body: item.sale_lab_body,
        residual: item.sale_lab_residual,
        cleanCup: item.sale_lab_clean_cup,
        score: item.sale_lab_score,
        notes: item.sale_lab_notes,
      },
    })),
    deductedLots: sale.deductedLots.map((lot) => ({
      lotCode: lot.lot_code,
      quantityKg: lot.quantity_kg,
    })),
    dispatchReceipt: {
      fileName: sale.dispatch_receipt_file_name,
      mimeType: sale.dispatch_receipt_mime_type,
      uploadedAt: sale.dispatch_receipt_uploaded_at,
      hasImage: Boolean(sale.dispatch_receipt_image),
    },
    totals: {
      currency: sale.currency,
      subtotal: sale.subtotal,
      shippingCost: sale.shipping_cost,
      total: sale.total,
      amountPaid: sale.amount_paid,
      balanceDue: sale.balance_due,
    },
    payments: includePayments
      ? sale.payments.map((payment) => ({
          amount: payment.amount,
          paymentMethod: payment.payment_method_name,
          paymentReference: payment.payment_reference,
          paidAt: payment.paid_at,
          notes: payment.notes,
        }))
      : [],
    notes: sale.notes,
  };
};
