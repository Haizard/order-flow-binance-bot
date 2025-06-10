
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

  try {
    const response = await fetch(url, { cache: 'no-store' }); // Ensure no caching for this fetch

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

      const errorDetailsForLogging = {
        status: response.status,
        statusText: response.statusText,
        binanceCode: parsedErrorData?.code,
        binanceMsg: parsedErrorData?.msg,
        rawBodySnippet: rawErrorBody ? (rawErrorBody.substring(0, 150) + (rawErrorBody.length > 150 ? '...' : '')) : "No raw body.",
        requestSymbol: symbol || 'all',
      };
      
      // Construct a more detailed error message to be thrown
      let thrownErrorMessage = `Failed to fetch ticker data for ${errorDetailsForLogging.requestSymbol} from Binance API: ${response.status} ${response.statusText}.`;
      if (errorDetailsForLogging.binanceMsg) {
        thrownErrorMessage += ` Binance Message: ${errorDetailsForLogging.binanceMsg}`;
        if (errorDetailsForLogging.binanceCode) {
            thrownErrorMessage += ` (Code: ${errorDetailsForLogging.binanceCode})`;
        }
      }
      throw new Error(thrownErrorMessage.trim());
    }
    
    const data: Ticker24hr | Ticker24hr[] = await response.json();
    return data;
  } catch (error) {
    // Log the error at the point it's caught by the caller, not here.
    // Re-throw the caught error (which might be the one we constructed above, or a network error)
    if (error instanceof Error) {
      // console.error(`[${new Date().toISOString()}] Error in get24hrTicker (symbol: ${symbol || 'all'}) - Propagating known API error: ${error.message}`);
      throw error; 
    }
    // Fallback for non-Error objects if they somehow reach here.
    // console.error(`[${new Date().toISOString()}] Error in get24hrTicker (symbol: ${symbol || 'all'}) - Propagating unknown error.`);
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
      cache: 'no-store', // Ensure no caching for this fetch
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
            
      let thrownErrorMessage = `Failed to fetch account information from Binance API: ${response.status} ${response.statusText}.`;
      if (parsedErrorData?.msg) {
        thrownErrorMessage += ` Binance Message: ${parsedErrorData.msg}`;
        if (parsedErrorData?.code) {
            thrownErrorMessage += ` (Code: ${parsedErrorData.code})`;
        }
      } else if (rawErrorBody) {
        const snippet = rawErrorBody.substring(0, 150) + (rawErrorBody.length > 150 ? '...' : '');
        thrownErrorMessage += ` Raw Response Snippet: ${snippet}`;
      } else {
        thrownErrorMessage += ' No additional error details from response body.';
      }
      throw new Error(thrownErrorMessage.trim());
    }

    const data: AccountInformation = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(`Operation failed in getAccountInformation: ${String(error)}`);
  }
}
