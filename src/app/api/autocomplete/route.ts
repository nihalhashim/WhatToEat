import { NextResponse } from 'next/server';

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const PLACES_BASE = 'https://places.googleapis.com/v1';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { input, lat, lng, type = 'general' } = body;

    if (!input || input.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const requestBody: Record<string, unknown> = {
      input: input.trim(),
    };

    // Bias results towards user location if available
    if (lat && lng) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 50000,
        },
      };
    }

    // For restaurant search, restrict to restaurant-type places
    if (type === 'restaurant') {
      requestBody.includedPrimaryTypes = [
        'restaurant', 'cafe', 'bakery', 'bar', 'fast_food_restaurant'
      ];
    }

    const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    const suggestions = (data.suggestions || []).map((s: any) => {
      const place = s.placePrediction;
      return {
        description: place?.text?.text || '',
        placeId: place?.placeId || '',
        mainText: place?.structuredFormat?.mainText?.text || '',
        secondaryText: place?.structuredFormat?.secondaryText?.text || '',
      };
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error in /api/autocomplete:', error);
    return NextResponse.json({ error: 'Autocomplete failed' }, { status: 500 });
  }
}
