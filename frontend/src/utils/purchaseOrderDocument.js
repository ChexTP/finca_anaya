import { companyBrand, getPrintableLogo } from "./brand";
import { printHtmlDocument } from "./printHtml";
import { printable } from "./printFormatting";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatMoney = (value, { withCurrency = true } = {}) => {
  const formatted = Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return withCurrency ? `COP ${formatted}` : formatted;
};

const formatDecimal = (value, decimals = 2) => {
  return Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatDate = (value) => {
  if (!value) return new Date().toLocaleDateString("es-CO");
  return new Date(value).toLocaleDateString("es-CO");
};

const getSnapshot = (payable) => {
  if (!payable?.purchase_order_snapshot) return {};
  if (typeof payable.purchase_order_snapshot === "string") {
    try {
      return JSON.parse(payable.purchase_order_snapshot) || {};
    } catch {
      return {};
    }
  }
  return payable.purchase_order_snapshot || {};
};

const snapshotValue = (payable, key, fallback = "") => {
  const snapshot = getSnapshot(payable);
  return snapshot[key] === undefined || snapshot[key] === null || snapshot[key] === "" ? fallback : snapshot[key];
};

const getOrderCode = (payable) => {
  const snapshotOrderCode = snapshotValue(payable, "orderCode", "");
  if (snapshotOrderCode) return snapshotOrderCode;

  const match = String(payable.code || "").match(/(\d{4})-(\d+)$/);
  if (match) return `${Number(match[2])}-${match[1]}`;
  return payable.code || payable.lot_code || "ORDEN";
};

const getCoffeeDetail = (payable) => {
  const snapshotCoffeeDetail = snapshotValue(payable, "coffeeDetail", "");
  if (snapshotCoffeeDetail) return snapshotCoffeeDetail;

  return [
    payable.lot_code,
    payable.lot_presentation,
    payable.coffee_profile_name || payable.coffee_variety || payable.coffee_type_name || payable.commercial_classification,
    payable.performance_factor ? `FR ${payable.performance_factor}` : null,
  ].filter(Boolean).join(" - ");
};

const getPurchaseOrderItems = (payable) => {
  const snapshot = getSnapshot(payable);
  const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items : [];

  if (snapshotItems.length > 0) {
    return snapshotItems.map((item) => {
      const kilos = Number(item.netWeightKg || 0);
      const priceKg = Number(item.purchasePricePerKg || 0);
      const total = Number(item.purchaseTotal || (kilos * priceKg));
      const purchaseBaseFactor = Number(item.purchaseBaseFactor || 90);
      const priceFactor90 = Number(item.purchasePriceFactor90 || 0);
      const adjustedPriceCarga = Number(item.adjustedPriceCarga || (priceKg * 125));

      return {
        detail: printable(item.coffeeDetail || item.lotCode || "Cafe liquidado"),
        lotCode: item.lotCode || "",
        grossKilos: Number(item.grossWeightKg || 0),
        kilos,
        arrobas: kilos / 12.5,
        purchaseBaseFactor,
        priceFactor90,
        priceKg,
        priceCarga: adjustedPriceCarga,
        priceArroba: priceKg * 12.5,
        total,
        performanceFactor: item.performanceFactor || "",
        adjustmentPercent: Number(item.adjustmentPercent || 0),
      };
    });
  }

  const kilos = Number(snapshotValue(payable, "netWeightKg", payable.net_weight_kg || 0));
  const priceKg = Number(snapshotValue(payable, "purchasePricePerKg", payable.purchase_price_per_kg || (kilos ? Number(payable.total || 0) / kilos : 0)));

  return [{
    detail: printable(getCoffeeDetail(payable) || "Cafe liquidado"),
    lotCode: snapshotValue(payable, "lotCode", payable.lot_code || ""),
    grossKilos: Number(snapshotValue(payable, "grossWeightKg", payable.gross_weight_kg || 0)),
    kilos,
    arrobas: kilos / 12.5,
    purchaseBaseFactor: Number(snapshotValue(payable, "purchaseBaseFactor", 90)),
    priceFactor90: Number(snapshotValue(payable, "purchasePriceFactor90", 0)),
    priceKg,
    priceCarga: priceKg * 125,
    priceArroba: priceKg * 12.5,
    total: Number(snapshotValue(payable, "purchaseTotal", payable.purchase_total || payable.total || (kilos * priceKg))),
    performanceFactor: snapshotValue(payable, "performanceFactor", payable.performance_factor || ""),
    adjustmentPercent: Number(snapshotValue(payable, "adjustmentPercent", 0)),
  }];
};

const buildInfoRows = (rows) => rows
  .map(([label, value]) => `
    <div class="info-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "-")}</dd>
    </div>
  `)
  .join("");

export const buildPurchaseOrderHtml = (payable) => {
  const items = getPurchaseOrderItems(payable);
  const kilos = items.reduce((sum, item) => sum + Number(item.kilos || 0), 0);
  const grossKilos = items.reduce((sum, item) => sum + Number(item.grossKilos || 0), 0);
  const total = Number(snapshotValue(payable, "purchaseTotal", payable.purchase_total || payable.total || items.reduce((sum, item) => sum + Number(item.total || 0), 0)));
  const firstItem = items[0] || {};
  const orderCode = getOrderCode(payable);
  const supplierName = printable(snapshotValue(payable, "supplierName", payable.supplier_name || payable.third_party_name || ""), "");
  const footerAddress = companyBrand.address.replaceAll(",", "");
  const notes = snapshotValue(payable, "notes", payable.notes || "");
  const performanceFactor = snapshotValue(payable, "performanceFactor", firstItem.performanceFactor || payable.performance_factor || "");
  const lotCodeLabel = items.length > 1
    ? items.map((item) => item.lotCode).filter(Boolean).join(", ")
    : snapshotValue(payable, "lotCode", payable.lot_code || "");
  const presentationLabel = snapshotValue(payable, "lotPresentation", payable.lot_presentation || "");
  const detailRows = items.map((item) => `
                <tr>
                  <td>${escapeHtml(item.detail)}</td>
                  <td>${formatDecimal(item.kilos)}</td>
                  <td>${formatDecimal(item.arrobas)}</td>
                  <td>${escapeHtml(item.performanceFactor || "-")} / ${escapeHtml(item.purchaseBaseFactor || 90)}</td>
                  <td class="money">${formatMoney(item.priceFactor90)}</td>
                  <td class="money">${formatMoney(item.priceCarga)}</td>
                  <td class="money">${formatMoney(item.priceKg)}</td>
                  <td class="money">${formatMoney(item.priceArroba)}</td>
                  <td class="money">${formatMoney(item.total)}</td>
                </tr>
  `).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Orden de compra ${escapeHtml(orderCode)}</title>
        <style>
          @page { size: letter; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.35;
            margin: 0;
          }
          .sheet { margin: 0 auto; max-width: 840px; }
          header {
            align-items: center;
            border-bottom: 2px solid #111827;
            display: flex;
            gap: 34px;
            justify-content: space-between;
            min-height: 128px;
            padding-bottom: 16px;
          }
          .logo { height: 118px; object-fit: contain; width: 260px; }
          .company { text-align: right; }
          .company p { margin: 3px 0; }
          .company strong { font-size: 16px; }
          .title-row {
            align-items: end;
            display: flex;
            justify-content: space-between;
            gap: 18px;
            margin: 18px 0 16px;
          }
          h1 { font-size: 25px; letter-spacing: 0; margin: 0; }
          .order-code {
            border: 1px solid #cbd5e1;
            min-width: 190px;
            padding: 11px 14px;
            text-align: right;
          }
          .order-code span {
            color: #64748b;
            display: block;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .order-code strong { display: block; font-size: 20px; margin-top: 2px; }
          .section {
            border: 1px solid #d7dee8;
            margin-top: 14px;
          }
          .section-title {
            background: #f1f5f9;
            border-bottom: 1px solid #d7dee8;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0;
            margin: 0;
            padding: 9px 12px;
            text-transform: uppercase;
          }
          .info-grid {
            display: grid;
            gap: 0;
            grid-template-columns: 1fr 1fr;
          }
          .info-row {
            border-bottom: 1px solid #e5e7eb;
            display: grid;
            grid-template-columns: 130px 1fr;
            min-height: 35px;
          }
          .info-row:nth-last-child(-n + 2) { border-bottom: 0; }
          .info-row dt {
            background: #fafafa;
            border-right: 1px solid #e5e7eb;
            font-weight: 800;
            margin: 0;
            padding: 9px 10px;
          }
          .info-row dd {
            margin: 0;
            padding: 9px 10px;
          }
          table { border-collapse: collapse; width: 100%; }
          th, td {
            border: 1px solid #d7dee8;
            padding: 8px 9px;
            text-align: center;
            vertical-align: middle;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }
          td:first-child, th:first-child { text-align: center; }
          .money { font-weight: 700; white-space: nowrap; }
          .summary {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 18px;
            margin-top: 14px;
          }
          .note-box {
            border: 1px solid #d7dee8;
            min-height: 116px;
            padding: 12px;
          }
          .note-box h3,
          .totals h3 {
            font-size: 12px;
            margin: 0 0 8px;
            text-transform: uppercase;
          }
          .totals {
            border: 1px solid #d7dee8;
            padding: 12px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            padding: 5px 0;
          }
          .total-row.final {
            border-top: 2px solid #111827;
            font-size: 16px;
            font-weight: 800;
            margin-top: 4px;
            padding-top: 9px;
          }
          .signatures {
            display: grid;
            gap: 18px;
            grid-template-columns: 1fr 1fr;
            margin-top: 42px;
          }
          .signature {
            border-top: 1.5px solid #111827;
            padding-top: 8px;
            text-align: center;
          }
          .signature strong { display: block; }
          footer {
            border-top: 1px solid #d7dee8;
            color: #475569;
            display: grid;
            gap: 12px;
            grid-template-columns: 1fr 1fr 1fr;
            margin-top: 30px;
            padding-top: 10px;
          }
          footer div:nth-child(2) { text-align: center; }
          footer div:nth-child(3) { text-align: right; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <header>
            <img class="logo" src="${getPrintableLogo()}" alt="Anaya Coffee" />
            <div class="company">
              <p><strong>${escapeHtml(companyBrand.legalName)}</strong></p>
              <p>NIT: ${escapeHtml(companyBrand.nit)}</p>
              <p>${escapeHtml(companyBrand.address)}</p>
              <p>Tel: ${escapeHtml(companyBrand.phone)}</p>
              <p>Email: ${escapeHtml(companyBrand.email)}</p>
              <p>Instagram: ${escapeHtml(companyBrand.instagram)}</p>
            </div>
          </header>

          <div class="title-row">
            <div>
              <h1>Orden de compra de cafe</h1>
              <p>Documento generado al liquidar el lote y dejar la compra pactada.</p>
            </div>
            <div class="order-code">
              <span>Orden</span>
              <strong>${escapeHtml(orderCode)}</strong>
            </div>
          </div>

          <section class="section">
            <h2 class="section-title">Proveedor y lote</h2>
            <dl class="info-grid">
              ${buildInfoRows([
                ["Fecha", formatDate(snapshotValue(payable, "orderDate", payable.created_at))],
                ["Proveedor", supplierName],
                ["NIT o C.C.", snapshotValue(payable, "supplierDocument", payable.supplier_document || "")],
                ["Telefono", snapshotValue(payable, "supplierPhone", payable.supplier_phone || "")],
                ["Ciudad / zona", snapshotValue(payable, "supplierOriginZone", payable.supplier_origin_zone || "")],
                ["Direccion", snapshotValue(payable, "supplierAddress", payable.supplier_address || "")],
                ["Codigo lote", lotCodeLabel],
                ["Presentacion", presentationLabel],
                ["Peso bruto", grossKilos ? `${formatDecimal(grossKilos)} kg` : ""],
                ["Peso neto", `${formatDecimal(kilos)} kg`],
                ["Factor rendimiento", performanceFactor],
                ["Registrado por", snapshotValue(payable, "createdByName", payable.created_by_name || "")],
              ])}
            </dl>
          </section>

          <section class="section">
            <h2 class="section-title">Detalle de compra</h2>
            <table>
              <thead>
                <tr>
                  <th>Detalle</th>
                  <th>Kilos</th>
                  <th>Arrobas</th>
                  <th>Factor / base</th>
                  <th>Precio factor base</th>
                  <th>Precio carga ajustado</th>
                  <th>Precio kg</th>
                  <th>Precio arroba</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${detailRows}
              </tbody>
            </table>
          </section>

          <div class="summary">
            <div class="note-box">
              <h3>Nota</h3>
              <p>${escapeHtml(notes || "Sin notas adicionales.")}</p>
              <p><strong>Detalle interno:</strong> ${items.length > 1 ? "Orden agrupada" : `Precio carga ajustado ${formatMoney(firstItem.priceCarga, { withCurrency: false })}`}${performanceFactor ? ` - FR ${escapeHtml(performanceFactor)}` : ""}</p>
            </div>
            <div class="totals">
              <h3>Resumen</h3>
              <div class="total-row"><span>Subtotal</span><strong>${formatMoney(total)}</strong></div>
              <div class="total-row"><span>Anticipos</span><strong>${formatMoney(0)}</strong></div>
              <div class="total-row final"><span>Total</span><strong>${formatMoney(total)}</strong></div>
            </div>
          </div>

          <div class="signatures">
            <div class="signature">
              <strong>${escapeHtml(supplierName || "Proveedor")}</strong>
              <span>Recibe a satisfaccion / Proveedor</span>
            </div>
            <div class="signature">
              <strong>ELIANA SOFIA CLAROS MEDINA</strong>
              <span>Funcionario autorizado para pago</span>
            </div>
          </div>

          <footer>
            <div>Correo: ${escapeHtml(companyBrand.email)}</div>
            <div>Telefono: ${escapeHtml(companyBrand.phone.replace("+57 ", ""))}</div>
            <div>Direccion: ${escapeHtml(footerAddress)}</div>
          </footer>
        </div>
      </body>
    </html>
  `;
};

export const openPurchaseOrderPrint = (payable) => {
  printHtmlDocument(buildPurchaseOrderHtml(payable), {
    title: payable?.code || "Orden de compra",
  });
};
