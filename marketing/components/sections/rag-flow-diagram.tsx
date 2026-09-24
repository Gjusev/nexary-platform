"use client"

import React, { useMemo } from 'react'
import {
    ReactFlow,
    Background,
    Handle,
    Position,
    MarkerType,
    useNodesState,
    useEdgesState,
    type NodeProps,
    type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import {
    Database,
    FileText,
    Brain,
    MessageSquare,
    Layers,
    Cloud,
    Shield,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

// Custom Node Component
interface CustomNodeData extends Record<string, unknown> {
    label: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    color: string
}

function CustomNode({ data }: NodeProps) {
    const nodeData = data as CustomNodeData
    const IconComponent = nodeData.icon

    return (
        <motion.div
            className={`px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[160px] ${nodeData.color}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}
        >
            <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3" />
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <div className="font-semibold text-foreground text-sm">{nodeData.label}</div>
                    <div className="text-xs text-muted-foreground">{nodeData.description}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
        </motion.div>
    )
}

const nodeTypes = {
    custom: CustomNode,
}

const initialEdges = [
    {
        id: 'e1-4',
        source: '1',
        target: '4',
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    },
    {
        id: 'e2-4',
        source: '2',
        target: '4',
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    },
    {
        id: 'e3-4',
        source: '3',
        target: '4',
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    },
    {
        id: 'e4-5',
        source: '4',
        target: '5',
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    },
    {
        id: 'e5-6',
        source: '5',
        target: '6',
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    },
    {
        id: 'e6-7',
        source: '6',
        target: '7',
        animated: true,
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    },
]

export function RAGFlowDiagram() {
    const t = useTranslations("ragFlow")

    const initialNodes = useMemo<Node[]>(() => [
        {
            id: '1',
            type: 'custom',
            position: { x: 0, y: 50 },
            data: {
                label: t('sharePoint'),
                description: t('sharePointDesc'),
                icon: FileText,
                color: 'border-blue-500/50',
            },
        },
        {
            id: '2',
            type: 'custom',
            position: { x: 0, y: 150 },
            data: {
                label: t('confluence'),
                description: t('confluenceDesc'),
                icon: Layers,
                color: 'border-orange-500/50',
            },
        },
        {
            id: '3',
            type: 'custom',
            position: { x: 0, y: 250 },
            data: {
                label: t('erpCrm'),
                description: t('erpCrmDesc'),
                icon: Database,
                color: 'border-green-500/50',
            },
        },
        {
            id: '4',
            type: 'custom',
            position: { x: 280, y: 150 },
            data: {
                label: t('processing'),
                description: t('processingDesc'),
                icon: Shield,
                color: 'border-purple-500/50',
            },
        },
        {
            id: '5',
            type: 'custom',
            position: { x: 520, y: 150 },
            data: {
                label: t('vectorDb'),
                description: t('vectorDbDesc'),
                icon: Cloud,
                color: 'border-cyan-500/50',
            },
        },
        {
            id: '6',
            type: 'custom',
            position: { x: 760, y: 150 },
            data: {
                label: t('llm'),
                description: t('llmDesc'),
                icon: Brain,
                color: 'border-primary',
            },
        },
        {
            id: '7',
            type: 'custom',
            position: { x: 1000, y: 150 },
            data: {
                label: t('response'),
                description: t('responseDesc'),
                icon: MessageSquare,
                color: 'border-emerald-500/50',
            },
        },
    ], [t])

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, , onEdgesChange] = useEdgesState(initialEdges)

    // Update nodes when language changes
    React.useEffect(() => {
        setNodes(initialNodes)
    }, [initialNodes, setNodes])

    return (
        <div className="w-full h-[400px] md:h-[500px] rounded-xl overflow-hidden border bg-card/50 backdrop-blur-sm">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-left"
                proOptions={{ hideAttribution: true }}
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                zoomOnDoubleClick={false}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                className="bg-transparent"
            >
                <Background color="hsl(var(--muted-foreground))" gap={20} size={1} className="opacity-20" />
            </ReactFlow>
        </div>
    )
}
