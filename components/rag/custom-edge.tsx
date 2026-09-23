import { BaseEdge, EdgeLabelRenderer, EdgeProps, getStraightPath } from 'reactflow';

export default function CustomEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    label,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
    });

    return (
        <>
            <path
                id={id}
                style={{
                    stroke: '#2563eb', // Fallback: Tailwind blue-600
                    strokeWidth: 2,
                    ...style,
                    opacity: style.opacity || 1, // Ensure opacity is respecting prop or default full
                    fill: 'none',
                }}
                d={edgePath}
                className="react-flow__edge-path"
                markerEnd={markerEnd}
            />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#ffffff',
                            color: '#000000',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb',
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan"
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
