import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/generate", async (req, res) => {
  try {
    const { text, count = 20, difficulty = "Mixed", language = "Hindi", subject = "Auto-detect" } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "AI API key is not configured. Add OPENAI_API_KEY to the server environment." });
    }
    if (typeof text !== "string" || text.trim().length < 80) {
      return res.status(400).json({ error: "Readable source text is too short. Upload a clearer file or paste more text." });
    }
    const safeCount = Math.max(5, Math.min(Number(count) || 20, 100));
    const chunks = splitText(text, 11000);
    const selected = chunks.slice(0, Math.min(chunks.length, 12));
    const perChunk = Math.max(1, Math.ceil(safeCount / selected.length));
    let all = [];

    for (let i = 0; i < selected.length && all.length < safeCount; i++) {
      const prompt = `You are an exacting Rajasthan CET Senior Secondary (12th Level) exam question writer.
Create up to ${perChunk} high-quality multiple-choice questions ONLY from the supplied source.
Requested language: ${language}. Difficulty: ${difficulty}. Subject hint: ${subject}.
Rules:
- Every question must have exactly four options, exactly one defensibly correct answer.
- Never use outside knowledge to fill gaps. Do not infer missing dates/names/facts.
- If source is ambiguous, omit that question.
- Distractors must be plausible but clearly incorrect according to the source.
- Do not duplicate questions or test the same fact repeatedly.
- Explanation must be concise and supported by the source.
- Include a short sourceQuote copied from the source to help verify the answer.
Return ONLY valid JSON in this exact shape:
{"questions":[{"question":"...","options":["A...","B...","C...","D..."],"correctIndex":0,"explanation":"...","sourceQuote":"...","topic":"..."}]}
Source section ${i + 1} of ${selected.length}:
${selected[i]}`;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return valid JSON only. Accuracy is more important than quantity." },
            { role: "user", content: prompt }
          ]
        })
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`AI provider error (${response.status}): ${details.slice(0, 500)}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);
      all.push(...(Array.isArray(parsed.questions) ? parsed.questions : []));
    }

    const seen = new Set();
    const validated = all.filter(q => {
      if (!q || typeof q.question !== "string" || !Array.isArray(q.options) ||
          q.options.length !== 4 || !Number.isInteger(q.correctIndex) ||
          q.correctIndex < 0 || q.correctIndex > 3) return false;
      if (q.options.some(o => typeof o !== "string" || !o.trim())) return false;
      const key = q.question.toLowerCase().replace(/\W/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, safeCount);

    if (!validated.length) return res.status(422).json({ error: "The source did not produce enough verifiable MCQs. Try clearer pages or a different section." });
    res.json({ questions: validated, generated: validated.length, note: validated.length < safeCount ? "Fewer questions were generated because the source did not support more reliable questions." : "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Question generation failed." });
  }
});

function splitText(input, max) {
  const parts = [];
  let remaining = input.trim();
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\\n", max);
    if (cut < max * 0.55) cut = remaining.lastIndexOf("।", max);
    if (cut < max * 0.55) cut = max;
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});
app.listen(PORT, () => console.log(`CET Smart Test server listening on ${PORT}`));
