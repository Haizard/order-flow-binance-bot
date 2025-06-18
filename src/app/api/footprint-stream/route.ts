
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
import type { FootprintBar, PriceLevelData } from '@/types/footprint';

export const dynamic = 'force-dynamic'; // Prevent caching of this route

// Helper to send SSE messages
function createSSEMessage(data: any, eventName?: string): string {
  let message = '';
  if (eventName) {
    message += `event: ${eventName}\n`;
  }
  message += `data: ${JSON.stringify(data)}\n\n`;
  return message;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    let symbolsToStream: string[] = [];

    if (symbolsParam) {
      symbolsToStream = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    } else {
      console.warn(`[${new Date().toISOString()}] Footprint SSE: No symbols provided in query. Stream will not start effectively until symbols are specified.`);
    }
    
    if (symbolsToStream.length > 0) {
      console.log(`[${new Date().toISOString()}] Footprint SSE: Client connected, attempting to start/update stream for symbols: ${symbolsToStream.join(', ')}`);
      startFootprintStream(symbolsToStream); 
    }


    const stream = new ReadableStream({
      start(controller) {
        try {
          const listener: Parameters<typeof addFootprintListener>[0] = (data, eventType) => {
            const symbol = 'symbol' in data ? data.symbol : undefined;

            if (!symbol || (symbolsToStream.length > 0 && !symbolsToStream.includes(symbol))) {
                return; 
            }

            try {
              let dataToSend = { ...data };
              if (data.priceLevels instanceof Map) {
                dataToSend.priceLevels = Object.fromEntries(data.priceLevels);
              }
              controller.enqueue(createSSEMessage(dataToSend, eventType));
            } catch (e) {
              console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing data for ${symbol}:`, e);
            }
          };

          addFootprintListener(listener);
          console.log(`[${new Date().toISOString()}] Footprint SSE: Listener added for client monitoring symbols: ${symbolsToStream.join(', ')}`);

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
                    console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing initial bar data for ${symbol}:`, e);
                 }
              });
              const currentAggBar = getCurrentAggregatingBar(symbol);
              if(currentAggBar && typeof currentAggBar.totalVolume === 'number' && currentAggBar.totalVolume > 0) {
                try {
                    let partialBarToSend = { ...currentAggBar };
                    if (currentAggBar.priceLevels instanceof Map) {
                        partialBarToSend.priceLevels = Object.fromEntries(currentAggBar.priceLevels);
                    }
                    controller.enqueue(createSSEMessage(partialBarToSend, 'footprintUpdatePartial'));
                } catch (e) {
                    console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing initial partial bar data for ${symbol}:`, e);
                }
              }
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
            try {
              controller.close();
            } catch (e) { /* ignore if already closed */ }
            console.log(`[${new Date().toISOString()}] Footprint SSE: Client disconnected (abort signal), listener removed, stream closed for symbols: ${symbolsToStream.join(', ')}`);
          });

        } catch (error) {
          console.error(`[${new Date().toISOString()}] Footprint SSE: CRITICAL Error during stream setup phase for symbols ${symbolsToStream.join(', ')}:`, error);
          try {
            controller.error(error instanceof Error ? error : new Error(String(error)));
          } catch (e) { /* ignore if controller already errored/closed */ }
          try {
            controller.close(); 
          } catch (e) { /* ignore if already closed */ }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : "Unknown error in GET /api/footprint-stream";
    console.error(`[${timestamp}] Footprint SSE: CRITICAL UNHANDLED ERROR IN GET HANDLER:`, errorMessage, error);
    return new Response(`Server error in footprint stream: ${errorMessage}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' } 
    });
  }
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
        console.error(`[${new Date().toISOString()}] Footprint API POST Error:`, errorMessage, error);
        return NextResponse.json({ message: "Error processing request.", error: errorMessage }, { status: 500 });
    }
}
