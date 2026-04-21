import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CompanyResult {
  symbol: string;
  name: string;
  displaySymbol?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { query } = await req.json();

    console.log('Searching for:', query);

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Search query is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Search in local database first (supports Japanese)
    const { data: localResults, error: dbError } = await supabase
      .from('company_names')
      .select('ticker, name_ja, name_kana, name_en')
      .or(`name_ja.ilike.%${query}%,name_kana.ilike.%${query}%,name_en.ilike.%${query}%,ticker.ilike.%${query}%`)
      .limit(5);

    if (dbError) {
      console.error('Database search error:', dbError);
    }

    const results: CompanyResult[] = [];

    // Add local results
    if (localResults && localResults.length > 0) {
      console.log('Found local results:', localResults.length);
      localResults.forEach((company: any) => {
        results.push({
          symbol: company.ticker,
          name: company.name_ja,
          displaySymbol: `${company.name_ja} (${company.ticker})`,
        });
      });
    }

    // If no local results or query looks like English, also try Yahoo Finance
    if (results.length < 5 && /^[a-zA-Z0-9\s]+$/.test(query)) {
      console.log('Also searching Yahoo Finance...');
      
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0&quotesQueryId=tss_match_phrase_query`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.quotes && data.quotes.length > 0) {
          const tokyoStocks = data.quotes
            .filter((quote: any) => 
              quote.symbol && 
              (quote.symbol.endsWith('.T') || quote.exchDisp === 'Tokyo')
            )
            .map((quote: any) => {
              const symbolWithoutSuffix = quote.symbol.replace('.T', '');
              return {
                symbol: symbolWithoutSuffix,
                name: quote.shortname || quote.longname || quote.symbol,
                displaySymbol: `${quote.shortname || quote.longname} (${symbolWithoutSuffix})`,
              };
            })
            .slice(0, 5 - results.length);

          results.push(...tokyoStocks);
        }
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log('Returning results:', results.length);

    return new Response(
      JSON.stringify({ results }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error('Error searching company:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to search company',
        results: [],
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