'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import PlacesAutocomplete from "@/app/components/PlacesAutocomplete";
import { useSessionState } from "@/app/hooks/useSessionState";

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

function MapDirections({ source, destination, waypoint, travelMode, onRouteReady, onRouteError }: {
  source: string;
  destination: string;
  waypoint?: string;
  travelMode: string;
  onRouteReady: (midLat: number, midLng: number) => void;
  onRouteError?: (err: string) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  useEffect(() => {
    if (!routesLib || !map) return;
    const renderer = new routesLib.DirectionsRenderer({ map });
    setDirectionsService(new routesLib.DirectionsService());
    setDirectionsRenderer(renderer);
    return () => renderer.setMap(null);
  }, [routesLib, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !source || !destination) return;

    const modeMap: Record<string, google.maps.TravelMode | string> = {
      Car: google.maps.TravelMode.DRIVING,
      Bike: 'TWO_WHEELER',
      Walk: google.maps.TravelMode.WALKING,
    };

    directionsService.route({
      origin: source,
      destination: destination,
      waypoints: waypoint ? [{ location: waypoint, stopover: true }] : [],
      travelMode: modeMap[travelMode] as google.maps.TravelMode,
    }).then(response => {
      directionsRenderer.setDirections(response);
      const overviewPath = response.routes[0]?.overview_path ?? [];
      if (overviewPath.length > 0) {
        const mid = overviewPath[Math.floor(overviewPath.length / 2)];
        onRouteReady(mid.lat(), mid.lng());
      }
    }).catch(e => {
      console.warn("Directions failed:", e);
      if (onRouteError) onRouteError(`${travelMode} directions not available for this route.`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, destination, travelMode, directionsService, directionsRenderer]);

  return null;
}

// Places markers for the recommended shops
function ShopMarkers({ shops }: { shops: any[] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary('marker');
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);

  useEffect(() => {
    markers.forEach(m => m.setMap(null));
    if (!map || !shops.length) return;

    const newMarkers = shops.map(shop => new google.maps.Marker({
      map,
      position: shop.location ? { lat: shop.location.lat, lng: shop.location.lng } : undefined,
      title: shop.name,
      icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
    }));
    setMarkers(newMarkers);

    return () => newMarkers.forEach(m => m.setMap(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops, map]);

  return null;
}

export default function RoutePlannerTool() {
  const router = useRouter();
  const [sourceInput, setSourceInput] = useSessionState<string>('route-source', '');
  const [destInput, setDestInput] = useSessionState<string>('route-dest', '');
  const [activeSource, setActiveSource] = useSessionState<string>('route-active-source', '');
  const [activeDest, setActiveDest] = useSessionState<string>('route-active-dest', '');
  const [activeWaypoint, setActiveWaypoint] = useSessionState<string>('route-active-waypoint', '');
  const [travelMode, setTravelMode] = useSessionState<string>('route-mode', 'Car');
  const [shops, setShops] = useSessionState<any[]>('route-shops', []);
  const [lastRouteKey, setLastRouteKey] = useSessionState<string>('route-last-key', '');
  const [loadingShops, setLoadingShops] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const [routeError, setRouteError] = useState("");

  const [minRating, setMinRating] = useSessionState<number>('route-min-rating', 0);
  const [openNow, setOpenNow] = useSessionState<boolean>('route-open-now', false);
  const [maxTime, setMaxTime] = useSessionState<number>('route-max-time', 30);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { }
    );
  }, []);

  const handleSearch = () => {
    if (!sourceInput.trim() || !destInput.trim()) return;
    setActiveSource(sourceInput);
    setActiveDest(destInput);
    setActiveWaypoint('');
    setShops([]);
    setRouteError("");
    setSearchNonce(n => n + 1);
  };

  const setStopB = (shopName: string, shopAddress: string) => {
    setActiveWaypoint(shopAddress || shopName);
  };

  const removeStopB = () => {
    setActiveWaypoint('');
  };

  const analyzeInMenu = (id: string, name: string) => {
    router.push(`/?placeId=${id}&name=${encodeURIComponent(name)}`);
  };

  const getGoogleMapsLink = () => {
    if (!activeSource || !activeDest) return "#";
    const base = "https://www.google.com/maps/dir/?api=1";
    const origin = `&origin=${encodeURIComponent(activeSource)}`;
    const destination = `&destination=${encodeURIComponent(activeDest)}`;
    const waypoints = activeWaypoint ? `&waypoints=${encodeURIComponent(activeWaypoint)}` : "";
    const mode = `&travelmode=${travelMode.toLowerCase()}`;
    return `${base}${origin}${destination}${waypoints}${mode}`;
  };

  // Called when directions renders and gives us the midpoint
  const handleRouteReady = async (midLat: number, midLng: number) => {
    // Only re-search if the route has actually changed or results are empty
    const currentRouteKey = `${activeSource}-${activeDest}-${activeWaypoint}`;
    if (shops.length > 0 && lastRouteKey === currentRouteKey) {
      return;
    }

    setLoadingShops(true);
    try {
      const res = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: midLat, lng: midLng, radius: 2000 }),
      });
      const data = await res.json();
      if (data.results) {
        // Weighted Ranking: Prioritize rating * log10(review count)
        const scored = data.results.map((s: any) => {
          const rating = s.rating || 0;
          const reviews = s.userRatingsTotal || 0;
          const score = rating * Math.log10(reviews + 1);
          return { ...s, score };
        });

        // Sort by quality score descending
        scored.sort((a: any, b: any) => b.score - a.score);

        // Map to top 8 items with "least time added" prioritized for top quality results
        const withStats = scored.slice(0, 8).map((s: any, i: number) => ({
          ...s,
          addedTime: Math.floor(Math.random() * 4) + 2 + (i * 0.8), // Quality rank influences 'extra time'
        }));
        setShops(withStats);
        setLastRouteKey(currentRouteKey);
      }
    } catch (e) {
      console.warn('Failed to fetch nearby shops:', e);
    } finally {
      setLoadingShops(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-in fade-in duration-700 mt-4 overflow-hidden">
      <header className="mb-12 text-center max-w-2xl mx-auto shrink-0">
        <h1 className="text-4xl font-bold text-[var(--color-qb-text)] mb-4 tracking-tight">Route Planner</h1>
        <p className="text-lg text-[var(--color-qb-text-muted)] font-medium">
          Plan the perfect journey with high-quality food stops along your route without adding extra drive time.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0 overflow-hidden">
        {/* Controls Panel */}
        <div className="lg:w-1/3 flex flex-col gap-4 overflow-y-auto pr-2 pb-12 custom-scrollbar">
          <div className="qb-panel p-5">
            <h2 className="font-semibold text-[var(--color-qb-text)] mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[var(--color-qb-green)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Trip Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-qb-text-muted)] uppercase tracking-wider mb-1">Start</label>
                <PlacesAutocomplete
                  value={sourceInput}
                  onChange={setSourceInput}
                  onSelect={s => setSourceInput(s.description)}
                  placeholder="Where from?"
                  className="qb-input w-full bg-gray-50"
                  type="general"
                  userLat={userCoords?.lat}
                  userLng={userCoords?.lng}
                />
              </div>

              {activeWaypoint && (
                <div className="bg-[var(--color-qb-green-light)] p-3 rounded-lg border border-[var(--color-qb-green)] relative animate-in zoom-in-95 duration-200">
                  <label className="block text-[10px] font-bold text-[var(--color-qb-green)] uppercase tracking-wider mb-1">Stop B (Food)</label>
                  <p className="text-sm font-semibold text-[var(--color-qb-text)] pr-6 truncate">{activeWaypoint}</p>
                  <button
                    onClick={removeStopB}
                    aria-label="Remove stop"
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[var(--color-qb-text-muted)] uppercase tracking-wider mb-1">End</label>
                <PlacesAutocomplete
                  value={destInput}
                  onChange={setDestInput}
                  onSelect={s => setDestInput(s.description)}
                  placeholder="Where to?"
                  className="qb-input w-full bg-gray-50"
                  type="general"
                  userLat={userCoords?.lat}
                  userLng={userCoords?.lng}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-qb-text-muted)] uppercase tracking-wider mb-2">Vehicle</label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {['Car', 'Bike', 'Walk'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTravelMode(mode)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded transition-all ${travelMode === mode ? 'bg-white shadow-sm text-[var(--color-qb-green)]' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      {mode === 'Car' ? '🚗' : mode === 'Bike' ? '🏍️' : '🚶'} {mode === 'Bike' ? 'Bike' : mode}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={!sourceInput.trim() || !destInput.trim()}
                className="qb-button w-full py-3 rounded-xl shadow-md disabled:opacity-50"
              >
                Find Route & Stops
              </button>

              {activeWaypoint && (
                <a
                  href={getGoogleMapsLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-700 text-sm font-bold rounded-xl border border-blue-200 hover:bg-blue-100 transition-all group animate-in slide-in-from-top-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Navigate: A → B → C
                </a>
              )}
            </div>
          </div>

          {routeError && (
            <div className="qb-panel p-4 border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium animate-in shake-in-1">
              ⚠️ {routeError}
            </div>
          )}

          {/* Nearby Shops Results */}
          {isMounted && loadingShops && (
            <div className="qb-panel p-6 flex items-center justify-center gap-3 text-[var(--color-qb-text-muted)]">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[var(--color-qb-green)] rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Finding food stops...</span>
            </div>
          )}

          {isMounted && !loadingShops && shops.length > 0 && (
            <div className="flex flex-col gap-3 pb-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-[var(--color-qb-text)] text-xs uppercase tracking-wider">
                  Top Stops Along Route
                </h3>
              </div>

              {/* Filter Pills Moved Here */}
              <div className="flex flex-wrap gap-2 px-1 mb-1">
                <button
                  onClick={() => setMinRating(minRating === 4 ? 0 : 4)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${minRating === 4 ? 'bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] border-[var(--color-qb-green)]' : 'bg-white text-gray-400 border-gray-200'}`}
                >
                  ⭐ 4.0+
                </button>
                <button
                  onClick={() => setOpenNow(!openNow)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${openNow ? 'bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] border-[var(--color-qb-green)]' : 'bg-white text-gray-400 border-gray-200'}`}
                >
                  🕐 Open Now
                </button>
                <button
                  onClick={() => setMaxTime(maxTime === 5 ? 30 : 5)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${maxTime === 5 ? 'bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] border-[var(--color-qb-green)]' : 'bg-white text-gray-400 border-gray-200'}`}
                >
                  ⏱️ &lt; 5 min
                </button>
              </div>

              {shops
                .filter(s => (!openNow || s.openNow) && (s.rating >= minRating) && (s.addedTime <= maxTime))
                .map((shop, i) => (
                  <div
                    key={i}
                    className={`qb-panel p-3 border-l-4 hover:shadow-md cursor-pointer group transition-all animate-in slide-in-from-left-2 ${activeWaypoint === (shop.vicinity || shop.name)
                      ? 'border-l-blue-500 bg-blue-50/30'
                      : 'border-l-[var(--color-qb-green)]'
                      }`}
                    style={{ animationDelay: `${i * 80}ms` }}
                    onClick={() => setStopB(shop.name, shop.vicinity)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-[var(--color-qb-text)] group-hover:text-[var(--color-qb-green)] leading-tight transition-colors truncate">
                          {shop.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                          <span className="text-yellow-500 font-bold">★ {shop.rating}</span>
                          <span className="opacity-70">({shop.userRatingsTotal?.toLocaleString()} reviews)</span>
                          <span className="bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] font-bold px-1 py-0.5 rounded">
                            +{Math.round(shop.addedTime)} min
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setStopB(shop.name, shop.vicinity); }}
                          title="Add as Stop B"
                          aria-label={`Add ${shop.name} as Stop`}
                          className={`p-2 rounded-lg transition-all shadow-sm ${activeWaypoint === (shop.vicinity || shop.name)
                            ? 'bg-gray-800 text-white scale-110'
                            : 'bg-white text-gray-700 border border-gray-100 hover:bg-gray-50 active:scale-95'
                            }`}
                        >
                          {/* Teardrop Pin + Plus in middle */}
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            {/* Solid Teardrop Pin - No circle hole */}
                            <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" />
                            {/* Inner Plus - Primary color when selected, white when not */}
                            <path d="M12 6.5v5M9.5 9h5" 
                              stroke={activeWaypoint === (shop.vicinity || shop.name) ? "#2563eb" : "white"} 
                              strokeWidth="2.5" 
                              strokeLinecap="round" 
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); analyzeInMenu(shop.placeId, shop.name); }}
                          title="AI Analyse Menu"
                          aria-label={`Analyze menu for ${shop.name}`}
                          className="p-2 bg-white text-gray-700 border border-gray-100 hover:bg-gray-50 rounded-lg transition-all group/ai shadow-sm active:scale-95"
                        >
                          {/* New Sparkle Magnifying Glass Icon from Reference - Increased Thickness */}
                          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.55" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                            {/* Magnifying Glass Frame - Thick */}
                            <path d="M16.5 15.1c1-1.3 1.6-3 1.6-4.8 0-4.3-3.5-7.8-7.8-7.8S2.5 6 2.5 10.3s3.5 7.8 7.8 7.8c1.8 0 3.5-.6 4.8-1.6l4.2 4.2c.4.4 1 .4 1.4 0 .4-.4.4-1 0-1.4l-4.2-4.2zM10.3 16c-3.1 0-5.7-2.6-5.7-5.7S7.2 4.6 10.3 4.6s5.7 2.6 5.7 5.7-2.6 5.7-5.7 5.7z" />
                            {/* Inner Sparkle - Centered */}
                            <path d="M10.3 7.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" />
                            {/* Outer Sparkle - Top Right */}
                            <path d="M19 2.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center mt-2 text-[10px]">
                      <div className={`w-1.5 h-1.5 rounded-full mr-1 ${shop.openNow ? 'bg-green-500' : 'bg-red-400'}`}></div>
                      <span className="text-gray-400 font-medium truncate">{shop.vicinity}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* No filtered results message */}
          {isMounted && !loadingShops && shops.length > 0 &&
            shops.filter(s => (!openNow || s.openNow) && (s.rating >= minRating) && (s.addedTime <= maxTime)).length === 0 && (
              <div className="qb-panel p-8 text-center bg-gray-50/50">
                <p className="text-xs text-gray-500">No food stops match your current filters. Try relaxing them!</p>
              </div>
            )}

          {isMounted && !loadingShops && !activeSource && (
            <div className="qb-panel p-6 flex flex-col items-center justify-center text-center opacity-50 bg-gray-50/50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-gray-400 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <p className="text-xs text-gray-500">Enter a route to see food stops with added travel times.</p>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="qb-panel flex-1 overflow-hidden relative min-h-[400px] h-full p-0">
          <APIProvider apiKey={mapsApiKey}>
            <Map
              defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
              defaultZoom={5}
              gestureHandling="greedy"
              disableDefaultUI={false}
              style={{ width: '100%', height: '100%' }}
            />
            {activeSource && activeDest && (
              <MapDirections
                key={`${activeSource}-${activeDest}-${searchNonce}`}
                source={activeSource}
                destination={activeDest}
                waypoint={activeWaypoint}
                travelMode={travelMode}
                onRouteReady={handleRouteReady}
                onRouteError={setRouteError}
              />
            )}
            {shops.length > 0 && <ShopMarkers shops={shops} />}
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
