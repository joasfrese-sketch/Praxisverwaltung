import "server-only";
import QRCode from "qrcode";

/** QR-Code als SVG (für Einstellungen und Aushang). */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b2733", light: "#ffffff" } });
}
