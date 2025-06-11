
/**
 * @fileOverview API Route for managing and streaming footprint chart data via SSE.
 */
import { NextResponse } from 'next/server';
import { 
  startFootprintStream, 
  stopFootprintStream, 
  addFootprintListener, 
  removeFootprintListener,
  getLatestFootprintBars,
  getCurrentAggregatingBar
} from '@/lib/footprint-aggregator';
import type { FootprintBar } from '@/types/footprint';

export const dynamic = 'force-dynamic'; // Prevent caching of this route

// Helper to send SSE messages
function createSSEMessage(data: any, eventName?: string): string {
  let message = '';
  if (eventName) {
    message += `event: ${eventName}\n`;
  }
  
  // Log the structure of priceLevels before stringification for SSE
  if (data && data.priceLevels) {
    const isMap = data.priceLevels instanceof Map;
    const size = isMap ? data.priceLevels.size : (typeof data.priceLevels === 'object' ? Object.keys(data.priceLevels).length : 'N/A');
    // console.log(`[API Route SSE] createSSEMessage for event '${eventName}': priceLevels is ${isMap ? 'Map' : 'object'}, size: ${size}.`);
    if (isMap && size > 0) {
      // console.log(`[API Route SSE] Stringifying Map. Original Map size: ${data.priceLevels.size}. Content (as object):`, JSON.stringify(Object.fromEntries(data.priceLevels)));
    } else if (!isMap && typeof data.priceLevels === 'object') {
      // console.log(`[API Route SSE] Stringifying non-Map priceLevels: `, JSON.stringify(data.priceLevels));
    }
  }

  message += `data: ${JSON.stringify(data)}\n\n`;
  return message;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  let symbolsToStream: string[] = [];

  if (symbolsParam) {
    symbolsToStream = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  } else {
    console.warn(`[${new Date().toISOString()}] Footprint SSE: No symbols provided in query. Stream will not start effectively until symbols are specified.`);
  }
  
  if (symbolsToStream.length > 0) {
    console.log(`[${new Date().toISOString()}] Footprint SSE: Client connected, starting stream for symbols: ${symbolsToStream.join(', ')}`);
    startFootprintStream(symbolsToStream); 
  }


  const stream = new ReadableStream({
    start(controller) {
      const listener: Parameters<typeof addFootprintListener>[0] = (data, eventType) => {
        // Type guard to ensure data has symbol, or narrow down Partial type
        const symbol = 'symbol' in data ? data.symbol : undefined;

        if (!symbol || (symbolsToStream.length > 0 && !symbolsToStream.includes(symbol))) {
            return; // Skip if symbol missing or not in client's requested list
        }

        try {
          // Ensure data sent to client has priceLevels as a plain object if it was a Map
          let dataToSend = { ...data };
          if (data.priceLevels instanceof Map) {
            dataToSend.priceLevels = Object.fromEntries(data.priceLevels);
          }
          controller.enqueue(createSSEMessage(dataToSend, eventType));
        } catch (e) {
          console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing data:`, e);
        }
      };

      addFootprintListener(listener);
      console.log(`[${new Date().toISOString()}] Footprint SSE: Listener added for client.`);

      if (symbolsToStream.length > 0) {
        symbolsToStream.forEach(symbol => {
          const latestBars = getLatestFootprintBars(symbol, 5); 
          latestBars.forEach(bar => {
             try {
                let barToSend = { ...bar };
                if (bar.priceLevels instanceof Map) {
                    barToSend.priceLevels = Object.fromEntries(bar.priceLevels);
                }
                controller.enqueue(createSSEMessage(barToSend, 'footprintUpdate'));
             } catch (e) {
                console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing initial bar data:`, e);
             }
          });
          getCurrentAggregatingBar(symbol).then(currentAggBar => {
            if(currentAggBar && currentAggBar.totalVolume && currentAggBar.totalVolume > 0) {
              try {
                  let partialBarToSend = { ...currentAggBar };
                  if (currentAggBar.priceLevels instanceof Map) {
                      partialBarToSend.priceLevels = Object.fromEntries(currentAggBar.priceLevels);
                  }
                  controller.enqueue(createSSEMessage(partialBarToSend, 'footprintUpdatePartial'));
              } catch (e) {
                  console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing initial partial bar data:`, e);
              }
            }
          });
        });
      }


      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(': keep-alive\n\n');
        } catch (e) {
          console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing keep-alive:`, e);
        }
      }, 20000);

      request.signal.addEventListener('abort', () => {
        removeFootprintListener(listener);
        clearInterval(keepAliveInterval);
        controller.close();
        console.log(`[${new Date().toISOString()}] Footprint SSE: Client disconnected, listener removed.`);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, symbols } = body; 

        if (action === 'start') {
            if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
                return NextResponse.json({ message: "Symbols array is required for start action." }, { status: 400 });
            }
            startFootprintStream(symbols);
            return NextResponse.json({ message: `Footprint stream processing started for ${symbols.join(', ')}.` });
        } else if (action === 'stop') {
            stopFootprintStream();
            return NextResponse.json({ message: "Footprint stream processing stopped for all symbols." });
        } else {
            return NextResponse.json({ message: "Invalid action. Use 'start' or 'stop'." }, { status: 400 });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error(`[${new Date().toISOString()}] Footprint API POST Error:`, errorMessage);
        return NextResponse.json({ message: "Error processing request.", error: errorMessage }, { status: 500 });
    }
}

