import { GoogleGenerativeAI, SchemaType } from "https://esm.sh/@google/generative-ai@0.21.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SummaryPayload {
  summary: string[];
  insights: string[];
  reading_time_minutes: number;
  key_phrases: string[];
}

// 1. Initialize the SDK
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

// 2. Define the JSON schema for the response
const schema = {
  description: "Web page summary and insights",
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    insights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    reading_time_minutes: { type: SchemaType.NUMBER },
    key_phrases: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["summary", "insights", "reading_time_minutes", "key_phrases"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, url, content, mode } = await req.json();

    if (!content || typeof content !== "string") {
      return json({ error: "Missing 'content' string" }, 400);
    }

    if (!GEMINI_API_KEY) {
      return json({ error: "Gemini API key not configured" }, 500);
    }

    // 3. Configure the model with the schema
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const bulletCount = mode === "brief" ? 3 : 6;
    const trimmed = content.slice(0, 30000);

    const prompt = `You are an expert reading assistant. Summarize this web page.
      Page title: ${title ?? "(untitled)"}
      URL: ${url ?? "(unknown)"}
      Content: ${trimmed}
      
      Produce a structured summary with about ${bulletCount} bullets.`;

    // 4. Generate content
    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();

    if (!textResponse) {
      return json({ error: "No response from Gemini" }, 500);
    }

    const parsed: SummaryPayload = JSON.parse(textResponse);
    return json(parsed, 200);

  } catch (e) {
    console.error("summarize error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}