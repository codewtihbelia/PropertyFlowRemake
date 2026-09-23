"use strict";
/**
 * Centavo Math Utilities
 * All financial calculations operate on integer centavos (1 PHP = 100 centavos).
 * Eliminates floating point rounding errors.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pesosToCentavos = pesosToCentavos;
exports.centavosToPesos = centavosToPesos;
exports.formatPesos = formatPesos;
exports.parsePesoInput = parsePesoInput;
function pesosToCentavos(pesos) {
    if (isNaN(pesos))
        return 0;
    return Math.round(pesos * 100);
}
function centavosToPesos(centavos) {
    return centavos / 100;
}
function formatPesos(centavos) {
    const isNegative = centavos < 0;
    const absCentavos = Math.abs(centavos);
    const pesos = Math.floor(absCentavos / 100);
    const remainderCentavos = absCentavos % 100;
    const formattedPesos = pesos.toLocaleString('en-PH');
    const formattedCentavos = remainderCentavos.toString().padStart(2, '0');
    return `${isNegative ? '-' : ''}₱${formattedPesos}.${formattedCentavos}`;
}
function parsePesoInput(input) {
    if (typeof input === 'number')
        return pesosToCentavos(input);
    const clean = input.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : pesosToCentavos(parsed);
}
