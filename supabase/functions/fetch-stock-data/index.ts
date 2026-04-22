import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StockData {
  currentPrice: number;
  atr: number;
  ticker: string;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 20): number {
  const trueRanges: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  const recentTR = trueRanges.slice(-period);
  const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
  
  return atr;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ticker } = await req.json();

    console.log('Received ticker:', ticker);

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: "Ticker symbol is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let tickerWithSuffix = ticker.trim();
    
    if (!tickerWithSuffix.includes('.')) {
      tickerWithSuffix = `${tickerWithSuffix}.T`;
    }
    
    console.log('Using ticker:', tickerWithSuffix);
    
    const period1 = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tickerWithSuffix)}?period1=${period1}&period2=${period2}&interval=1d`;
    
    console.log('Fetching URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yahoo Finance API error:', errorText);
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.chart?.result?.[0]) {
      console.error('Invalid response data:', JSON.stringify(data));
      throw new Error('Invalid ticker symbol or no data available');
    }

    const result = data.chart.result[0];
    const quote = result.indicators.quote[0];
    
    if (!quote || !quote.high || !quote.low || !quote.close) {
      throw new Error('Missing price data in API response');
    }
    
    const highs = quote.high.filter((v: number | null) => v !== null);
    const lows = quote.low.filter((v: number | null) => v !== null);
    const closes = quote.close.filter((v: number | null) => v !== null);
    
    if (closes.length === 0) {
      throw new Error('No valid price data available');
    }
    
    const currentPrice = closes[closes.length - 1];
    const atr = calculateATR(highs, lows, closes, 20);

    const stockData: StockData = {
      currentPrice: Math.round(currentPrice * 100) / 100,
      atr: Math.round(atr * 100) / 100,
      ticker: tickerWithSuffix,
    };

    console.log('Success! Returning stock data:', stockData);

    return new Response(
      JSON.stringify(stockData),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error('Error fetching stock data:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch stock data',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});