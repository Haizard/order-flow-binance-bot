'use server';
import crypto from 'crypto'; // For HMAC SHA256 signature
import type { Ticker24hr, AccountInformation } from '@/types/binance';

// Updated to use Binance Spot Testnet API
const BINANCE_API_BASE_URL = 'https://testnet.binance.vision/api/v3';

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
      console.error('Binance API Error (get24hrTicker):', errorData);
      throw new Error(`Failed to fetch ticker data from Binance API: ${response.status} ${response.statusText}. ${errorData.msg || ''}`.trim());
    }

    const data: Ticker24hr | Ticker24hr[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching 24hr ticker:', error);
    if (error instanceof Error) {
      throw new Error(`Network error or issue fetching data: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching ticker data.');
  }
}

/**
 * Fetches account information using API key and secret.
 * Requires API key with "Enable Reading" permission on Testnet.
 * @param apiKey Your Binance Testnet API key.
 * @param secretKey Your Binance Testnet API secret key.
 * @returns AccountInformation object.
 */
export async function getAccountInformation(apiKey: string, secretKey: string): Promise<AccountInformation> {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex');

  const url = `${BINANCE_API_BASE_URL}/account?${queryString}&signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
      cache: 'no-store', // Ensure fresh data for account info
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response from Binance API' }));
      console.error('Binance API Error (getAccountInformation):', errorData);
      // Try to provide a more specific error message from Binance if available
      const binanceErrorMessage = errorData.msg || errorData.message || `HTTP error ${response.status}`;
      throw new Error(`Failed to fetch account information: ${binanceErrorMessage}`);
    }

    const data: AccountInformation = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching account information:', error);
    if (error instanceof Error) {
      // If the error message already indicates it's a specific account fetch error, don't re-wrap it.
      if(error.message.startsWith("Failed to fetch account information:")) {
        throw error;
      }
      throw new Error(`Network error or issue fetching account data: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching account data.');
  }
}
