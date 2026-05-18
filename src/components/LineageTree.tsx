/**
 * FILE: LineageTree.tsx
 * ROLE IN KULA: The "Family Tree" — a visual, hierarchical representation of invite chains.
 * 
 * CIRCUIT C (Trust Fabric):
 *   This is the VISUAL OUTPUT of useTrustNetwork.ts.
 *   It takes the TrustGraphData (nodes + links + lineageIds) and renders a tree
 *   where INVITE links become parent-child relationships and VOUCH links are displayed separately.
 * 
 * TREE BUILDING (useMemo):
 *   1. Create a TreeNodeData for each node (id, children array, depth counter)
 *   2. For each INVITE link, add the target as a child of the source
 *   3. Find ROOT nodes (nodes with no parent — they're at the top of the tree)
 *   4. Calculate depth for each node (root = 0, their children = 1, etc.)
 * 
 * SVG CONNECTION LINES (useLayoutEffect):
 *   After the DOM renders, we measure the actual pixel positions of each node
 *   using getBoundingClientRect(). Then we draw Cubic Bezier curves between
 *   parent and child nodes using SVG <path> elements.
 *   The control points create an organic "A-frame" draping effect where lines
 *   drop down vertically before fanning out horizontally to children.
 * 
 * SCALING:
 *   Deeper generations are SMALLER (scale = 1 - depth × 0.15, minimum 0.4).
 *   This creates a natural perspective where the "elders" at the top are large
 *   and the newest "seedlings" at the bottom are small. Avatar size, ring size,
 *   and font size all scale together.
 * 
 * RECURSIVE RENDERING:
 *   The TreeNode component recursively renders itself for each child,
 *   creating an arbitrarily deep tree structure from the data.
 * 
 * USED BY: NetworkGraph.tsx (as one of the visualization tabs)
 */
import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { TrustGraphData, GraphNode } from '../hooks/useTrustNetwork';
import { useAuth } from '../hooks/useAuth';

interface TreeNodeData {
  node: GraphNode;
  children: TreeNodeData[];
  depth: number;
}

interface LineageTreeProps {
  data: TrustGraphData;
}

