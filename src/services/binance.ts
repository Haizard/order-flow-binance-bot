
'use server';
import crypto from 'crypto'; // For HMAC SHA256 signature
import type { Ticker24hr, AccountInformation } from '@/types/binance';

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
 * Prioritizes provided keys, then falls back to environment variables BINANCE_API_KEY and BINANCE_SECRET_KEY.
 * Requires API key with "Enable Reading" permission on Testnet.
 * @param apiKeyInput Your Binance Testnet API key (optional).
 * @param secretKeyInput Your Binance Testnet API secret key (optional).
 * @returns AccountInformation object.
 */
export async function getAccountInformation(apiKeyInput?: string, secretKeyInput?: string): Promise<AccountInformation> {
  const apiKey = apiKeyInput || process.env.BINANCE_API_KEY;
  const secretKey = secretKeyInput || process.env.BINANCE_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error(
      'API Key or Secret Key is missing. Ensure BINANCE_API_KEY and BINANCE_SECRET_KEY are set in your .env.local file, or provide them in the form.'
    );
  }

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
      const binanceErrorMessage = errorData.msg || errorData.message || `HTTP error ${response.status}`;
      throw new Error(`Failed to fetch account information: ${binanceErrorMessage}`);
    }

    const data: AccountInformation = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching account information:', error);
    if (error instanceof Error) {
      if(error.message.startsWith("Failed to fetch account information:") || error.message.startsWith("API Key or Secret Key is missing")) {
        throw error;
      }
      throw new Error(`Network error or issue fetching account data: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching account data.');
  }
}
