import { ProcessedSection } from 'gram-parser';

export function detectCycles(sections: ProcessedSection[]): Set<string> {
     const graph = new Map<string, Set<string>>(); // id -> [dependencies]
     
     sections.forEach(sec => {
         sec.ingredients.forEach(ing => {
             if (ing.dependencies) {
                 if (!graph.has(ing.id)) graph.set(ing.id, new Set());
                 ing.dependencies.forEach(d => graph.get(ing.id)?.add(d));
             }
         });
     });
     
     const visited = new Set<string>();
     const recursionStack = new Set<string>();
     const cycles = new Set<string>();

     function dfs(nodeId: string) {
         visited.add(nodeId);
         recursionStack.add(nodeId);
         
         const deps = graph.get(nodeId);
         if (deps) {
             for (const dep of deps) {
                 if (!visited.has(dep)) {
                     dfs(dep);
                 } else if (recursionStack.has(dep)) {
                     cycles.add(nodeId);
                     cycles.add(dep);
                 }
             }
         }
         recursionStack.delete(nodeId);
     }

     for (const [node] of graph) {
         if (!visited.has(node)) dfs(node);
     }
     
     return cycles;
}
