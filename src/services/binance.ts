
'use server';
import crypto from 'crypto'; // For HMAC SHA256 signature
import type { Ticker24hr, AccountInformation, OrderSide, OrderType, NewOrderResponse } from '@/types/binance';

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
    if (error instanceof Error) {
      throw error; 
    }
    throw new Error(`An unknown error occurred in get24hrTicker (symbol: ${symbol || 'all'}).`);
  }
}

/**
 * Fetches account information using API key and secret.
 * Requires API key with "Enable Reading" permission on Testnet.
 * @param apiKeyInput Your Binance Testnet API key.
 * @param secretKeyInput Your Binance Testnet API secret key.
 * @returns AccountInformation object.
 * @throws Error if API keys are missing or the API request fails.
 */
export async function getAccountInformation(apiKeyInput: string, secretKeyInput: string): Promise<AccountInformation> {
  const apiKey = apiKeyInput;
  const secretKey = secretKeyInput;

  if (!apiKey || !secretKey) {
    throw new Error('API Key or Secret Key is missing.');
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
      } catch (e) {}
            
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

/**
 * Places a new order on the Binance exchange.
 * This function now executes a LIVE order on the exchange.
 *
 * @param apiKey - The user's Binance API key.
 * @param secretKey - The user's Binance API secret key.
 * @param symbol - The symbol to trade (e.g., 'BTCUSDT').
 * @param side - The order side ('BUY' or 'SELL').
 * @param type - The order type (e.g., 'MARKET').
 * @param quantity - The quantity to trade.
 * @returns A promise resolving to the actual order response from the exchange.
 * @throws An error if the order fails on the exchange.
 */
export async function placeNewOrder(
  apiKey: string,
  secretKey: string,
  symbol: string,
  side: OrderSide,
  type: OrderType,
  quantity: number
): Promise<NewOrderResponse> {
  const logTimestamp = new Date().toISOString();
  console.log(`[${logTimestamp}] [placeNewOrder] ATTEMPTING LIVE TRADE: ${side} ${quantity.toPrecision(6)} ${symbol}`);
  
  if (!apiKey || !secretKey) {
    throw new Error('API Key or Secret Key is missing for placing an order.');
  }

  const timestamp = Date.now();
  // NOTE: Binance requires quantity to be formatted to a specific precision per symbol.
  // Using toPrecision() is a general approach; a production system might need a function to get symbol-specific precision rules.
  const queryString = `symbol=${symbol}&side=${side}&type=${type}&quantity=${quantity.toPrecision(6)}&timestamp=${timestamp}`;

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex');

  const url = `${BINANCE_API_BASE_URL}/order`;
  const body = `${queryString}&signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const responseData = await response.json();

    if (!response.ok) {
        const errorMessage = `Binance API order failed: ${response.status} ${response.statusText}. Code: ${responseData.code}. Message: ${responseData.msg}`;
        console.error(`[${logTimestamp}] [placeNewOrder] LIVE TRADE FAILED for ${symbol}:`, errorMessage);
        throw new Error(errorMessage);
    }
    
    console.log(`[${logTimestamp}] [placeNewOrder] LIVE TRADE SUCCESS for ${symbol}. Order ID: ${responseData.orderId}`);
    return responseData as NewOrderResponse;

  } catch (error) {
    console.error(`[${logTimestamp}] [placeNewOrder] Exception during fetch for placing order on ${symbol}:`, error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('An unknown error occurred while placing the order.');
  }
}
