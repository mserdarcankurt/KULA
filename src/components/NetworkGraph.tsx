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
import { Loader2, RotateCcw, Maximize, Search, X, Users, GitBranch, MapPin } from 'lucide-react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';

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

// ─── Error Boundary ──────────────────────────────────────────

const MapErrorFallback = () => (
  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-stone-50 rounded-[3rem] border border-stone-200">
    <MapPin size={48} className="text-stone-300 mb-4" />
    <h3 className="serif text-xl font-bold text-stone-900 mb-2">Map Rendering Error</h3>
    <p className="text-stone-400 text-sm max-w-[240px]">
      Something went wrong while rendering the trust constellation map.
    </p>
  </div>
);

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Map rendering error captured by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ─── Polyline Overlay for Google Maps ────────────────────────

interface PolylineProps {
  path: { lat: number; lng: number }[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  dashed?: boolean;
}

function MapPolyline({
  path,
  strokeColor = '#000000',
  strokeOpacity = 1.0,
  strokeWeight = 2,
  dashed = false
}: PolylineProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !(window as any).google || !(window as any).google.maps) return;

    const polyline = new (window as any).google.maps.Polyline({
      path,
      strokeColor,
      strokeOpacity,
      strokeWeight,
      icons: dashed ? [{
        icon: {
          path: 'M 0,-1 0,1',
          strokeOpacity: 1,
          scale: 2
        },
        offset: '0',
        repeat: '10px'
      }] : [],
    });

    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map, path, strokeColor, strokeOpacity, strokeWeight, dashed]);

  return null;
}

// ─── Map Controller for Reactive Pan/Zoom/Fit ───────────────

interface MapControllerProps {
  center: { lat: number; lng: number };
  zoom: number;
  fitBoundsTrigger: number;
  nodes: GraphNode[];
}

function MapController({
  center,
  zoom,
  fitBoundsTrigger,
  nodes,
}: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (map) {
      map.panTo(center);
      map.setZoom(zoom);
    }
  }, [map, center, zoom]);

  useEffect(() => {
    if (!map || !(window as any).google || fitBoundsTrigger === 0) return;

    const bounds = new (window as any).google.maps.LatLngBounds();
    let hasCoords = false;

    nodes.forEach(n => {
      if (n.neighborhoodCenter && 
          typeof n.neighborhoodCenter.lat === 'number' && 
          typeof n.neighborhoodCenter.lng === 'number' &&
          !isNaN(n.neighborhoodCenter.lat) && 
          !isNaN(n.neighborhoodCenter.lng)) {
        bounds.extend(n.neighborhoodCenter);
        hasCoords = true;
      }
    });

    if (hasCoords) {
      map.fitBounds(bounds);
    }
  }, [map, fitBoundsTrigger, nodes]);

  return null;
}

// ─── Component ───────────────────────────────────────────────

interface NetworkGraphProps {
  onClose?: () => void;
  trustFilter?: number;
  onNavigateToChat?: (chatId: string) => void;
}

