import { NextResponse } from 'next/server';

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const PLACES_BASE = 'https://places.googleapis.com/v1';

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`
  );
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  return data.results[0].geometry.location;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { lat, lng, address, radius = 5000, minRating = 0, openNow = false } = body;

    // 1. Geocode address if lat/lng not provided
    if (address && (!lat || !lng)) {
      const coords = await geocodeAddress(address);
      if (!coords) {
        return NextResponse.json({ error: 'Could not locate that address.' }, { status: 400 });
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Location is required.' }, { status: 400 });
    }

    // 2. Nearby Search - Places API (New)
    const searchBody: Record<string, unknown> = {
      includedTypes: ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: Math.min(radius, 50000),
        },
      },
    };

    const placesRes = await fetch(`${PLACES_BASE}/places:searchNearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsApiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.regularOpeningHours,places.location,places.types,places.photos',
      },
      body: JSON.stringify(searchBody),
    });

    const placesData = await placesRes.json();

    if (placesData.error) {
      return NextResponse.json({ error: placesData.error.message }, { status: 400 });
    }

    const places = placesData.places || [];

    // 3. Format results
    let results = places.map((place: any) => {
      const isOpen = place.regularOpeningHours?.openNow ?? null;
      const photoName = place.photos?.[0]?.name;
      const photoUrl = photoName 
        ? `${PLACES_BASE}/${photoName}/media?maxWidthPx=600&key=${mapsApiKey}`
        : null;

      return {
        placeId: place.id,
        name: place.displayName?.text || 'Unknown',
        rating: place.rating || 0,
        userRatingsTotal: place.userRatingCount || 0,
        vicinity: place.formattedAddress || '',
        openNow: isOpen,
        photoUrl,
        location: place.location
          ? { lat: place.location.latitude, lng: place.location.longitude }
          : null,
        types: place.types || [],
      };
    });

    // 4. Filter
    if (minRating > 0) {
      results = results.filter((r: any) => r.rating >= minRating);
    }
    if (openNow) {
      results = results.filter((r: any) => r.openNow === true);
    }

    // Sort by rating desc
    results.sort((a: any, b: any) => b.rating - a.rating);

    return NextResponse.json({ location: { lat, lng }, results });
  } catch (error: any) {
    console.error('Error in /api/nearby:', error);
    return NextResponse.json({ error: 'Failed to fetch nearby places' }, { status: 500 });
  }
}
