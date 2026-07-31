import { companyBrand, getPrintableLogo } from "./brand";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatMoney = (value, { withSymbol = true } = {}) => {
  const formatted = Number(value || 0).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return withSymbol ? `$ ${formatted}` : formatted;
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

const getOrderCode = (payable) => {
  const match = String(payable.code || "").match(/(\d{4})-(\d+)$/);
  if (match) return `${Number(match[2])}-${match[1]}`;
  return payable.code || payable.lot_code || "ORDEN";
};

const getCoffeeDetail = (payable) => {
  return [
    payable.lot_code ? `COD ${String(payable.lot_code).replace(/^LOT-\d{4}-?/i, "")}` : null,
    payable.coffee_profile_name || payable.coffee_variety || payable.coffee_type_name || payable.commercial_classification,
    payable.performance_factor ? `FR ${payable.performance_factor}` : null,
  ].filter(Boolean).join(" ");
};

export const buildPurchaseOrderHtml = (payable) => {
  const kilos = Number(payable.net_weight_kg || 0);
  const arrobas = kilos / 12.5;
  const priceKg = Number(payable.purchase_price_per_kg || (kilos ? Number(payable.total || 0) / kilos : 0));
  const priceCarga = priceKg * 125;
  const priceArroba = priceKg * 12.5;
  const total = Number(payable.purchase_total || payable.total || (kilos * priceKg));
  const orderCode = getOrderCode(payable);
  const supplierName = payable.supplier_name || payable.third_party_name || "";
  const footerAddress = companyBrand.address.replaceAll(",", "");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Orden de compra ${escapeHtml(orderCode)}</title>
        <style>
          @page { size: letter landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body { color: #000; font-family: Arial, Helvetica, sans-serif; margin: 0; }
          .sheet { margin: 0 auto; max-width: 1060px; }
          .top { display: grid; grid-template-columns: 360px 1fr; gap: 34px; align-items: start; }
          .logo-box { height: 145px; display: flex; align-items: center; justify-content: center; }
          .logo { max-height: 118px; max-width: 330px; object-fit: contain; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1.5px solid #000; padding: 4px 6px; font-size: 13px; line-height: 1.15; }
          .green { background: #00e514; font-weight: 800; }
          .company th { font-size: 22px; text-align: center; }
          .company td { font-size: 15px; }
          .label { font-weight: 800; }
          .title { font-size: 22px; text-align: center; }
          .number { font-size: 22px; text-align: center; font-weight: 800; }
          .meta { display: grid; grid-template-columns: 400px 1fr; gap: 230px; margin-top: 24px; }
          .fields { width: 400px; }
          .fields-row { display: grid; grid-template-columns: 100px 1fr; align-items: end; gap: 10px; margin-bottom: 8px; font-size: 14px; }
          .line { border-bottom: 1.5px solid #000; min-height: 18px; padding-left: 4px; }
          .note { height: 132px; }
          .note td { height: 104px; vertical-align: top; }
          .items { margin-top: 22px; }
          .items th { height: 46px; text-align: center; }
          .items td { text-align: right; }
          .items td:first-child { text-align: left; }
          .items .blank { color: transparent; }
          .summary td { font-size: 14px; }
          .summary .blue { background: #d9e2f3; font-size: 17px; font-weight: 800; }
          .below-note { border: 2px solid #000; border-top: 0; min-height: 42px; padding: 6px; font-size: 15px; }
          .signatures { margin-top: 18px; }
          .signatures td { height: 92px; vertical-align: top; }
          .signatures .name { height: 24px; text-align: center; vertical-align: middle; }
          .signatures .role { background: #e5e5e5; font-weight: 800; height: 22px; text-align: center; text-decoration: underline; vertical-align: middle; }
          .footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 178px; font-size: 14px; }
          .footer div:nth-child(2) { text-align: center; }
          .footer div:nth-child(3) { text-align: right; }
          @media print {
            .no-print { display: none; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="top">
            <div class="logo-box">
              <img class="logo" src="${getPrintableLogo()}" alt="Anaya Coffee" />
            </div>
            <table class="company">
              <tr><th class="green" colspan="2">ANAYA</th></tr>
              <tr><td class="label">Nit:</td><td>${escapeHtml(companyBrand.nit)}</td></tr>
              <tr><td class="label">telefono:</td><td>${escapeHtml(companyBrand.phone.replace("+57 ", ""))}</td></tr>
              <tr><td class="label">correo:</td><td>${escapeHtml(companyBrand.email)}</td></tr>
              <tr>
                <td class="green title">ORDEN DE COMPRA</td>
                <td class="number">${escapeHtml(orderCode)}</td>
              </tr>
            </table>
          </div>

          <div class="meta">
            <div class="fields">
              <div class="fields-row"><div class="label">FECHA:</div><div class="line">${formatDate(payable.created_at)}</div></div>
              <div class="fields-row"><div class="label">PROVEEDOR:</div><div class="line">${escapeHtml(supplierName)}</div></div>
              <div class="fields-row"><div class="label">NIT O C.C.:</div><div class="line"></div></div>
              <div class="fields-row"><div class="label">CIUDAD:</div><div class="line">${escapeHtml(payable.supplier_origin_zone || "")}</div></div>
              <div class="fields-row"><div class="label">TELEFONO:</div><div class="line">${escapeHtml(payable.supplier_phone || "")}</div></div>
            </div>
            <table class="note">
              <tr><th>NOTA:</th><td>${escapeHtml(payable.notes || "")}</td></tr>
            </table>
          </div>

          <table class="items">
            <thead>
              <tr class="green">
                <th>DETALLE</th>
                <th>KILOS</th>
                <th>ARROBAS</th>
                <th>PRECIO CARGA</th>
                <th>PRECIO X KILO</th>
                <th>PRECIO X ARROBA</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(getCoffeeDetail(payable))}</td>
                <td>${formatDecimal(kilos)}</td>
                <td>${formatDecimal(arrobas)}</td>
                <td>${formatMoney(priceCarga)}</td>
                <td>${formatMoney(priceKg)}</td>
                <td>${formatMoney(priceArroba)}</td>
                <td>${formatMoney(total)}</td>
              </tr>
              <tr>
                <td></td><td></td><td>0,00</td><td></td><td>$ 0,0</td><td>$ -</td><td>$ -</td>
              </tr>
              <tr class="green">
                <td colspan="5"></td><td class="label">SUBTOTAL</td><td>${formatMoney(total)}</td>
              </tr>
              <tr class="summary">
                <td class="blank"></td>
                <td class="label" style="text-align:center;">TOTAL</td>
                <td class="label" style="text-align:center; text-decoration:underline;">${formatDecimal(kilos)}</td>
                <td class="label" style="text-align:center; text-decoration:underline;">PONDERADO</td>
                <td></td>
                <td class="label">ANTICIPOS</td>
                <td>${formatMoney(0)}</td>
              </tr>
              <tr class="summary">
                <td colspan="5"></td>
                <td class="label">TOTAL</td>
                <td class="blue">${formatMoney(total)}</td>
              </tr>
            </tbody>
          </table>
          <div class="below-note">PRECIO CARGA ${formatMoney(priceCarga, { withSymbol: false })} FR ${escapeHtml(payable.performance_factor || "")}</div>

          <table class="signatures">
            <tbody>
              <tr>
                <td><strong><u>Recibe a satisfaccion:</u></strong></td>
                <td><strong><u>Funcionario autorizado para pago:</u></strong></td>
              </tr>
              <tr>
                <td class="name">${escapeHtml(supplierName)}</td>
                <td class="name">ELIANA SOFIA CLAROS MEDINA</td>
              </tr>
              <tr>
                <td class="role">Proveedor</td>
                <td class="role">Auxiliar Administrativo</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <div>CORREO: ${escapeHtml(companyBrand.email)}</div>
            <div>TELEFONO: ${escapeHtml(companyBrand.phone.replace("+57 ", ""))}</div>
            <div>DIRECCION: ${escapeHtml(footerAddress)}</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const openPurchaseOrderPrint = (payable) => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("El navegador bloqueo la ventana de impresion.");
  }

  printWindow.document.write(buildPurchaseOrderHtml(payable));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
