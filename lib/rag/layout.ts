/**
 * Layout algorithms for mindmap visualization
 */

import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

export interface LayoutNode {
    id: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

export interface LayoutEdge {
    source: string;
    target: string;
}

/**
 * Calculate node positions using force-directed layout
 */
export function forceDirectedLayout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    width: number = 1200,
    height: number = 800
): LayoutNode[] {
    // Create a copy to avoid mutating original data
    const nodesCopy = nodes.map(n => ({ ...n }));

    const simulation = forceSimulation(nodesCopy as any)
        .force('link', forceLink(edges).id((d: any) => d.id).distance(300).strength(0.5))
        .force('charge', forceManyBody().strength(-1000))
        .force('center', forceCenter(width / 2, height / 2))
        .force('collision', forceCollide().radius(100))
        .stop();

    // Run simulation for a fixed number of iterations
    const iterations = 300;
    for (let i = 0; i < iterations; i++) {
        simulation.tick();
    }

    return nodesCopy;
}

/**
 * Calculate hierarchical layout positions
 */
export function hierarchicalLayout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    width: number = 1200,
    height: number = 800
): LayoutNode[] {
    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    nodes.forEach(n => adjacency.set(n.id, []));
    edges.forEach(e => {
        adjacency.get(e.source)?.push(e.target);
    });

    // Find root nodes (nodes with no incoming edges)
    const incomingCount = new Map<string, number>();
    nodes.forEach(n => incomingCount.set(n.id, 0));
    edges.forEach(e => {
        incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
    });

    const roots = nodes.filter(n => (incomingCount.get(n.id) || 0) === 0);
    if (roots.length === 0 && nodes.length > 0) {
        // If no roots (circular graph), use first node
        roots.push(nodes[0]);
    }

    // BFS to assign levels
    const levels = new Map<string, number>();
    const queue: Array<{ id: string; level: number }> = roots.map(r => ({ id: r.id, level: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        levels.set(id, level);

        const children = adjacency.get(id) || [];
        children.forEach(childId => {
            if (!visited.has(childId)) {
                queue.push({ id: childId, level: level + 1 });
            }
        });
    }

    // Nodes not reached from roots get level 0
    nodes.forEach(n => {
        if (!levels.has(n.id)) {
            levels.set(n.id, 0);
        }
    });

    // Group nodes by level
    const maxLevel = Math.max(...Array.from(levels.values()));
    const nodesByLevel: LayoutNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
    nodes.forEach(n => {
        const level = levels.get(n.id) || 0;
        nodesByLevel[level].push(n);
    });

    // Position nodes
    const levelHeight = height / (maxLevel + 1);
    const positioned = nodes.map(n => {
        const level = levels.get(n.id) || 0;
        const nodesInLevel = nodesByLevel[level];
        const index = nodesInLevel.indexOf(n);
        const levelWidth = width / (nodesInLevel.length + 1);

        return {
            ...n,
            x: levelWidth * (index + 1),
            y: levelHeight * (level + 0.5),
        };
    });

    return positioned;
}

/**
 * Calculate circular layout positions
 */
export function circularLayout(
    nodes: LayoutNode[],
    centerX: number = 600,
    centerY: number = 400,
    radius: number = 300
): LayoutNode[] {
    const angleStep = (2 * Math.PI) / nodes.length;

    return nodes.map((n, i) => ({
        ...n,
        x: centerX + radius * Math.cos(i * angleStep),
        y: centerY + radius * Math.sin(i * angleStep),
    }));
}

/**
 * Calculate grid layout positions
 */
export function gridLayout(
    nodes: LayoutNode[],
    width: number = 1200,
    height: number = 800,
    columns?: number
): LayoutNode[] {
    const cols = columns || Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    return nodes.map((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        return {
            ...n,
            x: cellWidth * (col + 0.5),
            y: cellHeight * (row + 0.5),
        };
    });
}
