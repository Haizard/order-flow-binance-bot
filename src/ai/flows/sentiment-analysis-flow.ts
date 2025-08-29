'use server';
/**
 * @fileOverview An AI flow to analyze market sentiment for a given asset.
 *
 * - analyzeSentiment - A function that returns the sentiment for a crypto symbol.
 * - SentimentAnalysisInput - The input type for the sentiment analysis flow.
 * - SentimentAnalysisOutput - The return type for the sentiment analysis flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const SentimentAnalysisInputSchema = z.object({
  symbol: z.string().describe('The trading symbol, e.g., BTC/USDT.'),
});
export type SentimentAnalysisInput = z.infer<typeof SentimentAnalysisInputSchema>;

export const SentimentAnalysisOutputSchema = z.enum(['Bullish', 'Bearish', 'Neutral'])
  .describe('The overall market sentiment for the asset.');
export type SentimentAnalysisOutput = z.infer<typeof SentimentAnalysisOutputSchema>;

// This is a mock tool. In a real-world scenario, this would use an API
// to fetch live news headlines from sources like news APIs or social media feeds.
const getRecentNewsTool = ai.defineTool(
    {
        name: 'getRecentNews',
        description: 'Gets recent financial news headlines for a given cryptocurrency asset.',
        inputSchema: z.object({ asset: z.string().describe("The asset ticker, e.g., BTC") }),
        outputSchema: z.object({
            headlines: z.array(z.string()).describe("A list of recent news headlines.")
        })
    },
    async (input) => {
        console.log(`[sentiment-analysis-flow] Mock Tool: Fetching news for ${input.asset}`);
        // In a real implementation, you'd fetch real news here.
        // We return simulated headlines to demonstrate the flow's logic.
        const mockHeadlines: Record<string, string[]> = {
            "BTC": [
                "Bitcoin ETF Inflows Reach Record Highs Amidst Positive Regulatory News",
                "Major Investment Firm Announces 5% Bitcoin Allocation in Portfolio",
                "Technical Analyst Warns of Potential Short-Term Correction for Bitcoin",
            ],
            "ETH": [
                "Ethereum Upgrade 'Pectra' Promises Scalability Improvements, Driving Optimism",
                "DeFi Sector on Ethereum Sees Resurgence, Total Value Locked (TVL) Soars",
                "SEC Delays Decision on Spot Ethereum ETFs, Citing Market Concerns",
            ]
        };
        const assetHeadlines = mockHeadlines[input.asset] || [
            `Market for ${input.asset} Remains Stable with Moderate Trading Volume`,
            `No Major News Events Reported for ${input.asset} in the Last 24 Hours`,
        ];
        return { headlines: assetHeadlines };
    }
);


const sentimentPrompt = ai.definePrompt({
  name: 'sentimentAnalysisPrompt',
  input: { schema: SentimentAnalysisInputSchema },
  output: { schema: SentimentAnalysisOutputSchema },
  tools: [getRecentNewsTool],
  prompt: `You are a financial sentiment analyst. Your task is to analyze the provided news headlines for the asset derived from the symbol '{{{symbol}}}' and determine if the overall sentiment is Bullish, Bearish, or Neutral.

  - **Bullish**: The news is predominantly positive, suggesting upward price pressure.
  - **Bearish**: The news is predominantly negative, suggesting downward price pressure.
  - **Neutral**: The news is mixed, or there is no significant news to suggest a strong directional bias.

  Use the getRecentNews tool to fetch the latest headlines for the asset. Base your final decision solely on the headlines provided by the tool.
  `,
});


const sentimentAnalysisFlow = ai.defineFlow(
  {
    name: 'sentimentAnalysisFlow',
    inputSchema: SentimentAnalysisInputSchema,
    outputSchema: SentimentAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await sentimentPrompt(input);
    // If the model fails to produce a valid output, default to Neutral to be safe.
    return output ?? 'Neutral';
  }
);


export async function analyzeSentiment(input: SentimentAnalysisInput): Promise<SentimentAnalysisOutput> {
  const asset = input.symbol.replace(/USDT$/, '');
  return sentimentAnalysisFlow({ symbol: asset });
}
