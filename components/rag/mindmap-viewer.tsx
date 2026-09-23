import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    MiniMap,
    Background,
    useNodesState,
    useEdgesState,
    ConnectionMode,
    Panel,
    Handle,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './mindmap-styles.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Box } from 'lucide-react';
import CustomEdge from './custom-edge';

interface MindMapViewerProps {
    packageId: string;
    packageName: string;
    onNodeClick?: (nodeData: any) => void;
    similarityThreshold?: number;
    viewMode?: 'chunks' | 'documents';
}

// Custom node component for documents
function DocumentNode({ data }: { data: any }) {
    return (
        <Card className="px-4 py-3 shadow-lg border-2 border-primary/20 bg-background hover:border-primary/40 transition-colors min-w-[180px]">
            {/* Center handles for cleaner straight line connections */}
            <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={data.filename}>
                        {data.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {data.chunkCount} chunks
                    </p>
                </div>
            </div>
        </Card>
    );
}

// Custom node component for chunks
function ChunkNode({ data }: { data: any }) {
    return (
        <Card className="px-3 py-2 shadow-md border border-border bg-card hover:bg-accent transition-colors max-w-[200px]">
            {/* Center handles for cleaner straight line connections */}
            <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 }} />
            <div className="flex items-center gap-2">
                <Box className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" title={data.filename}>
                        {data.filename}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        Chunk {data.chunkIndex}
                    </p>
                </div>
            </div>
        </Card>
    );
}

const nodeTypes = {
    document: DocumentNode,
    chunk: ChunkNode,
};

const edgeTypes = {
    custom: CustomEdge,
};

