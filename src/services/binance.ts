'use server';
import type { Ticker24hr } from '@/types/binance';

const BINANCE_API_BASE_URL = 'https://api.binance.com/api/v3';

/**
 * Fetches 24-hour ticker price change statistics.
 * @param symbol Trading symbol (e.g., "BTCUSDT"). If undefined, fetches for all symbols.
 * @returns A single Ticker24hr object or an array of Ticker24hr objects.
 */
export async function get24hrTicker(symbol?: string): Promise<Ticker24hr | Ticker24hr[]> {
  let url = `${BINANCE_API_BASE_URL}/ticker/24hr`;
  if (symbol) {
    url += `?symbol=${symbol.toUpperCase()}`;
  }

  try {
    const response = await fetch(url, { next: { revalidate: 60 } }); // Revalidate every 60 seconds

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty object
      console.error('Binance API Error:', errorData);
      throw new Error(`Failed to fetch ticker data from Binance API: ${response.status} ${response.statusText}. ${errorData.msg || ''}`.trim());
    }

    const data: Ticker24hr | Ticker24hr[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching 24hr ticker:', error);
    // For client-side, you might want to throw a custom error or return a specific error structure
    // For server components, throwing an error will be caught by nearest error.js
    if (error instanceof Error) {
      throw new Error(`Network error or issue fetching data: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching ticker data.');
  }
}
