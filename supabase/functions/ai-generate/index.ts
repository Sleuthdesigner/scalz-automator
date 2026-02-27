import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GenerateRequest {
  prompt: string;
  template_category?: string;
  variables?: Record<string, string>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

function replaceTemplateVars(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body: GenerateRequest = await req.json();

    const { data: settings } = await supabase
      .from("settings")
      .select("key, value");

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const openaiKey = settingsMap.openai_api_key;
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured. Go to Settings to add it." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let finalPrompt = body.prompt;
    if (body.template_category && body.variables) {
      const { data: template } = await supabase
        .from("prompt_templates")
        .select("template_text")
        .eq("category", body.template_category)
        .single();

      if (template) {
        finalPrompt = replaceTemplateVars(template.template_text, body.variables);
      }
    } else if (body.variables) {
      finalPrompt = replaceTemplateVars(finalPrompt, body.variables);
    }

    const model = body.model || settingsMap.default_model || "gpt-4-turbo";
    const temperature = body.temperature ?? parseFloat(settingsMap.temperature || "0.7");

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an expert SEO and content writer specializing in local business optimization." },
          { role: "user", content: finalPrompt }
        ],
        temperature,
        max_tokens: body.max_tokens || 4000,
      }),
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return new Response(JSON.stringify({
        error: "OpenAI API error",
        details: openaiData.error?.message || "Unknown error"
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const content = openaiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      content,
      model,
      usage: openaiData.usage,
      prompt_used: finalPrompt
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
