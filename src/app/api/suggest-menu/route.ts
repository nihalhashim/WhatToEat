import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const PLACES_BASE = 'https://places.googleapis.com/v1';

/** Follow HTTP redirects for short URLs (maps.app.goo.gl, share.google, etc.) */
async function expandShortUrl(rawUrl: string): Promise<string> {
  try {
    // Some short URLs require a User-Agent to redirect properly
    const res = await fetch(rawUrl, { 
      method: 'GET', 
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
      }
    });
    return res.url && res.url !== rawUrl ? res.url : rawUrl;
  } catch {
    return rawUrl;
  }
}

async function resolveToPlaceId(input: string, lat?: number, lng?: number): Promise<{ placeId: string; name: string } | null> {
  let searchQuery = input;
  try {
    const urlObj = new URL(input);
    const expanded = await expandShortUrl(input);
    const expandedUrlObj = new URL(expanded);

    const match = expandedUrlObj.pathname.match(/\/place\/([^/]+)/);
    if (match) {
      searchQuery = decodeURIComponent(match[1].replace(/\+/g, ' '));
    } else {
      const q = expandedUrlObj.searchParams.get('q') || expandedUrlObj.searchParams.get('query');
      if (q) {
        searchQuery = q;
      } else if (expanded.includes('google.com/maps')) {
        searchQuery = expanded;
      }
    }
  } catch {
    searchQuery = input;
  }

  const requestBody: Record<string, any> = { textQuery: searchQuery };
  if (lat && lng) {
    requestBody.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 10000, 
      }
    };
  }

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': mapsApiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;
  return { placeId: place.id, name: place.displayName?.text || 'Unknown' };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, placeId: rawPlaceId, lat, lng } = body;

    let finalPlaceId = rawPlaceId;
    let restaurantName = '';

    // 1. Resolve Place ID
    if (!finalPlaceId) {
      if (!url) return NextResponse.json({ error: 'No URL or Place ID provided.' }, { status: 400 });
      const resolved = await resolveToPlaceId(url, lat, lng);
      if (!resolved) return NextResponse.json({ error: 'Could not find a restaurant matching this input.' }, { status: 404 });
      finalPlaceId = resolved.placeId;
      restaurantName = resolved.name;
    }

    // 2. Fetch Place Details + Reviews (Places API New)
    const detailRes = await fetch(`${PLACES_BASE}/places/${finalPlaceId}`, {
      headers: {
        'X-Goog-Api-Key': mapsApiKey,
        'X-Goog-FieldMask': 'displayName,rating,reviews',
      },
    });

    const detailData = await detailRes.json();

    if (detailData.error) {
      return NextResponse.json({ error: detailData.error.message }, { status: 400 });
    }

    restaurantName = detailData.displayName?.text || restaurantName;
    const reviews: any[] = detailData.reviews || [];

    if (reviews.length === 0) {
      return NextResponse.json({
        error: "This place doesn't have enough reviews to generate a menu.",
      }, { status: 404 });
    }

    // 3. Build review text for Gemini with indices for tracking
    const reviewsText = reviews
      .map((r: any, i: number) => {
        const text = r.text?.text || '';
        if (!text) return null;
        return `[Review ${i}]: ${text}`;
      })
      .filter(Boolean)
      .join('\n\n');

    // 4. Ask Gemini to analyze and rank dishes
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  dishName: { type: SchemaType.STRING },
                  description: { 
                    type: SchemaType.STRING,
                    description: 'A concise, punchy subtitle explaining what the dish is and unique reasons why it is praised at this specific shop (based on reviews).',
                  },
                  realQuote: {
                    type: SchemaType.STRING,
                    description: 'A verbatim, real quote or snippet from one of the provided reviews that specifically mentions this dish. REQUIRED.',
                  },
                  sentimentScore: {
                    type: SchemaType.NUMBER,
                    description: '1-100 score reflecting popularity and sentiment.',
                  },
                  reviewIndex: {
                    type: SchemaType.NUMBER,
                    description: 'The numeric index [Review X] from the input text that this quote was taken from.',
                  },
                },
                required: ['dishName', 'description', 'realQuote', 'sentimentScore', 'reviewIndex'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const prompt = `You are an expert food critic AI. Analyze the following Google Maps reviews for the restaurant "${restaurantName}".
Extract the specific food items or dishes that are most highly praised.
Rank them by popularity and sentiment. Return at most 8 items.

CRITICAL RULES:
1. ONLY use information provided in the "Reviews" section below.
2. For "realQuote", you MUST extract an EXACT, VERBATIM snippet from the provided reviews.
3. For "reviewIndex", you MUST provide the index (e.g. 0 for [Review 0]) that the quote was taken from.
4. If no specific dishes are praised, return an empty items array.

Reviews:
${reviewsText}`;

    const aiResult = await model.generateContent(prompt);
    const parsedData = JSON.parse(aiResult.response.text());

    // 5. Match indices back to real author names
    const finalItems = (parsedData.items || []).map((item: any) => {
      const originalReview = reviews[item.reviewIndex];
      // authorAttribution.displayName is the correct field in Places API New
      const authorName = originalReview?.authorAttribution?.displayName || 'Anonymous';
      return {
        ...item,
        authorName,
      };
    });

    return NextResponse.json({ restaurantName, items: finalItems });
  } catch (error: any) {
    console.error('Error in /api/suggest-menu:', error);
    // Parse retryDelay from Gemini rate limit errors for a friendly message
    let message = error.message || 'Failed to generate menu';
    const retryMatch = message.match(/retry in ([\d.]+)s/);
    if (message.includes('429') || message.includes('quota') || message.includes('rate') || retryMatch) {
      const seconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
      message = `RATE_LIMIT:${seconds}`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
