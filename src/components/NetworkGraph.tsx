/**
 * FILE: NetworkGraph.tsx
 * ROLE IN KULA: The "Trust Constellation" — an interactive graph of all community connections.
 * 
 * CIRCUIT C (Trust Fabric):
 *   This is the VISUAL representation of the trust graph built from:
 *     - INVITE links (solid lines): host-to-guest relationships
 *     - VOUCH links (dashed lines): peer-to-peer trust endorsements
 * 
 * DATA SOURCE:
 *   useTrustNetwork.ts hook (maxDegree=4) constructs the graph by:
 *   1. Loading all users
 *   2. Building edges from hostId fields (INVITE type)
 *   3. Building edges from vouches collection (VOUCH type)
 *   4. Running BFS from current user to assign degree (0=self, 1=direct, etc.)
 * 
 * RENDERING:
 *   Uses react-force-graph-2d with HTML Canvas (not SVG/DOM) for performance.
 *   - drawNode(): Custom node painter with avatar clipping, degree-based coloring,
 *     hover glow effects, and smart label visibility
 *   - drawLink(): Custom link painter with invite/vouch differentiation and
 *     hover-based opacity dimming for focus
 * 
 * DEGREE COLOR MAP (artDirection aligned):
 *   - 0 (You): Olive (#5c5c3d) — brand color, largest node
 *   - 1st: Emerald (#059669) — direct trust connections
 *   - 2nd: Blue (#2563eb) — friends-of-friends
 *   - 3rd: Amber (#d97706) — extended network
 *   - 4th+: Stone (#78716c) — distant periphery
 * 
 * VIEW MODES:
 *   - COMMUNITY: Full force-directed graph with all nodes and links
 *   - LINEAGE: Filtered to only INVITE edges, rendered as LineageTree.tsx
 *     (vertical hierarchical tree with SVG Bezier curves)
 * 
 * INTERACTIONS:
 *   - Click node → opens PublicProfile.tsx (except self)
 *   - Hover node → dims unrelated nodes, highlights neighbors
 *   - Search → finds user by name, zooms/highlights temporarily
 *   - Recenter → zooms to self node
 *   - Zoom-to-fit → shows full network
 * 
 * CALLED BY: Explore.tsx (NETWORK view mode)
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTrustNetwork, GraphNode, GraphLink } from '../hooks/useTrustNetwork';
import { useAuth } from '../hooks/useAuth';
import PublicProfile from './PublicProfile';
import LineageTree from './LineageTree';
import { Loader2, RotateCcw, Maximize, Search, X, Users, GitBranch } from 'lucide-react';

// ─── Color palette (art direction: warm, earthy, analog) ─────

const DEGREE_COLORS: Record<number, { fill: string; border: string; glow: string }> = {
  0: { fill: '#5c5c3d', border: '#3d3d29', glow: 'rgba(92,92,61,0.4)' },   // You — olive/brand
  1: { fill: '#059669', border: '#047857', glow: 'rgba(5,150,105,0.3)' },    // 1st — emerald
  2: { fill: '#2563eb', border: '#1d4ed8', glow: 'rgba(37,99,235,0.25)' },   // 2nd — blue
  3: { fill: '#d97706', border: '#b45309', glow: 'rgba(217,119,6,0.25)' },   // 3rd — amber
  4: { fill: '#78716c', border: '#57534e', glow: 'rgba(120,113,108,0.2)' },   // 4th — stone
};

const LINK_COLORS = {
  INVITE: 'rgba(168, 162, 158, 0.5)',  // warm gray — formal trust
  VOUCH: 'rgba(5, 150, 105, 0.35)',    // soft emerald — peer trust
};

// ─── Component ───────────────────────────────────────────────

interface NetworkGraphProps {
  onClose?: () => void;
}

export default function NetworkGraph({ onClose }: NetworkGraphProps) {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useTrustNetwork(4);
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [imageCache] = useState(new Map<string, HTMLImageElement>());
  const [viewMode, setViewMode] = useState<'COMMUNITY' | 'LINEAGE'>('COMMUNITY');

  // Filter data based on view mode (Lineage only shows vertical invites within +2/-3 generations)
  const graphData = React.useMemo(() => {
    if (viewMode === 'COMMUNITY') return data;
    if (!data.lineageIds) return { nodes: [], links: [], lineageIds: new Set<string>() };
    
    return {
      nodes: data.nodes.filter(n => data.lineageIds.has(n.id)),
      links: data.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return l.type === 'INVITE' && data.lineageIds.has(sourceId) && data.lineageIds.has(targetId);
      }),
      lineageIds: data.lineageIds
    };
  }, [data, viewMode]);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Center on the user node after data loads and tune physics
  useEffect(() => {
    if (!loading && data.nodes.length > 0 && graphRef.current && viewMode === 'COMMUNITY') {
      // Tune physics to spread nodes out and reduce clutter
      graphRef.current.d3Force('charge').strength(-300);
      graphRef.current.d3Force('charge').distanceMax(800); // reset for community
      graphRef.current.d3Force('link').distance(50);

      // Small delay to let the physics settle
      setTimeout(() => {
        if (graphRef.current) {
          const selfNode = data.nodes.find(n => n.id === user?.uid);
          if (selfNode) {
            graphRef.current.centerAt((selfNode as any).x, (selfNode as any).y, 1000);
            graphRef.current.zoom(2.2, 1000);
          }
        }
      }, 1500);
    }
  }, [loading, data.nodes.length, user?.uid, viewMode]);

  // Preload avatar images
  useEffect(() => {
    data.nodes.forEach(node => {
      if (node.photo && !imageCache.has(node.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = node.photo;
        img.onload = () => imageCache.set(node.id, img);
      }
    });
  }, [data.nodes, imageCache]);

  // ─── Canvas draw for each node ─────────────────────────────

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const gNode = node as GraphNode;
    const colors = DEGREE_COLORS[gNode.degree] || DEGREE_COLORS[4];
    const isSelf = gNode.id === user?.uid;
    const isHovered = hoveredNode === gNode.id;
    const isNeighborOfHovered = hoveredNode && graphData.links.some(
      (l: any) => (l.source?.id === hoveredNode && l.target?.id === gNode.id) ||
                  (l.target?.id === hoveredNode && l.source?.id === gNode.id)
    );
    const isDimmed = hoveredNode !== null && !isHovered && !isNeighborOfHovered && gNode.id !== user?.uid;

    // Make nodes generally larger so they are visible from a distance
    const baseRadius = isSelf ? 16 : gNode.degree === 1 ? 13 : gNode.degree === 2 ? 11 : 9;
    const radius = isHovered ? baseRadius * 1.3 : baseRadius;

    ctx.save();

    if (isDimmed) {
      ctx.globalAlpha = 0.15;
    }

    // Outer glow
    if (isHovered || isSelf) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
      ctx.fillStyle = colors.glow;
      ctx.fill();
    }

    // Border ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = colors.border;
    ctx.fill();

    // Inner circle (clip for avatar)
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#f5f5f4'; // stone-100 base
    ctx.fill();

    // Avatar image
    const cachedImg = imageCache.get(gNode.id);
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(cachedImg, node.x - radius, node.y - radius, radius * 2, radius * 2);
      ctx.restore();
    } else {
      // Fallback: first letter
      const fontSize = radius * 0.9;
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = colors.fill;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gNode.name.charAt(0).toUpperCase(), node.x, node.y + 0.5);
    }

    // Label (only show for Self, Hovered, or Neighbors of Hovered to reduce clutter)
    const showLabel = isSelf || isHovered || isNeighborOfHovered || globalScale > 2.5;

    if (showLabel) {
      const label = isSelf ? 'You' : gNode.name.split(' ')[0];
      const labelSize = Math.max(3.5, 12 / globalScale); // slightly larger text
      ctx.font = `bold ${labelSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Label background
      const textWidth = ctx.measureText(label).width;
      const padding = 3 / globalScale;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      const rx = node.x - textWidth / 2 - padding;
      const ry = node.y + radius + 3;
      const rw = textWidth + padding * 2;
      const rh = labelSize + padding * 2;
      const cornerRadius = 2 / globalScale;
      ctx.roundRect(rx, ry, rw, rh, cornerRadius);
      ctx.fill();

      ctx.fillStyle = isSelf ? '#3d3d29' : '#57534e';
      ctx.fillText(label, node.x, node.y + radius + 3 + padding);
    }

    ctx.restore();
  }, [user?.uid, hoveredNode, graphData.links, imageCache, viewMode]);

  // ─── Link rendering ────────────────────────────────────────

  const drawLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const gLink = link as GraphLink & { source: any; target: any };
    const isVouch = gLink.type === 'VOUCH';
    const source = gLink.source;
    const target = gLink.target;

    const isHighlighted = hoveredNode &&
      (source.id === hoveredNode || target.id === hoveredNode);

    ctx.save();

    if (hoveredNode && !isHighlighted) {
      ctx.globalAlpha = 0.06;
    }

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);

    // Dynamic opacity: subtle by default, bold on hover
    const opacity = isHighlighted ? 0.9 : 0.2;
    ctx.strokeStyle = isVouch 
      ? `rgba(5, 150, 105, ${opacity})` 
      : `rgba(168, 162, 158, ${opacity + 0.1})`; // invites slightly darker than vouches
      
    ctx.lineWidth = isHighlighted ? 2.5 / globalScale : 1 / globalScale;

    if (isVouch) {
      ctx.setLineDash([4 / globalScale, 3 / globalScale]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, [hoveredNode]);

  // ─── Interactions ──────────────────────────────────────────

  const handleNodeClick = useCallback((node: any) => {
    const gNode = node as GraphNode;
    if (gNode.id !== user?.uid) {
      setSelectedProfileId(gNode.id);
    }
  }, [user?.uid]);

  const handleZoomToFit = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(600, 60);
    }
  }, []);

  const handleRecenter = useCallback(() => {
    if (graphRef.current && user) {
      const selfNode = data.nodes.find(n => n.id === user.uid);
      if (selfNode) {
        graphRef.current.centerAt((selfNode as any).x, (selfNode as any).y, 800);
        graphRef.current.zoom(2.5, 800);
      }
    }
  }, [user, data.nodes]);

  const handleSearchSelect = useCallback((nodeId: string) => {
    if (graphRef.current) {
      const node = data.nodes.find(n => n.id === nodeId);
      if (node) {
        graphRef.current.centerAt((node as any).x, (node as any).y, 800);
        graphRef.current.zoom(3, 800);
        setHoveredNode(nodeId);
        setTimeout(() => setHoveredNode(null), 3000);
      }
    }
    setShowSearch(false);
    setSearchQuery('');
  }, [data.nodes]);

  const filteredSearch = searchQuery.length > 0
    ? graphData.nodes.filter(n =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase()) && n.id !== user?.uid
      ).slice(0, 5)
    : [];

  // ─── Loading / Error states ────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-stone-300" />
          <p className="text-stone-400 font-bold text-xs uppercase tracking-widest">
            Mapping your neighborhood...
          </p>
        </div>
      </div>
    );
  }

  if (error || graphData.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-stone-50 p-8">
        <div className="text-center space-y-4">
          <p className="serif text-xl text-stone-600 font-bold">No connections yet</p>
          <p className="text-stone-400 text-sm">
            Your trust network will grow as you invite neighbors and vouch for each other.
          </p>
          <button
            onClick={refresh}
            className="px-6 py-2 bg-stone-900 text-white rounded-full text-xs font-bold uppercase tracking-widest"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative flex-1 bg-stone-50 overflow-hidden">
      {/* Subtle film-grain overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      />

      {/* ── View Rendering ────────────────────────────────── */}
      {viewMode === 'LINEAGE' ? (
        <LineageTree data={graphData} />
      ) : (
        <>
          {/* The graph canvas */}
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            nodeCanvasObject={drawNode}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              const gNode = node as GraphNode;
              const r = gNode.degree === 0 ? 16 : gNode.degree === 1 ? 13 : 11;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
              ctx.fill();
            }}
            linkCanvasObject={drawLink}
            onNodeClick={handleNodeClick}
            onNodeHover={(node: any) => setHoveredNode(node?.id || null)}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={80}
            cooldownTicks={200}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />

          {/* ── Floating Controls (Community Mode Only) ────────── */}
          <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg text-stone-600 hover:bg-white transition-all border border-stone-100"
              title="Search neighbor"
            >
              <Search size={18} />
            </button>
            <button
              onClick={handleRecenter}
              className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg text-stone-600 hover:bg-white transition-all border border-stone-100"
              title="Center on you"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={handleZoomToFit}
              className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg text-stone-600 hover:bg-white transition-all border border-stone-100"
              title="Fit all"
            >
              <Maximize size={18} />
            </button>
          </div>

          {/* ── Legend & Stats (Community Mode Only) ──────────────── */}
          <div className="absolute bottom-6 left-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-stone-100 p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Network</p>
              <p className="text-[10px] font-bold text-stone-600 leading-relaxed">
                {graphData.nodes.length} Neighbors<br/>
                {graphData.links.length} Connections
              </p>
            </div>
            
            <div className="w-full h-[1px] bg-stone-100" />

            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Trust Links</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-[2px] bg-stone-400 rounded" />
                <span className="text-[10px] text-stone-500 font-medium">Invite</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-[2px] border-t-2 border-dashed border-emerald-400 rounded" />
                <span className="text-[10px] text-stone-500 font-medium">Vouch</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Common Floating Controls ──────────────────────── */}
      
      {/* View Mode Toggle (Top Center) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex bg-white/90 backdrop-blur-md p-1 rounded-full border border-stone-200 shadow-sm">
        <button 
          onClick={() => setViewMode('COMMUNITY')}
          className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
            viewMode === 'COMMUNITY' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Users size={14} />
          <span className="hidden sm:inline">Community</span>
        </button>
        <button 
          onClick={() => setViewMode('LINEAGE')}
          className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
            viewMode === 'LINEAGE' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <GitBranch size={14} />
          <span className="hidden sm:inline">Lineage</span>
        </button>
      </div>



      {/* ── Search Overlay ────────────────────────────────── */}
      {showSearch && (
        <div className="absolute top-4 left-4 right-4 z-20">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl border border-stone-100 p-3">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-stone-400" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Find a neighbor..."
                className="flex-1 text-sm bg-transparent outline-none text-stone-800 placeholder:text-stone-300 font-medium"
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-stone-400 hover:text-stone-600">
                <X size={16} />
              </button>
            </div>
            {filteredSearch.length > 0 && (
              <div className="mt-2 border-t border-stone-100 pt-2 space-y-1">
                {filteredSearch.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleSearchSelect(n.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-stone-100 overflow-hidden flex-shrink-0">
                      {n.photo ? (
                        <img src={n.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-bold">
                          {n.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-800">{n.name}</p>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                        {n.degree === 1 ? '1st degree' : n.degree === 2 ? '2nd degree' : `${n.degree}° away`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-4 z-10 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-stone-100 p-3 space-y-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Trust Links</p>
        <div className="flex items-center gap-2">
          <div className="w-6 h-[2px] bg-stone-400 rounded" />
          <span className="text-[10px] text-stone-500 font-medium">Invite</span>
        </div>
        {viewMode === 'COMMUNITY' && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-[2px] border-t-2 border-dashed border-emerald-400 rounded" />
            <span className="text-[10px] text-stone-500 font-medium">Vouch</span>
          </div>
        )}
      </div>



      {/* ── Profile Sheet ─────────────────────────────────── */}
      {selectedProfileId && (
        <PublicProfile
          userId={selectedProfileId}
          onClose={() => setSelectedProfileId(null)}
        />
      )}
    </div>
  );
}
