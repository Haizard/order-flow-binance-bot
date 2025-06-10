
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
        console.warn(`[${new Date().toISOString()}] Binance API (get24hrTicker for ${symbol || 'all'}): Failed to parse error response body as JSON. Raw body snippet: ${rawErrorBody ? rawErrorBody.substring(0, 200) + (rawErrorBody.length > 200 ? '...' : '') : 'empty'}`);
      }

      const errorDetailsForLogging = {
        status: response.status,
        statusText: response.statusText,
        binanceCode: parsedErrorData?.code,
        binanceMsg: parsedErrorData?.msg,
        rawBodySnippet: rawErrorBody ? rawErrorBody.substring(0, 200) + (rawErrorBody.length > 200 ? '...' : '') : "Empty response body",
        requestSymbol: symbol || 'all'
      };

      console.error(`[${new Date().toISOString()}] Binance API Error (get24hrTicker for ${errorDetailsForLogging.requestSymbol}): Status ${response.status}. See details object below.`);
      console.error("Error Details (get24hrTicker):", JSON.stringify(errorDetailsForLogging, null, 2));

      let thrownErrorMessage = `Failed to fetch ticker data for ${errorDetailsForLogging.requestSymbol} from Binance API: ${response.status} ${response.statusText}.`;
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
      throw new Error(thrownErrorMessage.trim());
    }
    
    const successTimestamp = new Date().toISOString();
    console.log(`[${successTimestamp}] Successfully fetched 24hr ticker data for ${symbol || 'all'}`);
    const data: Ticker24hr | Ticker24hr[] = await response.json();
    return data;
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    // Log the error here before re-throwing or wrapping it
    // This ensures that even if higher-level catches modify/simplify the error, the original is logged here.
    if (error instanceof Error && error.message.startsWith('Failed to fetch ticker data for')) {
        // This is an error we constructed above, no need to re-log its message in the same way,
        // but we log that it was caught here.
        console.error(`[${errorTimestamp}] Error in get24hrTicker (symbol: ${symbol || 'all'}) - Propagating known API error: ${error.message}`);
    } else {
        // This is an unexpected error (e.g., network issue before fetch, or other runtime error)
        console.error(`[${errorTimestamp}] Unexpected error in get24hrTicker (symbol: ${symbol || 'all'}):`, error instanceof Error ? error.message : String(error), error);
    }
    
    // Re-throw specific Binance API errors or a general one
    if (error instanceof Error) {
      if (error.message.startsWith('Failed to fetch ticker data for')) { // Check if it's one of our detailed errors
        throw error; 
      }
      // For other types of errors (e.g., network issues not caught by fetch's !response.ok), wrap them.
      throw new Error(`Operation failed in get24hrTicker (symbol: ${symbol || 'all'}): ${error.message}`);
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
        console.warn(`[${new Date().toISOString()}] Binance API (getAccountInformation): Failed to parse error response body as JSON. Raw body snippet: ${rawErrorBody ? rawErrorBody.substring(0, 200) + '...' : 'empty'}`);
      }

      const errorDetailsForLogging = {
        status: response.status,
        statusText: response.statusText,
        binanceCode: parsedErrorData?.code,
        binanceMsg: parsedErrorData?.msg,
        rawBodySnippet: rawErrorBody ? rawErrorBody.substring(0, 200) + (rawErrorBody.length > 200 ? '...' : '') : "Empty response body",
      };
      
      console.error(`[${new Date().toISOString()}] Binance API Error (getAccountInformation): Status ${response.status}. See details object below.`);
      console.error("Error Details (getAccountInformation):", JSON.stringify(errorDetailsForLogging, null, 2));
      
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
      throw new Error(thrownErrorMessage.trim());
    }

    const data: AccountInformation = await response.json();
    return data;
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    if (error instanceof Error && (error.message.startsWith("Failed to fetch account information") || error.message.startsWith("API Key or Secret Key is missing"))) {
        console.error(`[${errorTimestamp}] Error in getAccountInformation - Propagating known API/config error: ${error.message}`);
        throw error;
    } else {
        console.error(`[${errorTimestamp}] Unexpected error in getAccountInformation:`, error instanceof Error ? error.message : String(error), error);
        throw new Error(`Operation failed in getAccountInformation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
