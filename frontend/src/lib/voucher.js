// Comprobante de venta en PDF
import { jsPDF } from "jspdf";

const EMPRESA = { razon: "INVERSIONES EPSA MOTOR S.A.C.", ruc: "20555595469", direccion: "Av. 22 de Agosto 852, Comas, Lima", telefono: "+51 907 721 481", correo: "inversionesepsamotor@gmail.com" };
const MARINO = [7, 30, 61]; const ROJO = [198, 40, 40]; const GRIS = [100, 116, 139];
const soles = (n) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const numeroComprobante = (c) => `${c.serie}-${String(c.numero).padStart(8, "0")}`;

// Logo
function logoPng() {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas"); c.width = 900; c.height = Math.round(900 * (img.naturalHeight || 600) / (img.naturalWidth || 1975));
        const g = c.getContext("2d"); g.fillStyle = `rgb(${MARINO.join(",")})`; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        ok({ data: c.toDataURL("image/jpeg", 0.9), ratio: c.height / c.width });
      } catch { ok(null); }
    };
    img.onerror = () => ok(null);
    img.src = "/images/logo-epsa.svg";
  });
}

// Armar y descargar el PDF
export async function descargarComprobante({ comprobante: c, venta, modelo }) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth(); const M = 10;
  // Cabecera
  doc.setFillColor(...MARINO); doc.rect(0, 0, W, 34, "F");
  const logo = await logoPng();
  if (logo) doc.addImage(logo.data, "JPEG", M, 8, 52, 52 * logo.ratio);
  else { doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("EPSA MOTOR", M, 20); }
  doc.setFillColor(255, 255, 255); doc.roundedRect(W - M - 52, 6, 52, 22, 2, 2, "F");
  doc.setTextColor(...MARINO); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text(`RUC ${EMPRESA.ruc}`, W - M - 26, 11.5, { align: "center" });
  doc.setFontSize(9); doc.text(c.tipo.toUpperCase(), W - M - 26, 17, { align: "center" });
  doc.setTextColor(...ROJO); doc.setFontSize(11); doc.text(numeroComprobante(c), W - M - 26, 24, { align: "center" });

  // Empresa
  let y = 42;
  doc.setTextColor(...MARINO); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(EMPRESA.razon, M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
  doc.text(`${EMPRESA.direccion} · ${EMPRESA.telefono} · ${EMPRESA.correo}`, M, y + 4.5);
  doc.text("Distribuidor autorizado de motocars Torito Bajaj", M, y + 8.5);

  // Cliente
  y = 58;
  doc.setDrawColor(226, 232, 240); doc.roundedRect(M, y, W - 2 * M, c.direccion ? 30 : 25, 2, 2);
  const campo = (et, val, x, yy) => { doc.setFontSize(7); doc.setTextColor(...GRIS); doc.text(et, x, yy); doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.text(String(val || "—"), x, yy + 4.5); doc.setFont("helvetica", "normal"); };
  campo("Cliente", c.cliente, M + 4, y + 6); campo(c.tipoDoc, c.doc, W / 2 + 4, y + 6);
  campo("Fecha de emisión", c.fecha, M + 4, y + 16); campo("Medio de pago", c.medio, W / 2 + 4, y + 16);
  if (c.direccion) campo("Dirección fiscal", c.direccion, M + 4, y + 25.5);
  y += c.direccion ? 36 : 31;

  // Detalle
  const techo = Number(venta?.techoPrecio || 0);
  const lineas = [[c.descripcion || `Motocar ${modelo || ""}`, c.total - techo]];
  if (techo > 0) lineas.push([`Techo adicional: ${venta.techo}`, techo]);
  doc.setFillColor(241, 245, 249); doc.rect(M, y, W - 2 * M, 7, "F");
  doc.setFontSize(7.5); doc.setTextColor(...MARINO); doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN", M + 3, y + 4.7); doc.text("IMPORTE", W - M - 3, y + 4.7, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42); doc.setFontSize(8.5);
  y += 12;
  for (const [txt, imp] of lineas) {
    const partes = doc.splitTextToSize(txt, W - 2 * M - 40);
    doc.text(partes, M + 3, y); doc.text(soles(imp), W - M - 3, y, { align: "right" });
    y += partes.length * 4 + 3;
  }
  doc.setDrawColor(226, 232, 240); doc.line(M, y, W - M, y); y += 6;
  const tot = (et, val, fuerte) => { doc.setFont("helvetica", fuerte ? "bold" : "normal"); doc.setFontSize(fuerte ? 11 : 8.5); doc.setTextColor(...(fuerte ? MARINO : GRIS)); doc.text(et, W - M - 45, y); doc.text(soles(val), W - M - 3, y, { align: "right" }); y += fuerte ? 7 : 5; };
  tot("Op. gravada", c.gravada); tot("IGV 18%", c.igv); tot("TOTAL", c.total, true);

  // Pie
  y = Math.max(y + 6, 170);
  doc.setFontSize(7.5); doc.setTextColor(...GRIS); doc.setFont("helvetica", "normal");
  if (venta?.vendedor) doc.text(`Atendido por ${venta.vendedor}${venta.sede ? ` · Sede ${venta.sede}` : ""} · Emitido por ${c.emitidoPor}`, M, y);
  doc.text("Gracias por confiar en EPSA Motor. Conserve este comprobante para su garantía.", M, y + 4.5);
  doc.setFillColor(...ROJO); doc.rect(0, doc.internal.pageSize.getHeight() - 3, W, 3, "F");
  doc.save(`${numeroComprobante(c)}-${(c.cliente || "cliente").replace(/\s+/g, "-")}.pdf`);
}
