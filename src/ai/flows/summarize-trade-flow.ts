
'use server';
/**
 * @fileOverview An AI flow to generate a human-readable summary of a completed trade.
 *
 * - summarizeTrade - A function that handles the trade summarization process.
 * - SummarizeTradeInput - The input type for the summarizeTrade function.
 * - SummarizeTradeOutput - The return type for the summarizeTrade function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Trade } from '@/types/trade';

const SummarizeTradeInputSchema = z.object({
    symbol: z.string().describe('The trading symbol, e.g., BTC/USDT.'),
    tradeDirection: z.string().describe("The direction of the trade, either 'LONG' or 'SHORT'."),
    pnl: z.number().optional().describe('The profit or loss from the trade in currency amount.'),
    pnlPercentage: z.number().optional().describe('The profit or loss from the trade as a percentage.'),
    entryReason: z.string().optional().describe('The technical reason the trade was entered.'),
    exitReason: z.string().optional().describe('The technical reason the trade was exited.'),
});
export type SummarizeTradeInput = z.infer<typeof SummarizeTradeInputSchema>;

const SummarizeTradeOutputSchema = z.string().describe("A concise, one-sentence narrative summary of the trade, written in the past tense. It must start by stating the outcome (successful, unsuccessful, or break-even) and trade direction.");
export type SummarizeTradeOutput = z.infer<typeof SummarizeTradeOutputSchema>;

export async function summarizeTrade(trade: Trade): Promise<SummarizeTradeOutput> {
  const input: SummarizeTradeInput = {
    symbol: `${trade.baseAsset}/${trade.quoteAsset}`,
    tradeDirection: trade.tradeDirection,
    pnl: trade.pnl,
    pnlPercentage: trade.pnlPercentage,
    entryReason: trade.entryReason,
    exitReason: trade.exitReason,
  };
  return summarizeTradeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeTradePrompt',
  input: { schema: SummarizeTradeInputSchema },
  output: { schema: SummarizeTradeOutputSchema },
  prompt: `You are a trading analyst. Create a single-sentence summary for the following completed trade.

Characterize the trade as 'successful' if PNL > 0, 'unsuccessful' if PNL < 0, and 'a break-even' if PNL is 0.
Start the sentence with the characterization and the trade direction.
Explain the entry and exit reasons clearly and concisely.
Format the PNL and percentage with two decimal places.

Example: "This was a successful LONG trade on BTC/USDT. Entry was triggered by a Bullish Delta Divergence, and the position was closed for a profit of $25.50 (1.52%) after the trailing stop-loss was hit."

Trade Details:
- Symbol: {{{symbol}}}
- Direction: {{{tradeDirection}}}
- Entry Reason: {{{entryReason}}}
- Exit Reason: {{{exitReason}}}
- P&L: {{{pnl}}}
- P&L Percentage: {{{pnlPercentage}}}
`,
});

const summarizeTradeFlow = ai.defineFlow(
  {
    name: 'summarizeTradeFlow',
    inputSchema: SummarizeTradeInputSchema,
    outputSchema: SummarizeTradeOutputSchema,
  },
  async (input) => {
    // Define the fallback logic in a dedicated function to ensure it's always available.
    const generateFallbackSummary = (): string => {
      const outcome = input.pnl === undefined ? 'a' : (input.pnl > 0 ? 'a successful' : (input.pnl < 0 ? 'an unsuccessful' : 'a break-even'));
      const pnlText = input.pnl !== undefined && input.pnlPercentage !== undefined
          ? ` for a profit/loss of ${input.pnl.toFixed(2)} (${input.pnlPercentage.toFixed(2)}%)`
          : '';
      return `This was ${outcome} ${input.tradeDirection} trade on ${input.symbol}. The position was closed${pnlText}. Entry: ${input.entryReason || 'N/A'}. Exit: ${input.exitReason || 'N/A'}.`;
    };

    try {
      const response = await prompt(input);
      
      // Defensively check if the response and its output are valid strings.
      if (response && response.output && typeof response.output === 'string' && response.output.trim() !== '') {
        return response.output;
      }

      // If we reach here, the output was invalid (null, undefined, empty string).
      console.warn(`[${new Date().toISOString()}] summarizeTradeFlow: Genkit prompt returned a nullish or empty value for symbol ${input.symbol}. Falling back to default summary.`);
      return generateFallbackSummary();

    } catch (e) {
      // If the prompt itself throws an error (e.g., API error, safety block), catch it.
      console.error(`[${new Date().toISOString()}] summarizeTradeFlow: Genkit prompt failed for symbol ${input.symbol}. Error:`, e instanceof Error ? e.message : String(e));
      return generateFallbackSummary();
    }
  }
);
