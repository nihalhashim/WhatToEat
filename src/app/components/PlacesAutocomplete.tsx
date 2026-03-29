'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Suggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (suggestion: Suggestion) => void;
  placeholder?: string;
  className?: string;
  type?: 'general' | 'restaurant';
  userLat?: number;
  userLng?: number;
  disabled?: boolean;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search...',
  className = '',
  type = 'general',
  userLat,
  userLng,
  disabled = false,
}: PlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (input.trim().length < 2) {
        setSuggestions([]);
        setOpen(false);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch('/api/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            type,
            lat: userLat,
            lng: userLng,
          }),
        });
        const data = await res.json();
        if (data.suggestions) {
          setSuggestions(data.suggestions);
          setOpen(data.suggestions.length > 0);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [type, userLat, userLng]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);
    if (val.trim().length >= 2) setIsLoading(true); // show loader immediately on type
    else setIsLoading(false);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  const handleSelect = (s: Suggestion) => {
    onChange(s.description);
    onSelect(s);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {/* Spinner inside the right side of input */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-[var(--color-qb-green)] rounded-full animate-spin"></div>
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[var(--color-qb-border)] rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.placeId || i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--color-qb-green-light)] transition-colors border-b border-gray-100 last:border-0 ${
                i === activeIndex ? 'bg-[var(--color-qb-green-light)]' : ''
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 text-[var(--color-qb-green)] mt-0.5 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
              <div className="min-w-0">
                <p className="font-medium text-sm text-[var(--color-qb-text)] truncate">
                  {s.mainText || s.description}
                </p>
                {s.secondaryText && (
                  <p className="text-xs text-[var(--color-qb-text-muted)] truncate">
                    {s.secondaryText}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
