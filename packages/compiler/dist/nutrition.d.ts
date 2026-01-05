interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}
export interface NutritionMetrics {
    total: Macros;
    perPortion?: Macros;
    isEstimate: boolean;
    coverage: number;
}
export declare function calculateNutrition(ingredients: any[], portions?: number): NutritionMetrics;
export {};
