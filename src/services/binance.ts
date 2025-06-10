
'use server';
import crypto from 'crypto'; // For HMAC SHA256 signature
import type { Ticker24hr, AccountInformation } from '@/types/binance';

const BINANCE_API_BASE_URL = 'https://testnet.binance.vision/api/v3';

/**
 * Fetches 24-hour ticker price change statistics.
 * @param symbol Trading symbol (e.g., "BTCUSDT"). If undefined, fetches for all symbols.
 * @returns A single Ticker24hr object or an array of Ticker24hr objects.
 * @throws Error if the API request fails.
 */
export async function get24hrTicker(symbol?: string): Promise<Ticker24hr | Ticker24hr[]> {
  let url = `${BINANCE_API_BASE_URL}/ticker/24hr`;
  if (symbol) {
    url += `?symbol=${symbol.toUpperCase()}`;
  }
  // const fetchTimestamp = new Date().toISOString();
  // console.log(`[${fetchTimestamp}] Fetching 24hr ticker for ${symbol || 'all'}`);

  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      let parsedErrorData: any = {};
      let rawErrorBody: string | null = null;
      try {
        rawErrorBody = await response.text();
        if (rawErrorBody) {
            parsedErrorData = JSON.parse(rawErrorBody);
        }
      } catch (e) {
        // Failed to parse error body, rawErrorBody will be used if available
      }

      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        binanceCode: parsedErrorData?.code,
        binanceMsg: parsedErrorData?.msg,
        rawBodySnippet: rawErrorBody ? rawErrorBody.substring(0, 200) + (rawErrorBody.length > 200 ? '...' : '') : "Empty response body",
        requestSymbol: symbol || 'all'
      };
      
      let thrownErrorMessage = `Failed to fetch ticker data for ${errorDetails.requestSymbol} from Binance API: ${response.status} ${response.statusText}.`;
      if (parsedErrorData?.msg) {
        thrownErrorMessage += ` Binance Message: ${parsedErrorData.msg}`;
        if (parsedErrorData?.code) {
            thrownErrorMessage += ` (Code: ${parsedErrorData.code})`;
        }
      } else if (rawErrorBody) {
        thrownErrorMessage += ` Raw Response Snippet: ${rawErrorBody.substring(0, 150)}${rawErrorBody.length > 150 ? '...' : ''}`;
      } else {
        thrownErrorMessage += ' No additional error details from response body.';
      }
      // Removed direct console.error from here. Caller will log.
      throw new Error(thrownErrorMessage.trim());
    }
    
    // const successTimestamp = new Date().toISOString();
    // console.log(`[${successTimestamp}] Successfully fetched 24hr ticker data for ${symbol || 'all'}`);
    const data: Ticker24hr | Ticker24hr[] = await response.json();
    return data;
  } catch (error) {
    // const errorTimestamp = new Date().toISOString();
    if (error instanceof Error) {
      // Re-throw specific Binance API errors or a general one
      // console.error(`[${errorTimestamp}] Error in get24hrTicker (symbol: ${symbol || 'all'}): ${error.message}`);
      throw error; // Re-throw the error to be caught by the caller
    }
    // Fallback for non-Error objects if they somehow reach here.
    // console.error(`[${errorTimestamp}] An unknown error occurred in get24hrTicker (symbol: ${symbol || 'all'}).`);
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
 * @throws Error if API keys are missing or the API request fails.
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
      cache: 'no-store', 
    });

    if (!response.ok) {
      let parsedErrorData: any = {};
      let rawErrorBody: string | null = null;
      try {
        rawErrorBody = await response.text();
        if (rawErrorBody) {
            parsedErrorData = JSON.parse(rawErrorBody);
        }
      } catch (e) {
        // Failed to parse error body
      }
      
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        binanceCode: parsedErrorData?.code,
        binanceMsg: parsedErrorData?.msg,
        rawBodySnippet: rawErrorBody ? rawErrorBody.substring(0, 200) + (rawErrorBody.length > 200 ? '...' : '') : "Empty response body",
      };
            
      let thrownErrorMessage = `Failed to fetch account information from Binance API: ${response.status} ${response.statusText}.`;
      if (parsedErrorData?.msg) {
        thrownErrorMessage += ` Binance Message: ${parsedErrorData.msg}`;
        if (parsedErrorData?.code) {
            thrownErrorMessage += ` (Code: ${parsedErrorData.code})`;
        }
      } else if (rawErrorBody) {
        thrownErrorMessage += ` Raw Response Snippet: ${rawErrorBody.substring(0, 150)}${rawErrorBody.length > 150 ? '...' : ''}`;
      } else {
        thrownErrorMessage += ' No additional error details from response body.';
      }
      // Removed direct console.error from here. Caller will log.
      throw new Error(thrownErrorMessage.trim());
    }

    const data: AccountInformation = await response.json();
    return data;
  } catch (error) {
    // const errorTimestamp = new Date().toISOString();
    if (error instanceof Error) {
        // console.error(`[${errorTimestamp}] Error in getAccountInformation: ${error.message}`);
        throw error;
    }
    // console.error(`[${errorTimestamp}] Unexpected error in getAccountInformation:`, String(error));
    throw new Error(`Operation failed in getAccountInformation: ${String(error)}`);
  }
}