export default function NetworkGraph({ onClose, trustFilter = 6, onNavigateToChat }: NetworkGraphProps) {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useTrustNetwork(4);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<'COMMUNITY' | 'LINEAGE'>('COMMUNITY');

  // Map state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 52.5200, lng: 13.4050 });
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState<number>(0);

  // Filter data based on view mode (Lineage only shows vertical invites within +2/-3 generations)
  const graphData = React.useMemo(() => {
    let baseNodes = data.nodes;
    let baseLinks = data.links;

    if (viewMode === 'COMMUNITY') {
      if (trustFilter < 6) {
        baseNodes = data.nodes.filter(n => n.degree <= trustFilter);
      }

      const nodeIds = new Set(baseNodes.map(n => n.id));
      baseLinks = data.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      });

      return {
        nodes: baseNodes,
        links: baseLinks,
        lineageIds: data.lineageIds
      };
    }

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
  }, [data, viewMode, trustFilter]);

  // Set map center to user's home location once loaded
  useEffect(() => {
    if (!loading && data.nodes.length > 0 && user) {
      const selfNode = data.nodes.find(n => n.id === user.uid);
      if (selfNode?.neighborhoodCenter) {
        setMapCenter(selfNode.neighborhoodCenter);
      }
    }
  }, [loading, data.nodes, user]);

  // ─── Interactions ──────────────────────────────────────────

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.id !== user?.uid) {
      setSelectedProfileId(node.id);
    }
  }, [user?.uid]);

  const handleZoomToFit = useCallback(() => {
    setFitBoundsTrigger(prev => prev + 1);
  }, []);

  const handleRecenter = useCallback(() => {
    if (user) {
      const selfNode = data.nodes.find(n => n.id === user.uid);
      if (selfNode?.neighborhoodCenter) {
        setMapCenter(selfNode.neighborhoodCenter);
        setMapZoom(13);
      }
    }
  }, [user, data.nodes]);

  const handleSearchSelect = useCallback((nodeId: string) => {
    const node = data.nodes.find(n => n.id === nodeId);
    if (node?.neighborhoodCenter) {
      setMapCenter(node.neighborhoodCenter);
      setMapZoom(14);
      setHoveredNode(nodeId);
      setTimeout(() => setHoveredNode(null), 3000);
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
      <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50">
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
      <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50 p-8 text-center">
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

  if (!API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-stone-50 rounded-[3rem] border-2 border-stone-100 border-dashed">
        <MapPin size={48} className="text-stone-300 mb-4" />
        <h3 className="serif text-xl font-bold text-stone-900 mb-2">Maps Unavailable</h3>
        <p className="text-stone-400 text-sm max-w-[240px]">
          Please configure the <code>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> in settings to see your trust network on the map.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-stone-50 overflow-hidden">
      {/* Subtle film-grain overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      />

      {/* ── View Rendering ────────────────────────────────── */}
      {viewMode === 'LINEAGE' ? (
        <LineageTree data={graphData} onNodeClick={(id) => setSelectedProfileId(id)} />
      ) : (
        <div className="h-full w-full relative z-[2]">
          <MapErrorBoundary fallback={<MapErrorFallback />}>
            <Map
              defaultCenter={mapCenter}
              defaultZoom={mapZoom}
              mapId="bf50a3734cf08349"
              disableDefaultUI={true}
              style={{ width: '100%', height: '100%' }}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              <MapController 
                center={mapCenter} 
                zoom={mapZoom} 
                fitBoundsTrigger={fitBoundsTrigger} 
                nodes={graphData.nodes} 
              />

              {/* Draw Links/Connections */}
              {graphData.links.map((link, idx) => {
                const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

                const sourceNode = graphData.nodes.find(n => n.id === sourceId);
                const targetNode = graphData.nodes.find(n => n.id === targetId);

                if (!sourceNode?.neighborhoodCenter || !targetNode?.neighborhoodCenter ||
                    typeof sourceNode.neighborhoodCenter.lat !== 'number' || typeof sourceNode.neighborhoodCenter.lng !== 'number' ||
                    isNaN(sourceNode.neighborhoodCenter.lat) || isNaN(sourceNode.neighborhoodCenter.lng) ||
                    typeof targetNode.neighborhoodCenter.lat !== 'number' || typeof targetNode.neighborhoodCenter.lng !== 'number' ||
                    isNaN(targetNode.neighborhoodCenter.lat) || isNaN(targetNode.neighborhoodCenter.lng)) {
                  return null;
                }

                const isHighlighted = hoveredNode &&
                  (sourceId === hoveredNode || targetId === hoveredNode);

                const isDimmed = hoveredNode !== null && !isHighlighted;

                const path = [sourceNode.neighborhoodCenter, targetNode.neighborhoodCenter];
                const opacity = isHighlighted ? 0.95 : (isDimmed ? 0.05 : 0.35);

                return (
                  <MapPolyline
                    key={`link-${link.source}-${link.target}-${idx}`}
                    path={path}
                    strokeColor={link.type === 'VOUCH' ? '#059669' : '#78716c'}
                    strokeOpacity={opacity}
                    strokeWeight={isHighlighted ? 4 : 2}
                    dashed={link.type === 'VOUCH'}
                  />
                );
              })}

              {/* Draw Nodes/Markers */}
              {graphData.nodes.map(node => {
                if (!node.neighborhoodCenter ||
                    typeof node.neighborhoodCenter.lat !== 'number' || typeof node.neighborhoodCenter.lng !== 'number' ||
                    isNaN(node.neighborhoodCenter.lat) || isNaN(node.neighborhoodCenter.lng)) {
                  return null;
                }

                const colors = DEGREE_COLORS[node.degree] || DEGREE_COLORS[4];
                const isSelf = node.id === user?.uid;
                const isHovered = hoveredNode === node.id;
                
                const isNeighborOfHovered = hoveredNode && graphData.links.some(
                  (l: any) => {
                    const sId = typeof l.source === 'object' ? l.source.id : l.source;
                    const tId = typeof l.target === 'object' ? l.target.id : l.target;
                    return (sId === hoveredNode && tId === node.id) ||
                           (tId === hoveredNode && sId === node.id);
                  }
                );
                
                const isDimmed = hoveredNode !== null && !isHovered && !isNeighborOfHovered && node.id !== user?.uid;
                
                const baseRadius = isSelf ? 20 : node.degree === 1 ? 16 : node.degree === 2 ? 14 : 12;

                return (
                  <AdvancedMarker
                    key={node.id}
                    position={node.neighborhoodCenter}
                    onClick={() => handleNodeClick(node)}
                  >
                    <div
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className="relative flex items-center justify-center rounded-full transition-all cursor-pointer"
                      style={{
                        width: `${baseRadius * 2}px`,
                        height: `${baseRadius * 2}px`,
                        backgroundColor: '#f5f5f4',
                        border: `3px solid ${colors.border}`,
                        boxShadow: isHovered 
                          ? `0 0 16px ${colors.glow}, 0 6px 10px rgba(0,0,0,0.15)` 
                          : (isSelf ? `0 0 12px ${colors.glow}` : `0 4px 6px rgba(0,0,0,0.08)`),
                        transform: isHovered ? 'scale(1.15)' : 'scale(1.0)',
                        opacity: isDimmed ? 0.3 : 1.0,
                        zIndex: isSelf ? 10 : (isHovered ? 20 : 5),
                      }}
                    >
                      {node.photo ? (
                        <img
                          src={node.photo}
                          alt={node.name}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span
                          className="font-bold text-stone-700 leading-none select-none"
                          style={{
                            fontSize: `${baseRadius * 0.9}px`,
                          }}
                        >
                          {node.name.charAt(0).toUpperCase()}
                        </span>
                      )}

                      {/* Label (always show for self or hovered/neighbor-of-hovered) */}
                      {(isSelf || isHovered || isNeighborOfHovered) && (
                        <div className="absolute top-full mt-1.5 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-stone-200/60 text-[9px] font-black tracking-wider uppercase text-stone-700 whitespace-nowrap shadow-md pointer-events-none z-30">
                          {isSelf ? 'You' : node.name.split(' ')[0]}
                        </div>
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}
            </Map>
          </MapErrorBoundary>

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
        </div>
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
          <span>Community</span>
        </button>
        <button 
          onClick={() => setViewMode('LINEAGE')}
          className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
            viewMode === 'LINEAGE' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <GitBranch size={14} />
          <span>Lineage</span>
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

      {/* ── Profile Sheet ─────────────────────────────────── */}
      {selectedProfileId && (
        <PublicProfile
          userId={selectedProfileId}
          onClose={() => setSelectedProfileId(null)}
          onNavigateToChat={onNavigateToChat}
        />
      )}
    </div>
  );
}


