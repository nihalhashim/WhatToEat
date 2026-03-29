'use client';

import { useState, Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import PlacesAutocomplete from "@/app/components/PlacesAutocomplete";
import { useSessionState } from "@/app/hooks/useSessionState";

function MenuToolContent() {
  const searchParams = useSearchParams();
  const incomingPlaceId = searchParams.get("placeId");
  const incomingName = searchParams.get("name");

  // Persisted state
  const [url, setUrl] = useSessionState<string>('menu-url', '');
  const [results, setResults] = useSessionState<any>('menu-results', null);
  const [activePlaceId, setActivePlaceId] = useSessionState<string>('menu-placeId', '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCountdown, setRetryCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  // User's location for biasing restaurant autocomplete
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { }
    );
  }, []);

  // When navigated here from "What to Eat", pre-populate the input with a Google Maps link
  useEffect(() => {
    if (incomingPlaceId && incomingName) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(incomingName)}&query_place_id=${incomingPlaceId}`;
      setUrl(mapsUrl);
      setActivePlaceId(incomingPlaceId);
      // Clear old results when a new restaurant is selected
      setResults(null);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingPlaceId, incomingName]);

  const handleInputChange = (val: string) => {
    setUrl(val);
    setActivePlaceId(''); // Clear saved placeId if user types manually
  };

  const handleRestaurantSelect = (suggestion: any) => {
    setActivePlaceId(suggestion.placeId);
    // Construct a clean Google Maps URL from the selected place
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suggestion.description)}&query_place_id=${suggestion.placeId}`;
    setUrl(mapsUrl);
    setResults(null);
    setError('');
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url && !activePlaceId) return;
    if (retryCountdown > 0) return;

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const res = await fetch("/api/suggest-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          placeId: activePlaceId || undefined,
          lat: userCoords?.lat,
          lng: userCoords?.lng
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate menu");
      setResults(data);
    } catch (err: any) {
      const msg: string = err.message || '';
      if (msg.startsWith('RATE_LIMIT:')) {
        const secs = parseInt(msg.split(':')[1], 10) || 60;
        setRetryCountdown(secs);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setRetryCountdown(prev => {
            if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
            return prev - 1;
          });
        }, 1000);
        setError('RATE_LIMIT');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => () => clearInterval(countdownRef.current), []);

  return (
    <div className="flex flex-col animate-in fade-in duration-700 mt-4">
      <header className="mb-12 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-[var(--color-qb-text)] mb-4 tracking-tight">Menu Suggestion</h1>
        <p className="text-lg text-[var(--color-qb-text-muted)] font-medium">
          Paste a Google Maps link or type a restaurant name to get instant, AI-ranked dish recommendations.
        </p>
      </header>

      {isMounted && (
        <>
          <div className="qb-panel p-6 mb-12 shadow-md border-gray-100 bg-white rounded-2xl transition-all hover:shadow-xl max-w-3xl mx-auto w-full">
            <form onSubmit={handleGenerate} className="flex gap-3">
              <div className="flex-1 relative group">
                <PlacesAutocomplete
                  value={url}
                  onChange={handleInputChange}
                  onSelect={handleRestaurantSelect}
                  placeholder="Paste Google Maps link or restaurant name…"
                  className="qb-input w-full !py-4 !px-6 !text-base !rounded-xl !border-gray-200 focus:!border-[var(--color-qb-green)] focus:!ring-4 focus:!ring-[var(--color-qb-green-light)] transition-all placeholder:text-gray-300"
                  type="restaurant"
                  userLat={userCoords?.lat}
                  userLng={userCoords?.lng}
                  disabled={loading}
                />
                {activePlaceId && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1 bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] rounded-full text-[10px] font-black uppercase tracking-wider animate-in zoom-in-50 border border-[var(--color-qb-green)]/10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Identified
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || (!url && !activePlaceId) || retryCountdown > 0}
                className={`bg-[var(--color-qb-green)] hover:bg-[var(--color-qb-green-hover)] text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center gap-2 group shadow-sm shrink-0 ${(loading || retryCountdown > 0) ? 'opacity-50 cursor-not-allowed grayscale' : 'active:scale-95'
                  }`}
              >
                {retryCountdown > 0 ? `${retryCountdown}s` : loading ? "Analyzing…" : "Generate"}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </form>
          </div>

          {loading && (
            <div className="qb-panel p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--color-qb-green)] rounded-full animate-spin mb-4"></div>
              <h2 className="text-xl font-bold text-[var(--color-qb-text)]">Reading Reviews…</h2>
              <p className="text-[var(--color-qb-text-muted)] mt-2">Extracting the best dishes using AI.</p>
            </div>
          )}
        </>
      )}

      {error === 'RATE_LIMIT' && (
        <div className="qb-panel p-5 mb-6 border-amber-200 bg-amber-50 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="font-bold text-amber-800">Gemini API Quota Reached</p>
            <p className="text-sm text-amber-700 mt-1">
              Your free-tier daily quota for the Gemini API is exhausted.
              {retryCountdown > 0 && (
                <> The API will be available again in <strong className="font-bold">{retryCountdown}s</strong>.</>
              )}
            </p>
            <div className="flex gap-3 mt-3">
              {retryCountdown === 0 && (
                <button
                  onClick={() => { setError(''); setResults(null); }}
                  className="text-sm bg-amber-600 text-white px-4 py-1.5 rounded-lg hover:bg-amber-700 transition-colors font-medium"
                >
                  Try Again
                </button>
              )}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm bg-white border border-amber-300 text-amber-700 px-4 py-1.5 rounded-lg hover:bg-amber-50 transition-colors font-medium"
              >
                Enable Billing →
              </a>
            </div>
          </div>
        </div>
      )}

      {isMounted && error && error !== 'RATE_LIMIT' && (
        <div className="qb-panel p-5 mb-6 border-red-200 bg-red-50 text-red-700 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mt-0.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="font-semibold">Couldn't analyze this restaurant</p>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {isMounted && !loading && !error && !results && (
        <div className="qb-panel p-12 text-center flex flex-col items-center justify-center min-h-[400px] bg-gray-50/50">
          <div className="w-16 h-16 rounded-full bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--color-qb-text)]">No Restaurant Selected</h2>
          <p className="text-[var(--color-qb-text-muted)] mt-2 max-w-md">
            Enter a link above or use the "What to Eat" tool to discover a place nearby, then come back here to analyze the menu.
          </p>
        </div>
      )}

      {isMounted && results && (
        <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="qb-panel p-6 !bg-[var(--color-qb-green)] text-white relative overflow-hidden border-none shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-32 h-32">
                <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold relative z-10">{results.restaurantName}</h2>
            <p className="opacity-90 mt-1 font-medium relative z-10">
              {results.items?.length} dishes ranked by AI · Based on Google Maps reviews
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {results.items?.map((item: any, idx: number) => (
              <div key={idx} className="qb-panel p-5 border-l-4 border-l-[var(--color-qb-green)] hover:shadow-md transition-shadow flex flex-col md:flex-row gap-4 items-start">
                <div className="bg-[var(--color-qb-green-light)] text-[var(--color-qb-green)] font-bold w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-[var(--color-qb-text)] mb-1 leading-tight">{item.dishName}</h3>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed font-medium">{item.description}</p>

                  <div className="space-y-3">
                    {item.realQuote && (
                      <div className="bg-[var(--color-qb-bg)] p-3 rounded-xl border-l-4 border-l-amber-400 relative overflow-hidden group/quote">
                        <div className="absolute top-1 right-2 text-amber-200 opacity-40 pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-12 h-12">
                            <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21M14.017 21H21.017M14.017 21V12C14.017 8.68629 16.7033 6 20.017 6H21.017M7.01701 21L7.01701 18C7.01701 16.8954 7.91245 16 9.01701 16H12.017C13.1216 16 14.017 16.8954 14.017 18V21M7.01701 21H14.017M7.01701 21V12C7.01701 8.68629 9.70331 6 13.017 6H14.017" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <p className="text-xs italic text-[var(--color-qb-text)] font-semibold leading-relaxed relative z-10">
                          "{item.realQuote}"
                        </p>
                        <div className="flex justify-end mt-2 relative z-10">
                          <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest bg-gray-100 px-2 py-0.5 rounded">
                            — Review by {item.authorName || 'Google Maps Contributor'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:w-28 shrink-0 flex flex-row md:flex-col items-center md:items-end gap-2 w-full mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--color-qb-border)]">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Score</div>
                  <div className="flex-1 md:w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--color-qb-green)] rounded-full transition-all" style={{ width: `${item.sentimentScore}%` }}></div>
                  </div>
                  <span className="text-lg font-bold text-[var(--color-qb-green)]">{item.sentimentScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuTool() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-[var(--color-qb-text-muted)] font-medium">
        Loading…
      </div>
    }>
      <MenuToolContent />
    </Suspense>
  );
}
