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

const NEWS_API_KEY = process.env.NEWS_API_KEY;

export const SentimentAnalysisInputSchema = z.object({
  symbol: z.string().describe('The trading symbol, e.g., BTC/USDT.'),
});
export type SentimentAnalysisInput = z.infer<typeof SentimentAnalysisInputSchema>;

export const SentimentAnalysisOutputSchema = z.enum(['Bullish', 'Bearish', 'Neutral'])
  .describe('The overall market sentiment for the asset.');
export type SentimentAnalysisOutput = z.infer<typeof SentimentAnalysisOutputSchema>;

// This tool now uses the live newsapi.org service.
const getRecentNewsTool = ai.defineTool(
    {
        name: 'getRecentNews',
        description: 'Gets recent financial news headlines for a given cryptocurrency asset.',
        inputSchema: z.object({ asset: z.string().describe("The full name of the asset, e.g., Bitcoin, Ethereum") }),
        outputSchema: z.object({
            headlines: z.array(z.string()).describe("A list of recent news headlines.")
        })
    },
    async (input) => {
        if (!NEWS_API_KEY) {
            console.error(`[sentiment-analysis-flow] NewsAPI key is not configured. Returning empty headlines.`);
            return { headlines: [] };
        }
        
        console.log(`[sentiment-analysis-flow] Fetching live news for ${input.asset}`);
        
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(input.asset)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[sentiment-analysis-flow] NewsAPI request failed with status ${response.status}:`, errorBody);
                return { headlines: [`Error fetching news: ${response.statusText}`] };
            }

            const data = await response.json();

            if (data.status === 'error') {
                 console.error(`[sentiment-analysis-flow] NewsAPI returned an error:`, data.message);
                 return { headlines: [`NewsAPI Error: ${data.message}`] };
            }

            const headlines = data.articles?.map((article: { title: string }) => article.title).filter(Boolean) || [];
            
            if (headlines.length === 0) {
                 return { headlines: [`No recent headlines found for ${input.asset}.`] };
            }

            return { headlines };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[sentiment-analysis-flow] Exception fetching news for ${input.asset}:`, errorMessage);
            return { headlines: [`Failed to fetch news due to an exception: ${errorMessage}`] };
        }
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

  The asset name for the tool needs to be the full name (e.g., 'Bitcoin' for BTC, 'Ethereum' for ETH). You must infer this from the symbol.
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
  const assetSymbol = input.symbol.replace(/USDT$/, '').replace(/BUSD$/, '');
  
  // Map symbol to full name for better news search results
  const assetNameMapping: Record<string, string> = {
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
    "BNB": "Binance Coin",
    "SOL": "Solana",
    "XRP": "Ripple XRP",
    "ADA": "Cardano",
    "DOGE": "Dogecoin",
    "LTC": "Litecoin",
    "LINK": "Chainlink"
  };

  const assetName = assetNameMapping[assetSymbol] || assetSymbol; // Fallback to symbol if not in map

  console.log(`[sentiment-analysis-flow] Mapped symbol ${assetSymbol} to asset name ${assetName} for news search.`);

  // The 'symbol' in the input to the flow is now the full name, which the prompt will use for the tool call.
  return sentimentAnalysisFlow({ symbol: assetName });
}
