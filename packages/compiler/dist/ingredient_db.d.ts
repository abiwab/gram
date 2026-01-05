/**
 * Ingredient Database
 * Stores physical properties of common ingredients for mass estimation.
 */
export interface IngredientData {
    density: number;
    unit_weight?: number;
}
export declare const INGREDIENT_DB: Record<string, IngredientData>;
export declare function getIngredientData(name: string): IngredientData | null;
