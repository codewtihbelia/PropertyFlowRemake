/**
 * Centavo Math Utilities
 * All financial calculations operate on integer centavos (1 PHP = 100 centavos).
 * Eliminates floating point rounding errors.
 */
export declare function pesosToCentavos(pesos: number): number;
export declare function centavosToPesos(centavos: number): number;
export declare function formatPesos(centavos: number): string;
export declare function parsePesoInput(input: string | number): number;
