const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SummaryPayload {
  summary: string[];
  insights: string[];
  reading_time_minutes: number;
  key_phrases: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, url, content, mode } = await req.json();

    if (!content || typeof content !== "string") {
      return json({ error: "Missing 'content' string" }, 400);
    }

    if (content.length > 50000) {
      return json({ error: "Content too long to summarize safely." }, 400);
    }

    const origin = req.headers.get("origin");
    if (!origin) {
      console.warn("Request missing origin header");
    }

    const trimmed = content.slice(0, 30000);

    const SUMMARIZER_PROMPT_KEY = Deno.env.get("SUMMARIZER_PROMPT_KEY");
    if (!SUMMARIZER_PROMPT_KEY) {
      return json({ error: "AI gateway not configured" }, 500);
    }

    const bulletCount = mode === "brief" ? 3 : 6;

    const systemPrompt =
      "You are an expert reading assistant. Summarize web pages clearly and faithfully. " +
      "Never invent facts. Be concise and neutral.";

    const userPrompt =
      `Page title: ${title ?? "(untitled)"}\n` +
      `URL: ${url ?? "(unknown)"}\n\n` +
      `Content:\n"""\n${trimmed}\n"""\n\n` +
      `Produce a structured summary with about ${bulletCount} bullets.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUMMARIZER_PROMPT_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_summary",
                description: "Return a structured page summary.",
                parameters: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "array",
                      items: { type: "string" },
                      description: "Bullet point summary of the page.",
                    },
                    insights: {
                      type: "array",
                      items: { type: "string" },
                      description: "2-4 key insights or takeaways.",
                    },
                    reading_time_minutes: {
                      type: "number",
                      description:
                        "Estimated reading time of the original page in minutes.",
                    },
                    key_phrases: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Up to 8 short verbatim phrases (3-10 words) copied EXACTLY from the page text that represent the most important sentences. Used to highlight the page.",
                    },
                  },
                  required: [
                    "summary",
                    "insights",
                    "reading_time_minutes",
                    "key_phrases",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_summary" },
          },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          429,
        );
      }
      if (response.status === 402) {
        return json(
          { error: "AI credits exhausted. Add credits in Lovable settings." },
          402,
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      return json({ error: "No structured response from AI" }, 500);
    }

    let parsed: SummaryPayload;
    try {
      parsed = JSON.parse(args);
    } catch (_e) {
      return json({ error: "Failed to parse AI response" }, 500);
    }

    return json(parsed, 200);
  } catch (e) {
    console.error("summarize error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
