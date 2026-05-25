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
import { fetchTaxonomy, loadPlants } from '../api'
import type { TaxonomyItem } from '../types'

interface Props {
  onFamilySelect: (family: string) => void
}

const ROOT_ID = 'root'

export default function TaxonomyTree({ onFamilySelect }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([fetchTaxonomy(), loadPlants()])
      .then(([taxa, plants]) => buildGraph(taxa, plants as any[]))
      .finally(() => setLoading(false))
  }, [])

  const buildGraph = (taxa: TaxonomyItem[], allPlants: any[]) => {
    const COLS = 6
    const COL_W = 200
    const ROW_H = 90

    const root: Node = {
      id: ROOT_ID,
      data: { label: '🌿 Казахстан' },
      position: { x: (COLS * COL_W) / 2 - 80, y: 0 },
      style: {
        background: '#166534',
        color: '#fff',
        borderRadius: 12,
        padding: '8px 18px',
        fontWeight: 700,
        border: 'none',
      },
    }

    const allNodes: Node[] = [root]
    const allEdges: Edge[] = []

    // Group plants by family → life_form
    const familyGroups: Record<string, Record<string, any[]>> = {}
    allPlants.forEach((p: any) => {
      const fam = p.family || 'Unknown'
      const lf = p.life_form || 'Unknown'
      if (!familyGroups[fam]) familyGroups[fam] = {}
      if (!familyGroups[fam][lf]) familyGroups[fam][lf] = []
      familyGroups[fam][lf].push(p)
    })

    // Create family nodes
    taxa.forEach((t: TaxonomyItem, familyIdx: number) => {
      const familyNodeId = `family-${t.id}`
      allNodes.push({
        id: familyNodeId,
        data: {
          label: `${t.name_la}\n(${t.plant_count})`,
          family: t.name_la,
        },
        position: { x: (familyIdx % COLS) * COL_W, y: Math.floor(familyIdx / COLS) * ROW_H + ROW_H },
        style: {
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
          fontSize: 11,
          cursor: 'pointer',
          padding: '6px 10px',
          whiteSpace: 'pre' as const,
        },
      })

      allEdges.push({
        id: `e-root-${t.id}`,
        source: ROOT_ID,
        target: familyNodeId,
        style: { stroke: '#bbf7d0' },
      })

      // Create life_form and plant nodes only if family is expanded
      if (expandedFamilies.has(t.name_la)) {
        const lifeFormGroup = familyGroups[t.name_la] || {}
        let lifeFormY = Math.floor(familyIdx / COLS) * ROW_H + ROW_H * 2

        Object.entries(lifeFormGroup).forEach(([lifeForm, plants]: [string, any[]], lifeFormIdx: number) => {
          const lifeFormNodeId = `lf-${t.id}-${lifeFormIdx}`

          allNodes.push({
            id: lifeFormNodeId,
            data: { label: lifeForm },
            position: {
              x: (familyIdx % COLS) * COL_W - 60 + lifeFormIdx * 40,
              y: lifeFormY,
            },
            style: {
              background: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: 6,
              fontSize: 9,
              padding: '4px 8px',
              whiteSpace: 'nowrap' as const,
            },
          })

          allEdges.push({
            id: `e-family-${t.id}-${lifeFormIdx}`,
            source: familyNodeId,
            target: lifeFormNodeId,
            style: { stroke: '#86efac' },
          })

          // Create plant leaf nodes
          plants.slice(0, 3).forEach((plant: any, plantIdx: number) => {
            const plantNodeId = `plant-${plant.id}`
            allNodes.push({
              id: plantNodeId,
              data: { label: plant.name_la },
              position: {
                x: (familyIdx % COLS) * COL_W - 40 + plantIdx * 40,
                y: lifeFormY + 60,
              },
              style: {
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 8,
                padding: '3px 6px',
                whiteSpace: 'nowrap' as const,
                cursor: 'pointer',
              },
            })

            allEdges.push({
              id: `e-lf-${plant.id}`,
              source: lifeFormNodeId,
              target: plantNodeId,
              style: { stroke: '#d1d5db' },
            })
          })

          lifeFormY += 100
        })
      }
    })

    setNodes(allNodes)
    setEdges(allEdges)
  }

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === ROOT_ID) return

    // If it's a family node, toggle expansion
    if (node.id.startsWith('family-')) {
      const family = node.data.family as string
      setExpandedFamilies(prev => {
        const next = new Set(prev)
        if (next.has(family)) {
          next.delete(family)
        } else {
          next.add(family)
        }
        return next
      })
      return
    }

    // If it's a plant node, select it
    if (node.id.startsWith('plant-')) {
      const plantName = String(node.data.label)
      onFamilySelect(plantName)
      return
    }
  }, [onFamilySelect])

  if (loading) return <p className="py-12 text-center text-sm text-gray-400">Загрузка таксономии…</p>

  return (
    <div className="h-full w-full rounded-xl border border-gray-100 overflow-hidden relative">
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
        Клик на семейство → раскрыть, клик на растение → выбрать
      </p>
    </div>
  )
}
