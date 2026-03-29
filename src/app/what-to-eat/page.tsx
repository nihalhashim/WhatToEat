'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PlacesAutocomplete from "@/app/components/PlacesAutocomplete";
import { useSessionState } from "@/app/hooks/useSessionState";
import Image from "next/image";

export default function WhatToEatTool() {
  const router = useRouter();
  const [address, setAddress] = useSessionState<string>('wte-address', '');
  const [results, setResults] = useSessionState<any[]>('wte-results', []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [openNow, setOpenNow] = useState(false);
  const [radius, setRadius] = useSessionState<number>('wte-radius', 5000);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customKm, setCustomKm] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Try to get user location on mount (for biasing autocomplete)
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { }
    );
  }, []);

  const doSearch = async (opts: {
    locAddress?: string;
    lat?: number;
    lng?: number;
    newRadius?: number;
    newMinRating?: number;
    newOpenNow?: boolean;
  }) => {
    const {
      locAddress, lat, lng,
      newRadius = radius,
      newMinRating = minRating,
      newOpenNow = openNow,
    } = opts;

    if (!locAddress && (!lat || !lng)) return;

    setLoading(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        radius: newRadius,
        minRating: newMinRating,
        openNow: newOpenNow,
      };
      if (lat && lng) { body.lat = lat; body.lng = lng; }
      else { body.address = locAddress; }

      const res = await fetch("/api/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (coords) doSearch({ lat: coords.lat, lng: coords.lng });
    else doSearch({ locAddress: address });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setAddress("Current Location 📍");
        setCoords({ lat: latitude, lng: longitude });
        doSearch({ lat: latitude, lng: longitude });
      },
      err => {
        setError(err.code === err.PERMISSION_DENIED
          ? "Location denied. Please allow location or type an address."
          : "Couldn't get location. Please type an address."
        );
        setLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleLocationSelect = (suggestion: any) => {
    // Reset coords when user types a new address
    setCoords(null);
    setAddress(suggestion.description);
  };

  const toggleRating = () => {
    const v = minRating === 4 ? 0 : 4;
    setMinRating(v);
    if (coords) doSearch({ lat: coords.lat, lng: coords.lng, newMinRating: v });
    else if (address) doSearch({ locAddress: address, newMinRating: v });
  };
  const handleRadiusChange = (newKm: number) => {
    const clamped = Math.max(0.1, Math.min(50, newKm));
    const meters = Math.round(clamped * 1000);
    setRadius(meters);
    setDropdownOpen(false);
    setIsCustomMode(false);
    if (coords) doSearch({ lat: coords.lat, lng: coords.lng, newRadius: meters });
    else if (address) doSearch({ locAddress: address, newRadius: meters });
  };
  const toggleOpenNow = () => {
    const v = !openNow;
    setOpenNow(v);
    if (coords) doSearch({ lat: coords.lat, lng: coords.lng, newOpenNow: v });
    else if (address) doSearch({ locAddress: address, newOpenNow: v });
  };

  const selectShop = (placeId: string, name: string) => {
    router.push(`/?placeId=${placeId}&name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-700 mt-4">
      <header className="mb-12 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-[var(--color-qb-text)] mb-4 tracking-tight">Nearby Discovery</h1>
        <p className="text-lg text-[var(--color-qb-text-muted)] font-medium">
          Discover the best food spots around you based on real Google Maps reviews and high-quality signals.
        </p>
      </header>

      <div className="qb-panel p-6 mb-8 shadow-md border-gray-100 bg-white rounded-2xl transition-all hover:shadow-xl max-w-3xl mx-auto w-full">
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-3">
          <div className="flex-1 relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--color-qb-green)] z-10 pointer-events-none opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <PlacesAutocomplete
              value={address}
              onChange={val => { setAddress(val); setCoords(null); }}
              onSelect={handleLocationSelect}
              placeholder="Search your location here..."
              className="qb-input w-full !pl-12 !pr-32 !py-4 !text-base !rounded-xl !border-gray-200 focus:!border-[var(--color-qb-green)] transition-all"
              type="general"
              userLat={coords?.lat}
              userLng={coords?.lng}
            />
            <button
              type="button"
              onClick={handleLocateMe}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[10px] bg-gray-50 hover:bg-gray-100 text-gray-500 font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 transition-all active:scale-95 z-10 border border-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 text-blue-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Locate
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--color-qb-green)] hover:bg-[var(--color-qb-green-hover)] text-white font-bold py-4 px-8 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 group disabled:opacity-50 shrink-0"
          >
            {loading ? 'Finding...' : 'Discover'}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </form>
      </div>

      {/* Filters (Shown only when results exist) */}
      {isMounted && results.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center justify-center mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
          <button onClick={toggleRating} className={`whitespace-nowrap px-4 py-2 bg-white border rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${minRating === 4 ? 'border-[var(--color-qb-green)] text-[var(--color-qb-green)] bg-[var(--color-qb-green-light)] shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
            {minRating === 4 ? '✓ Rating 4.0+' : '⭐ Min 4.0'}
          </button>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`whitespace-nowrap px-4 py-2 bg-white border rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${radius !== 5000 ? 'border-[var(--color-qb-green)] text-[var(--color-qb-green)] bg-[var(--color-qb-green-light)] shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
            >
              📍 Dist {Math.round(radius / 100) / 10}km
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-200">
                {[2, 5, 10].map((km) => (
                  <button
                    key={km}
                    onClick={() => handleRadiusChange(km)}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-[var(--color-qb-green-light)] hover:text-[var(--color-qb-green)] rounded-xl transition-colors flex justify-between items-center"
                  >
                    <span>{km}km</span>
                    {Math.round(radius / 1000) === km && <span className="text-[var(--color-qb-green)] text-lg">·</span>}
                  </button>
                ))}
                <div className="border-t border-gray-50 my-1"></div>
                {!isCustomMode ? (
                  <button onClick={() => setIsCustomMode(true)} className="w-full text-left px-4 py-2.5 text-[9px] font-black uppercase tracking-tighter text-gray-400 hover:text-gray-600 rounded-xl transition-colors">
                    Custom...
                  </button>
                ) : (
                  <div className="p-2 flex gap-1">
                    <input
                      type="number"
                      autoFocus
                      placeholder="km"
                      className="w-full h-8 qb-input !px-2 !bg-gray-50 !border-none !text-xs font-bold"
                      value={customKm}
                      onChange={(e) => setCustomKm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRadiusChange(parseFloat(customKm))}
                    />
                    <button onClick={() => handleRadiusChange(parseFloat(customKm))} className="bg-[var(--color-qb-green)] text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase">
                      SET
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={toggleOpenNow} className={`whitespace-nowrap px-4 py-2 bg-white border rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${openNow ? 'border-[var(--color-qb-green)] text-[var(--color-qb-green)] bg-[var(--color-qb-green-light)] shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
            {openNow ? '✓ Open Now' : '🕐 Open only'}
          </button>
        </div>
      )}

      {dropdownOpen && (
        <div className="fixed inset-0 z-20" onClick={() => { setDropdownOpen(false); setIsCustomMode(false); }}></div>
      )}

      {isMounted && error && (
        <div className="qb-panel p-4 mb-6 border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {isMounted && loading && (
        <div className="qb-panel p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--color-qb-green)] rounded-full animate-spin mb-4"></div>
          <p className="text-[var(--color-qb-text-muted)] font-medium">Finding great spots…</p>
        </div>
      )}

      {isMounted && !loading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {results.map((place: any, i: number) => (
            <div
              key={i}
              onClick={() => selectShop(place.placeId, place.name)}
              className="qb-panel overflow-hidden group cursor-pointer hover:border-[var(--color-qb-green)] hover:shadow-md transition-all animate-in slide-in-from-bottom-2 duration-300"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="h-44 bg-gray-100 relative overflow-hidden">
                {place.photoUrl ? (
                  <img
                    src={place.photoUrl}
                    alt={place.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-gray-200">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60"></div>
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <span className={`backdrop-blur-md bg-white/90 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1.5 shadow-sm ${place.openNow ? 'text-green-700' : 'text-red-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${place.openNow ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
                    {place.openNow ? 'Open Now' : 'Closed'}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-[var(--color-qb-text)] group-hover:text-[var(--color-qb-green)] transition-colors leading-tight line-clamp-2 pr-2">
                    {place.name}
                  </h3>
                  <div className="shrink-0 flex flex-col items-end">
                    <span className="bg-green-700 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                      {place.rating} ★
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5">{place.userRatingsTotal?.toLocaleString()} reviews</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3 truncate">{place.vicinity}</p>
                <button className="w-full py-2 text-sm bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] font-semibold rounded-lg group-hover:bg-[var(--color-qb-green)] group-hover:text-white transition-colors">
                  Analyze Menu →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isMounted && !loading && results.length === 0 && !error && (
        <div className="qb-panel p-12 text-center flex flex-col items-center justify-center min-h-[300px] bg-gray-50/50">
          <div className="w-16 h-16 rounded-full bg-[var(--color-qb-green-light)] flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-[var(--color-qb-green)]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-qb-text)]">Find Restaurants Near You</h2>
          <p className="text-[var(--color-qb-text-muted)] mt-2 max-w-sm text-sm">
            Click "Locate Me" or type your location above and press Search.
          </p>
        </div>
      )}
    </div>
  );
}
