/**
 * Mass Normalization Module
 *
 * Responsible for converting physical mass units into a standard GRAM unit (g).
 */
interface ConversionResult {
    mass: number;
    method: 'physical';
}
export declare function normalizeMass(amount: number, unit: string): ConversionResult | null;
export {};
