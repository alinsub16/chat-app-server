import express from "express";
import Groq from "groq-sdk";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post("/proofread", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a proofreading assistant. Correct any grammar, spelling, and punctuation errors in the user's text. Return ONLY the corrected text, nothing else. Do not explain changes.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    const corrected = result.choices[0].message.content;
    res.json({ corrected });

  } catch (error) {
    console.error("Groq error:", error);
    res.status(500).json({ error: "Failed to proofread text" });
  }
});

export default router;