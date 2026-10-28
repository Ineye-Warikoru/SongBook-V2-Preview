import type { AIProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STAFF_PROMPT = `You transcribe scanned sheet music into ABC notation. Look only at what is printed on the page images and do not invent or add music that is not there.
Write valid ABC notation with:
- X:, T: (title), M: (time signature), L: (default note length), K: (key)
- Every bar, in order, with correct repeat signs and first/second endings
- A separate voice (V:) for each stave if there is more than one
- Chord symbols above the melody written in double quotes, e.g. "G" "Cmaj7"
- Lyrics placed on their own w: lines beneath the matching melody line, aligned syllable to note
Return ONLY the raw ABC notation text, nothing else, no commentary, no code fences.`;

const CHORDS_PROMPT = `You transcribe a worship song's chords and lyrics into a plain monospaced chord chart, exactly like a typical chord sheet.
Place each chord directly above the syllable or word where it is played, using spaces to align it, for example:
       G                D
This is amazing grace
Keep section labels (Verse 1, Chorus, Bridge, etc.) on their own lines.
Return ONLY the plain text chord chart, nothing else, no commentary, no code fences, no markdown formatting.`;

function stripCodeFences(text: string): string {
  return text
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}

function validate(mode: "staff" | "chords", text: string): string | null {
  if (!text || text.trim().length < 5) return "The reply was empty.";
  if (mode === "staff") {
    const hasFields = /X:\s*\d/.test(text) && /K:\s*[A-Ga-g]/.test(text);
    if (!hasFields) return "The reply didn't look like valid ABC notation.";
  } else {
    const lines = text.split("\n").filter((l) => l.trim());
    const chordLineCount = lines.filter((l) => /[A-G](#|b)?(m|maj|dim|aug|sus)?\d*/.test(l) && l.trim().split(/\s+/).every((w) => /^[A-G](#|b)?(m|maj|dim|aug|sus|add)?\d{0,2}(\/[A-G](#|b)?)?$/.test(w))).length;
    if (chordLineCount === 0 && lines.length > 0) {
      // Lenient: accept if at least one recognizable chord token appears anywhere.
      const hasAnyChord = /\b[A-G](#|b)?(m|maj|dim|aug|sus)?\d*\b/.test(text);
      if (!hasAnyChord) return "The reply didn't contain any recognisable chords.";
    }
  }
  return null;
}

async function callClaude(apiKey: string, model: string, prompt: string, images: string[]) {
  const content: Record<string, unknown>[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: img },
  }));
  content.push({ type: "text", text: prompt });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Claude returned an error (${res.status})`);
  }
  const text = (json.content || []).map((c: { text?: string }) => c.text || "").join("\n");
  const truncated = json.stop_reason === "max_tokens";
  return { text, truncated };
}

async function callGemini(apiKey: string, model: string, prompt: string, images: string[]) {
  const parts: Record<string, unknown>[] = images.map((img) => ({
    inlineData: { mimeType: "image/jpeg", data: img },
  }));
  parts.push({ text: prompt });

  const m = model || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Gemini returned an error (${res.status})`);
  }
  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("\n");
  const truncated = candidate?.finishReason === "MAX_TOKENS";
  return { text, truncated };
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  images: string[],
) {
  const content: Record<string, unknown>[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img}` } });
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `The service returned an error (${res.status})`);
  }
  const choice = json.choices?.[0];
  const text = choice?.message?.content || "";
  const truncated = choice?.finish_reason === "length";
  return { text, truncated };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      provider,
      apiKey,
      model,
      baseUrl,
      mode,
      images,
    }: {
      provider: AIProviderId;
      apiKey: string;
      model?: string;
      baseUrl?: string;
      mode: "staff" | "chords";
      images: string[];
    } = body;

    if (!apiKey) return Response.json({ error: "No API key is saved for this service yet." }, { status: 400 });
    if (!images || images.length === 0) return Response.json({ error: "No pages to transcribe." }, { status: 400 });
    if (images.length > 6) images.length = 6;

    const prompt = mode === "staff" ? STAFF_PROMPT : CHORDS_PROMPT;

    let outcome: { text: string; truncated: boolean };
    try {
      if (provider === "claude") {
        outcome = await callClaude(apiKey, model || "", prompt, images);
      } else if (provider === "gemini") {
        outcome = await callGemini(apiKey, model || "", prompt, images);
      } else if (provider === "groq") {
        outcome = await callOpenAiCompatible(
          "https://api.groq.com/openai/v1",
          apiKey,
          model || "llama-3.2-90b-vision-preview",
          prompt,
          images,
        );
      } else if (provider === "openrouter") {
        outcome = await callOpenAiCompatible(
          "https://openrouter.ai/api/v1",
          apiKey,
          model || "google/gemini-2.5-flash",
          prompt,
          images,
        );
      } else {
        if (!baseUrl) return Response.json({ error: "Add the service's base URL in Settings first." }, { status: 400 });
        if (!model) return Response.json({ error: "Add a model name in Settings first." }, { status: 400 });
        outcome = await callOpenAiCompatible(baseUrl, apiKey, model, prompt, images);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong talking to that service.";
      const lower = msg.toLowerCase();
      let friendly = msg;
      if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid") && lower.includes("key")) {
        friendly = "That API key was rejected by the service.";
      } else if (lower.includes("429") || lower.includes("rate")) {
        friendly = "That service is busy right now. Try again shortly.";
      } else if (lower.includes("404") || lower.includes("model")) {
        friendly = "That model name wasn't recognised by the service.";
      } else if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("enotfound")) {
        friendly = "Couldn't reach that service. Check your connection.";
      }
      return Response.json({ error: friendly }, { status: 502 });
    }

    const cleaned = stripCodeFences(outcome.text);
    const validationError = validate(mode, cleaned);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 422 });
    }

    return Response.json({
      text: cleaned,
      warning: outcome.truncated ? "The reply may have been cut short. Try fewer pages at once." : null,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Something went wrong talking to that service." }, { status: 500 });
  }
}
