import React, { useState, useEffect, useRef } from 'react';

interface AddressAutocompleteProps {
  onSelect: (coords: { lat: number; lng: number }, address: string) => void;
  placeholder?: string;
}

export default function AddressAutocomplete({ onSelect, placeholder = 'Search address...' }: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch address predictions from OpenStreetMap Nominatim
  useEffect(() => {
    if (!inputValue.trim() || inputValue.trim().length < 3) {
      setPredictions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Query Nominatim API with a custom User-Agent to comply with usage policy
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&addressdetails=1&limit=5`,
          {
            headers: {
              'Accept-Language': 'de,en;q=0.9',
              'User-Agent': 'KulaApp/1.0 (local community mesh tool)'
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          setPredictions(data || []);
          setShowDropdown(true);
        } else {
          setPredictions([]);
        }
      } catch (err) {
        console.error('Nominatim autocomplete error:', err);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 450); // Slightly longer debounce to respect rate limits

    return () => clearTimeout(timer);
  }, [inputValue]);

  const handleSelectPrediction = (prediction: any) => {
    const latVal = parseFloat(prediction.lat);
    const lngVal = parseFloat(prediction.lon);
    const displayName = prediction.display_name;

    if (!isNaN(latVal) && !isNaN(lngVal)) {
      onSelect({ lat: latVal, lng: lngVal }, displayName);
      setInputValue(displayName);
      setShowDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (predictions.length > 0) {
        handleSelectPrediction(predictions[0]);
      }
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-stone-50 border-2 border-stone-100 rounded-xl pl-3 pr-10 py-2.5 text-sm focus:border-stone-900 outline-none transition-all"
        />
        <div className="absolute right-3 text-stone-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
      </div>

      {loading && (
        <div className="absolute right-10 top-3.5 flex items-center gap-1">
          <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce" />
          <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce [animation-delay:0.2s]" />
          <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
      )}

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-stone-100 p-1">
          {predictions.map((pred) => {
            // Build a clean main title and secondary subtitle
            const title = pred.name || pred.display_name.split(',')[0];
            const remainingParts = pred.display_name.split(',').slice(1).join(',').trim();

            return (
              <button
                key={pred.place_id}
                type="button"
                onClick={() => handleSelectPrediction(pred)}
                className="w-full text-left px-3 py-2.5 hover:bg-stone-50 rounded-xl text-xs text-stone-700 transition-colors flex flex-col gap-0.5"
              >
                <div className="font-bold text-stone-800">{title}</div>
                {remainingParts && (
                  <div className="text-[10px] text-stone-400 font-medium truncate">
                    {remainingParts}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
