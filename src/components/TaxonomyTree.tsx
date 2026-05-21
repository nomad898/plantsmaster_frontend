import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { fetchTaxonomy } from '../api'
import type { TaxonomyItem } from '../types'

interface Props {
  onFamilySelect: (family: string) => void
}

const ROOT_ID = 'root'

export default function TaxonomyTree({ onFamilySelect }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTaxonomy()
      .then(buildGraph)
      .finally(() => setLoading(false))
  }, [])

  const buildGraph = (taxa: TaxonomyItem[]) => {
    const COLS = 6
    const COL_W = 200
    const ROW_H = 90

    const root: Node = {
      id: ROOT_ID,
      data: { label: '🌿 Казахстан' },
      position: { x: (COLS * COL_W) / 2 - 80, y: 0 },
      style: {
        background: '#166534', color: '#fff', borderRadius: 12,
        padding: '8px 18px', fontWeight: 700, border: 'none',
      },
    }

    const familyNodes: Node[] = taxa.map((t, i) => ({
      id: String(t.id),
      data: { label: `${t.name_la}\n(${t.plant_count})` },
      position: { x: (i % COLS) * COL_W, y: Math.floor(i / COLS) * ROW_H + ROW_H },
      style: {
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, fontSize: 11, cursor: 'pointer',
        padding: '6px 10px', whiteSpace: 'pre',
      },
    }))

    const familyEdges: Edge[] = taxa.map(t => ({
      id: `e-${t.id}`,
      source: ROOT_ID,
      target: String(t.id),
      style: { stroke: '#bbf7d0' },
    }))

    setNodes([root, ...familyNodes])
    setEdges(familyEdges)
  }

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === ROOT_ID) return
    const label = String(node.data.label).split('\n')[0]
    onFamilySelect(label)
  }, [onFamilySelect])

  if (loading) return <p className="py-12 text-center text-sm text-gray-400">Загрузка таксономии…</p>

  return (
    <div className="h-full w-full rounded-xl border border-gray-100 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.2}
      >
        <Background />
        <Controls />
        <MiniMap nodeStrokeWidth={3} />
      </ReactFlow>
      <p className="absolute bottom-14 left-4 rounded bg-white/80 px-2 py-1 text-xs text-gray-400 shadow">
        Нажмите на семейство для фильтрации
      </p>
    </div>
  )
}