export default function LineageTree({ data }: LineageTreeProps) {
  const { user } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const [svgPaths, setSvgPaths] = useState<{ id: string; d: string }[]>([]);

  // ─── Build Tree Structure ────────────────────────────────────
  const { treeRoots } = useMemo(() => {
    if (!data.nodes.length) return { treeRoots: [] };

    const nodesMap = new Map<string, TreeNodeData>();
    data.nodes.forEach(n => {
      nodesMap.set(n.id, { node: n, children: [], depth: 0 });
    });

    const childIds = new Set<string>();

    data.links.forEach(l => {
      if (l.type !== 'INVITE') return;
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;

      const parent = nodesMap.get(sourceId);
      const child = nodesMap.get(targetId);

      if (parent && child) {
        parent.children.push(child);
        childIds.add(targetId);
      }
    });

    const roots: TreeNodeData[] = [];
    nodesMap.forEach((nodeData, id) => {
      if (!childIds.has(id)) {
        roots.push(nodeData);
      }
    });

    const calcDepth = (nodeData: TreeNodeData, currentDepth: number) => {
      nodeData.depth = currentDepth;
      nodeData.children.forEach(c => calcDepth(c, currentDepth + 1));
    };

    roots.forEach(r => calcDepth(r, 0));

    return { treeRoots: roots };
  }, [data]);

  // ─── Calculate SVG Paths ─────────────────────────────────────
  useLayoutEffect(() => {
    const drawLines = () => {
      if (!contentRef.current || !data.links.length) return;
      
      const cRect = contentRef.current.getBoundingClientRect();
      const newPaths: { id: string; d: string }[] = [];

      data.links.forEach(l => {
        if (l.type !== 'INVITE') return;
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;

        const sourceEl = document.getElementById(`lineage-node-${sourceId}`);
        const targetEl = document.getElementById(`lineage-node-${targetId}`);

        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();

          // Calculate center points relative to the contentRef
          const startX = sRect.left - cRect.left + sRect.width / 2;
          const startY = sRect.top - cRect.top + sRect.height / 2;
          const endX = tRect.left - cRect.left + tRect.width / 2;
          const endY = tRect.top - cRect.top + tRect.height / 2;

          // Cubic Bezier curve for an organic "fanning out" A-frame look
          // We pull the control points vertically to make the line drop down before branching out
          const verticalOffset = Math.max(40, (endY - startY) * 0.4);
          const cp1y = startY + verticalOffset;
          const cp2y = endY - verticalOffset;

          const d = `M ${startX},${startY} C ${startX},${cp1y} ${endX},${cp2y} ${endX},${endY}`;
          newPaths.push({ id: `${sourceId}-${targetId}`, d });
        }
      });

      setSvgPaths(newPaths);
    };

    // Draw initially and on resize
    drawLines();
    window.addEventListener('resize', drawLines);
    
    // Sometimes images loading changes layout, a small delay redraw helps
    const timeout = setTimeout(drawLines, 100);
    return () => {
      window.removeEventListener('resize', drawLines);
      clearTimeout(timeout);
    };
  }, [data, treeRoots]);

  if (!treeRoots.length) return null;

  return (
    <div className="w-full h-full overflow-auto bg-stone-50">
      {/* 
        This is the inner container that defines the full canvas size.
        min-w-max ensures it stretches horizontally to fit all children instead of wrapping/squishing. 
      */}
      <div ref={contentRef} className="relative min-w-max min-h-max pt-24 pb-32 px-12 md:px-24">
        
        {/* Subtle film-grain background (fixed to screen) */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
        />

        {/* Dynamic SVG Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {svgPaths.map(path => (
            <path
              key={path.id}
              d={path.d}
              fill="none"
              stroke="#e7e5e4" // stone-200
              strokeWidth="2"
              className="transition-all duration-300 ease-out"
            />
          ))}
        </svg>
        
        {/* The DOM Tree */}
        <div className="relative z-10 flex justify-center w-full">
          {treeRoots.map(root => (
            <TreeNode key={root.node.id} treeNode={root} currentUserId={user?.uid} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Recursive Tree Node Component ─────────────────────────────

interface TreeNodeProps {
  treeNode: TreeNodeData;
  currentUserId?: string;
}

function TreeNode({ treeNode, currentUserId }: TreeNodeProps) {
  const { node, children, depth } = treeNode;
  const isSelf = node.id === currentUserId;

  // Scale down deeper generations to fit horizontally naturally
  const scale = Math.max(0.4, 1 - (depth * 0.15));
  
  const avatarSize = 64 * scale;
  const ringSize = 72 * scale;
  const fontSize = Math.max(10, 14 * scale);

  const glowColor = isSelf ? 'rgba(92,92,61,0.2)' : 'rgba(168,162,158,0.1)';
  const borderColor = isSelf ? '#3d3d29' : '#d6d3d1';

  return (
    <div className="flex flex-col items-center">
      {/* The Avatar Node */}
      <div 
        id={`lineage-node-${node.id}`} 
        className="flex flex-col items-center group cursor-pointer relative z-10 transition-transform hover:scale-105"
      >
        <div 
          className="rounded-full flex items-center justify-center bg-stone-50 transition-shadow duration-300"
          style={{ 
            width: ringSize, 
            height: ringSize, 
            border: `2px solid ${borderColor}`,
            boxShadow: `0 0 0 4px ${glowColor}`
          }}
        >
          <div 
            className="rounded-full overflow-hidden bg-stone-200"
            style={{ width: avatarSize, height: avatarSize }}
          >
            {node.photo ? (
              <img src={node.photo} alt={node.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-500 font-bold" style={{ fontSize }}>
                {node.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 text-center bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-stone-100 shadow-sm">
          <p className="font-bold text-stone-800 tracking-tight" style={{ fontSize }}>
            {isSelf ? 'You' : node.name.split(' ')[0]}
          </p>
        </div>
      </div>

      {/* Children Container - Flex row that naturally spaces them out */}
      {children.length > 0 && (
        <div className="mt-16 flex justify-center gap-6 sm:gap-10 md:gap-16 lg:gap-24">
          {children.map(child => (
            <TreeNode key={child.node.id} treeNode={child} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
