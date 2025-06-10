
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
  const fetchTimestamp = new Date().toISOString();
  console.log(`[${fetchTimestamp}] Fetching 24hr ticker for ${symbol || 'all'}`);

  try {
    // Use cache: 'no-store' to ensure data is always fetched directly from Binance
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      let parsedErrorData: any = {};
      let rawErrorBody: string | null = null;
      try {
        rawErrorBody = await response.text();
        parsedErrorData = JSON.parse(rawErrorBody);
      } catch (e) {
        // JSON parsing failed
      }
      
      const logDetails = (parsedErrorData && Object.keys(parsedErrorData).length > 0 && parsedErrorData.constructor === Object && parsedErrorData.msg) 
        ? parsedErrorData 
        : { rawBody: rawErrorBody || "Could not read error response body." };

      console.error(`[${new Date().toISOString()}] Binance API Error (get24hrTicker):`, { 
        status: response.status, 
        statusText: response.statusText, 
        details: logDetails,
        symbol: symbol || 'all'
      });

      const binanceSpecificMessage = parsedErrorData.msg || '';
      const fallbackMessage = rawErrorBody ? `Response snippet: ${rawErrorBody.substring(0,150)}` : 'No additional error details from response body.';
      
      throw new Error(`Failed to fetch ticker data from Binance API: ${response.status} ${response.statusText}. ${binanceSpecificMessage || fallbackMessage}`.trim());
    }
    
    const successTimestamp = new Date().toISOString();
    console.log(`[${successTimestamp}] Successfully fetched 24hr ticker data for ${symbol || 'all'}`);
    const data: Ticker24hr | Ticker24hr[] = await response.json();
    return data;
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] Error in get24hrTicker (symbol: ${symbol || 'all'}):`, error instanceof Error ? error.message : String(error));
    
    // Re-throw specific Binance API errors or a general one
    if (error instanceof Error) {
      if (error.message.startsWith('Failed to fetch ticker data from Binance API:')) {
        throw error; 
      }
      // For other types of errors (e.g., network issues not caught by fetch's !response.ok), wrap them.
      throw new Error(`Operation failed for get24hrTicker (symbol: ${symbol || 'all'}): ${error.message}`);
    }
    // Fallback for non-Error objects if they somehow reach here.
    throw new Error(`An unknown error occurred in get24hrTicker (symbol: ${symbol || 'all'}).`);
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
      cache: 'no-store', // Ensures data is always fetched directly
    });

    if (!response.ok) {
      let parsedErrorData: any = {};
      let rawErrorBody: string | null = null;
      try {
        rawErrorBody = await response.text();
        parsedErrorData = JSON.parse(rawErrorBody);
      } catch (e) {
        // JSON parsing failed
      }

      const logDetails = (parsedErrorData && Object.keys(parsedErrorData).length > 0 && parsedErrorData.constructor === Object && parsedErrorData.msg)
        ? parsedErrorData
        : { rawBody: rawErrorBody || "Could not read error response body." };
      
      console.error(`[${new Date().toISOString()}] Binance API Error (getAccountInformation):`, {
        status: response.status,
        statusText: response.statusText,
        details: logDetails
      });
      
      const binanceSpecificMessage = parsedErrorData.msg || '';
      const fallbackMessage = rawErrorBody ? `Response snippet: ${rawErrorBody.substring(0,150)}` : 'No additional error details from response body.';

      throw new Error(`Failed to fetch account information: ${response.status} ${response.statusText}. ${binanceSpecificMessage || fallbackMessage}`.trim());
    }

    const data: AccountInformation = await response.json();
    return data;
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] Error in getAccountInformation:`, error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
       if(error.message.startsWith("Failed to fetch account information:") || error.message.startsWith("API Key or Secret Key is missing")) {
        throw error;
      }
      throw new Error(`Operation failed for getAccountInformation: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching account data.');
  }
}

