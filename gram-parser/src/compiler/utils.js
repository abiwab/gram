
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'unknown';
};

const minifyQuantity = (q) => {
    if (!q) return undefined;
    if (typeof q === 'number') return q;
    if (q.type === 'single' && q.value !== undefined) return q.value;
    if (q.type === 'range' || q.type === 'fraction') return q;
    if (q.type === 'Quantity') {
        if (q.value && q.value.type === 'single') return q.value.value;
        return q.value; 
    }
    if (q.type === 'RelativeQuantity') return undefined; 
    return q;
};

const createCleanUsage = (item, id) => {
    const obj = { id };
    const qtyNode = item.quantity;
    let cleanQty = undefined;
    
    if (qtyNode) {
        cleanQty = minifyQuantity(qtyNode.value);
    }
    
    if (cleanQty !== undefined) obj.qty = cleanQty;
    if (qtyNode && qtyNode.unit) obj.unit = qtyNode.unit;

    if (item.modifiers && item.modifiers.length > 0) {
        const MODIFIER_MAP = {
            '?': 'optional',
            '-': 'hidden',
            '&': 'reference',
            '*': 'bakers_percentage'
        };
        obj.modifiers = item.modifiers.map(m => MODIFIER_MAP[m] || m);
    }

    if (item.type === 'cookware') {
        if (qtyNode && qtyNode.fixed === false) obj.fixed = false;
    } else {
        if (qtyNode && qtyNode.fixed === true) obj.fixed = true;
    }
    
    if (qtyNode && qtyNode.type === 'TextQuantity') {
        obj.qty = qtyNode.value;
        obj.fixed = true; 
    }

    if (item.alias) obj.alias = item.alias;
    if (item.preparation) obj.preparation = item.preparation;
    if (item.composite) {
         const comp = {};
         if (item.composite.parent) comp.parent = item.composite.parent;
         if (item.composite.quantity) {
             const compQty = item.composite.quantity;
             const minified = minifyQuantity(compQty);
             if (minified !== undefined) comp.quantity = minified;
             if (compQty.unit) comp.unit = compQty.unit;
         }
         obj.composite = comp;
    }

    return obj;
};

const cleanObject = (obj) => {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) {
        const cleanedArr = obj.map(cleanObject).filter(x => x !== undefined && x !== null);
        return cleanedArr;
    }
    if (typeof obj === 'object') {
        const res = {};
        for (const key in obj) {
            const val = obj[key];
            const cleanedVal = cleanObject(val);
            if (cleanedVal !== null && cleanedVal !== undefined) {
                 if (Array.isArray(cleanedVal) && cleanedVal.length === 0) continue;
                 res[key] = cleanedVal;
            }
        }
        return res;
    }
    return obj;
};

module.exports = {
    slugify,
    minifyQuantity,
    createCleanUsage,
    cleanObject
};
