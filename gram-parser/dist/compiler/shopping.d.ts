import { ProcessedSection, Registry, Usage } from '../types';
interface ShoppingListItem {
    id: string;
    name?: string;
    qty?: number;
    unit?: string | null;
    variable_entries?: string[];
    sureMass?: number;
    otherUnits?: Record<string, number>;
    variableParts?: string[];
    _hasSure?: boolean;
}
interface CompositeItem {
    type: 'composite';
    id: string;
    qty: number;
    usage: Partial<Usage>[];
    _maxQty: number;
}
export declare function generateShoppingList(sections: ProcessedSection[], registry: Registry): (ShoppingListItem | CompositeItem | Usage)[];
export {};
