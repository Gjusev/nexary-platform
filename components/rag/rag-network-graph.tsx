'use client';

import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    ConnectionMode,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTheme } from 'next-themes';

interface RagSource {
    id: string;
    documentId?: string;
    filename: string;
    content: string;
    score: number;
}

interface RagNetworkGraphProps {
    sources: RagSource[];
    query?: string;
}

export function RagNetworkGraph({ sources, query = 'User Query' }: RagNetworkGraphProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Transform sources into graph nodes/edges
    const { initialNodes, initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Central Node: User Query
        nodes.push({
            id: 'query',
            type: 'input',
            data: { label: 'Your Query' },
            position: { x: 400, y: 50 },
            style: {
                background: isDark ? '#3f3f46' : '#ffffff',
                color: isDark ? '#fff' : '#000',
                border: '2px solid #6366f1', // Primary color
                borderRadius: '8px',
                padding: '10px',
                fontWeight: 'bold',
                width: 150,
                textAlign: 'center',
            },
        });

        // Process sources
        sources.forEach((source, index) => {
            // Create Chunk Node
            const chunkId = source.id || `chunk-${index}`;
            const xPos = 150 + (index * 400); // Spread horizontally
            const yPos = 250;

            nodes.push({
                id: chunkId,
                data: {
                    label: `Chunk: ${source.filename.substring(0, 15)}...`,
                    fullText: source.content
                },
                position: { x: xPos, y: yPos },
                style: {
                    background: isDark ? '#18181b' : '#f4f4f5',
                    color: isDark ? '#d4d4d8' : '#3f3f46',
                    border: '1px solid #a1a1aa',
                    borderRadius: '4px',
                    fontSize: '12px',
                    width: 180,
                    padding: '8px',
                },
            });

            // Edge from Query to Chunk
            edges.push({
                id: `e-query-${chunkId}`,
                source: 'query',
                target: chunkId,
                animated: true,
                label: `${Math.round(source.score * 100)}%`,
                style: {
                    stroke: `rgba(99, 102, 241, ${Math.max(source.score, 0.6)})`, // Opacity based on score
                    strokeWidth: Math.max(source.score * 5, 2)
                },
                labelStyle: { fill: isDark ? '#a1a1aa' : '#71717a', fontSize: 10 },
            });

            // Create Document Node (Parent)
            // Only if we have a documentId, otherwise group by filename
            const docId = source.documentId || `doc-${source.filename}`;
            const docNodeExists = nodes.find(n => n.id === docId);

            if (!docNodeExists) {
                nodes.push({
                    id: docId,
                    type: 'output',
                    data: { label: source.filename },
                    position: { x: xPos, y: 450 },
                    style: {
                        background: isDark ? '#09090b' : '#ffffff',
                        color: isDark ? '#fff' : '#000',
                        border: '2px solid #22c55e', // Success/Doc color
                        borderRadius: '6px',
                        width: 160,
                        padding: '10px',
                        textAlign: 'center',
                        fontWeight: 500
                    },
                });
            }

            // Edge from Chunk to Document
            edges.push({
                id: `e-${chunkId}-${docId}`,
                source: chunkId,
                target: docId,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
                style: { stroke: '#22c55e', strokeWidth: 1.5, strokeDasharray: '4' },
            });
        });

        return { initialNodes: nodes, initialEdges: edges };
    }, [sources, isDark]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync state when props change
    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    return (
        <div className="h-[400px] w-full border border-border rounded-lg bg-background/50 overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                connectionMode={ConnectionMode.Loose}
                fitView
                attributionPosition="bottom-right"
            >
                <Background gap={12} size={1} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
