import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Item } from '../types';
import { Heart, Tag, X, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';

interface MapViewProps {
  items: Item[];
  center: { lat: number; lng: number };
  onItemClick?: (item: Item) => void;
}

interface MarkerWithInfoWindowProps {
  item: Item;
  key?: string | number;
  onItemClick?: (item: Item) => void;
}

function MarkerWithInfoWindow({ item, onItemClick }: MarkerWithInfoWindowProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={item.location}
        onClick={() => setOpen(true)}
      >
        <Pin 
          background={item.type === 'SHARE' ? '#10b981' : '#f59e0b'} 
          glyphColor="#fff" 
          borderColor="#fff"
        />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2 max-w-[200px]" onClick={() => onItemClick?.(item)} style={{ cursor: onItemClick ? 'pointer' : 'default' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full text-white ${
                item.type === 'SHARE' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}>
                {item.type}
              </span>
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                {item.category || 'General'}
              </span>
            </div>
            <h4 className="font-bold text-stone-900 text-sm mb-1 leading-tight">{item.title}</h4>
            {item.createdAt && (
              <div className="flex items-center gap-1 text-[8px] text-stone-400 mb-1 font-bold uppercase tracking-tighter">
                <Clock size={8} />
                <span>{formatDistanceToNow(item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt), { addSuffix: true })}</span>
              </div>
            )}
            <p className="text-[10px] text-stone-500 line-clamp-2 italic mb-2">"{item.description}"</p>
            <button className="w-full py-1.5 bg-stone-900 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest">
              View Detail
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default function MapView({ items, center, onItemClick }: MapViewProps) {
  if (!API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-stone-50 rounded-[3rem] border-2 border-stone-100 border-dashed">
        <MapPin size={48} className="text-stone-300 mb-4" />
        <h3 className="serif text-xl font-bold text-stone-900 mb-2">Maps Unavailable</h3>
        <p className="text-stone-400 text-sm max-w-[240px]">
          Please configure the <code>GOOGLE_MAPS_PLATFORM_KEY</code> in settings to see Kula activity near you.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-[2.5rem] overflow-hidden shadow-inner border-4 border-white">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={center}
          defaultZoom={13}
          mapId="bf50a3734cf08349"
          disableDefaultUI={true}
          style={{ width: '100%', height: '100%' }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {items.map(item => (
            <MarkerWithInfoWindow key={item.id} item={item} onItemClick={onItemClick} />
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
