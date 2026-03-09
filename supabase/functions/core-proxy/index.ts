import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method = "POST", payload, timeout = 10000 } = await req.json();

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: { message: "Missing endpoint parameter" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const CORE_API_URL = Deno.env.get("CORE_API_URL");
    const CORE_API_KEY = Deno.env.get("CORE_API_KEY");

    if (!CORE_API_URL || !CORE_API_KEY) {
      console.error("Missing CORE_API_URL or CORE_API_KEY environment variables");
      return new Response(
        JSON.stringify({ error: { message: "Server configuration error" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const coreUrl = `${CORE_API_URL}${endpoint}`;
      
      const response = await fetch(coreUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CORE_API_KEY}`,
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      return new Response(
        JSON.stringify(data),
        {
          status: response.ok ? 200 : response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: { message: "Request timeout" } }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("Core proxy error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: { 
          message: error instanceof Error ? error.message : "Internal server error" 
        } 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
