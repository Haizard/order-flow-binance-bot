
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
    // Default to some symbols if none provided, or handle as an error
    // For now, let's just log and not start if no symbols are passed
    console.warn(`[${new Date().toISOString()}] Footprint SSE: No symbols provided in query. Stream will not start effectively until symbols are specified.`);
  }
  
  if (symbolsToStream.length > 0) {
    console.log(`[${new Date().toISOString()}] Footprint SSE: Client connected, starting stream for symbols: ${symbolsToStream.join(', ')}`);
    startFootprintStream(symbolsToStream); // Ensure the aggregator is running for these symbols
  }


  const stream = new ReadableStream({
    start(controller) {
      const listener = (data: FootprintBar) => {
        // Only send data for the symbols the client requested (if symbolsToStream is used for filtering)
        if (symbolsToStream.length === 0 || symbolsToStream.includes(data.symbol)) {
          try {
            controller.enqueue(createSSEMessage(data, 'footprintUpdate'));
          } catch (e) {
            console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing data:`, e);
            // Potentially close the stream if controller is broken
          }
        }
      };

      addFootprintListener(listener);
      console.log(`[${new Date().toISOString()}] Footprint SSE: Listener added for client.`);

      // Send initial data (e.g., last few bars)
      if (symbolsToStream.length > 0) {
        symbolsToStream.forEach(symbol => {
          const latestBars = getLatestFootprintBars(symbol, 5); // Send last 5 bars
          latestBars.forEach(bar => {
             try {
                controller.enqueue(createSSEMessage(bar, 'footprintUpdate'));
             } catch (e) {
                console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing initial bar data:`, e);
             }
          });
          const currentAggBar = getCurrentAggregatingBar(symbol);
          if(currentAggBar && currentAggBar.totalVolume && currentAggBar.totalVolume > 0) {
            try {
                controller.enqueue(createSSEMessage(currentAggBar, 'footprintUpdatePartial'));
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing initial partial bar data:`, e);
            }
          }
        });
      }


      // Keep-alive mechanism: send a comment every 20 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(': keep-alive\n\n');
        } catch (e) {
          console.error(`[${new Date().toISOString()}] Footprint SSE: Error enqueueing keep-alive:`, e);
        }
      }, 20000);

      // When the client disconnects
      request.signal.addEventListener('abort', () => {
        removeFootprintListener(listener);
        clearInterval(keepAliveInterval);
        controller.close();
        console.log(`[${new Date().toISOString()}] Footprint SSE: Client disconnected, listener removed.`);
        // Optionally, call stopFootprintStream() if no other clients are connected,
        // but this requires more complex connection management in footprint-aggregator.
        // For now, the aggregator keeps running.
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

// POST could be used to explicitly tell the server to start/stop managing symbols
// For simplicity, GET with query params handles subscription for now.
// Example: /api/footprint-stream/manage?action=start&symbols=BTCUSDT,ETHUSDT
// Example: /api/footprint-stream/manage?action=stop
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, symbols } = body; // symbols is an array of strings

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