export default function MindMapViewer({
    packageId,
    packageName,
    onNodeClick,
    similarityThreshold = 0.3, // Lowered from 0.7 to show more connections
    viewMode = 'chunks',
}: MindMapViewerProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [similarNodes, setSimilarNodes] = useState<Array<{ id: string; similarity: number }>>([]);

    // Fetch mindmap data
    const fetchMindmapData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/rag/graph/${packageId}?threshold=${similarityThreshold}&mode=${viewMode}`
            );
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to load mindmap');
            }

            // Apply default styles to edges IMMEDIATELY when receiving from API
            const styledEdges = (data.edges || []).map((edge: Edge) => ({
                ...edge,
                type: 'custom', // Use our custom edge component
                animated: false,
                style: {
                    stroke: '#64748b', // Tailwind slate-500 - definitely visible
                    strokeWidth: 2,
                    opacity: 0.8,
                },
            }));

            setNodes(data.nodes || []);
            setEdges(styledEdges);
            setMetadata(data.metadata || null);
        } catch (err) {
            console.error('Error fetching mindmap:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [packageId, similarityThreshold, viewMode, setNodes, setEdges]);

    // Load data on mount and when dependencies change
    useMemo(() => {
        fetchMindmapData();
    }, [fetchMindmapData]);

    // Removed manual DOM manipulation hack to allow CustomEdge to handle styles correctly


    // Handle node click - highlight similar nodes
    const handleNodeClick = useCallback(
        (_: any, node: Node) => {
            setSelectedNodeId(node.id);

            // Find all edges connected to this node
            const connectedEdges = edges.filter(
                (edge) => edge.source === node.id || edge.target === node.id
            );

            // Extract similar nodes with their similarity scores
            const similar = connectedEdges.map((edge) => {
                const targetId = edge.source === node.id ? edge.target : edge.source;
                return {
                    id: targetId,
                    similarity: edge.data?.similarity || 0,
                };
            }).sort((a, b) => b.similarity - a.similarity);

            setSimilarNodes(similar);

            // Update node styles to highlight selection and similar nodes
            setNodes((nds) =>
                nds.map((n) => {
                    const isSimilar = similar.some((s) => s.id === n.id);
                    const isSelected = n.id === node.id;

                    return {
                        ...n,
                        style: {
                            ...n.style,
                            opacity: isSelected || isSimilar ? 1 : 0.4,
                            filter: isSelected ? 'drop-shadow(0 0 8px rgb(var(--primary)))' :
                                isSimilar ? 'drop-shadow(0 0 4px rgb(var(--accent)))' : 'none',
                        },
                    };
                })
            );

            // Update edge styles to highlight connected edges
            setEdges((eds) =>
                eds.map((e) => {
                    const isConnected = e.source === node.id || e.target === node.id;
                    return {
                        ...e,
                        style: {
                            stroke: isConnected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                            strokeWidth: isConnected ? 3 : 2,
                            opacity: isConnected ? 1 : 0.15,
                        },
                        animated: isConnected,
                        labelStyle: {
                            fontSize: 13,
                            fontWeight: 600,
                            fill: 'hsl(var(--foreground))',
                        },
                        labelBgStyle: {
                            fill: 'hsl(var(--background))',
                            fillOpacity: 0.95,
                        },
                    };
                })
            );

            if (onNodeClick) {
                onNodeClick(node.data);
            }
        },
        [edges, onNodeClick, setNodes, setEdges]
    );

    // Reset selection when clicking on pane
    const handlePaneClick = useCallback(() => {
        setSelectedNodeId(null);
        setSimilarNodes([]);

        // Reset all node styles
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: {
                    ...n.style,
                    opacity: 1,
                    filter: 'none',
                },
            }))
        );

        // Reset all edge styles to minimal visibility
        setEdges((eds) =>
            eds.map((e) => ({
                ...e,
                style: {
                    stroke: 'hsl(var(--muted-foreground))',
                    strokeWidth: 2,
                    opacity: 0.15,
                },
                animated: false,
                labelStyle: {
                    fontSize: 12,
                    fontWeight: 600,
                    fill: 'hsl(var(--foreground))',
                },
                labelBgStyle: {
                    fill: 'hsl(var(--background))',
                    fillOpacity: 0.95,
                },
            }))
        );
    }, [setNodes, setEdges]);

    // Default edge options for better visibility
    const defaultEdgeOptions = useMemo(() => ({
        type: 'smoothstep',
        animated: false,
        style: {
            stroke: 'hsl(var(--muted-foreground))',
            strokeWidth: 2,
            opacity: 0.15,
        },
        labelStyle: {
            fill: 'hsl(var(--foreground))',
            fontSize: 12,
            fontWeight: 600,
        },
        labelBgStyle: {
            fill: 'hsl(var(--background))',
            fillOpacity: 0.95,
        },
    }), []);

    // Log edges for debugging
    useMemo(() => {
        if (edges.length > 0) {
            }
    }, [edges]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-background">
                <div className="text-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground">Loading mindmap...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-background">
                <Card className="p-6 max-w-md">
                    <h3 className="font-semibold text-destructive mb-2">Error Loading Mindmap</h3>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button onClick={fetchMindmapData} variant="outline" className="mt-4">
                        Retry
                    </Button>
                </Card>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-background">
                <Card className="p-6 max-w-md text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">No Documents to Visualize</h3>
                    <p className="text-sm text-muted-foreground">
                        Upload documents to this package to see the knowledge graph.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-background">

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                connectionMode={ConnectionMode.Loose}
                fitView
                className="bg-background"
                minZoom={0.1}
                maxZoom={2}
                elevateEdgesOnSelect={true}
                proOptions={{ hideAttribution: true }}
                edgesUpdatable={false}
                edgesFocusable={true}
                elementsSelectable={true}
                selectNodesOnDrag={false}
            >
                <Background className="bg-muted/30" />
                <Controls className="bg-background border border-border rounded-lg shadow-md" />
                <MiniMap
                    className="bg-background border border-border rounded-lg shadow-md"
                    nodeColor={(node) => {
                        if (node.type === 'document') return 'hsl(var(--primary))';
                        return 'hsl(var(--muted-foreground))';
                    }}
                />

                {/* Info panel */}
                <Panel position="top-left" className="bg-background/95 rounded-lg border border-border shadow-lg p-3 backdrop-blur-sm">
                    <div className="space-y-1">
                        <h3 className="font-semibold text-sm">{packageName}</h3>
                        {metadata && (
                            <div className="flex gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                    {metadata.totalDocuments} docs
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    {nodes.length} nodes
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    {edges.length} connections
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    {(metadata.similarityThreshold * 100).toFixed(0)}% threshold
                                </Badge>
                            </div>
                        )}
                    </div>
                </Panel>

                {/* Similar nodes panel when node is selected */}
                {selectedNodeId && similarNodes.length > 0 && (
                    <Panel position="top-right" className="bg-background/95 rounded-lg border border-border shadow-lg p-4 backdrop-blur-sm max-w-xs">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <Box className="h-4 w-4 text-primary" />
                                Similar {viewMode === 'chunks' ? 'Chunks' : 'Documents'}
                            </h4>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                {similarNodes.map((similar, index) => {
                                    const node = nodes.find((n) => n.id === similar.id);
                                    if (!node) return null;

                                    return (
                                        <div
                                            key={similar.id}
                                            className="text-xs p-2 rounded bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
                                            onClick={() => {
                                                const clickEvt = { currentTarget: node } as any;
                                                handleNodeClick(clickEvt, node);
                                            }}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium text-muted-foreground">#{index + 1}</span>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {(similar.similarity * 100).toFixed(0)}%
                                                </Badge>
                                            </div>
                                            <p className="truncate mt-1" title={node.data.label}>
                                                {node.data.label}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">
                                Click on a similar item to explore its connections
                            </p>
                        </div>
                    </Panel>
                )}
            </ReactFlow>
        </div>
    );
}
