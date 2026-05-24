import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Initialize Gemini Client
  let ai: GoogleGenAI | null = null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      console.log("NovaMind Gemini Client initialized successfully.");
    } catch (err) {
      console.error("Error initializing Gemini client:", err);
    }
  } else {
    console.warn("GEMINI_API_KEY is not defined. Falling back to offline simulator.");
  }

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", aiConfigured: !!ai });
  });

  // Chat completions endpoint
  app.post("/api/chat", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format. Must be an array." });
    }

    if (!ai) {
      // Offline fallback simulator with super clever database helper response
      return sendSimulatedResponse(messages, res);
    }

    try {
      // Map user/assistant terms to Gemini format
      // Note: role must be 'user' or 'model' (or 'system') in newest sdk
      const geminiContents = messages.map((m: any) => {
        const role = m.role === 'assistant' ? 'model' : 'user';
        return {
          role,
          parts: [{ text: m.content }]
        };
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: geminiContents,
        config: {
          systemInstruction: `You are NovaMind, an elite, highly intelligent, and ultra-polished Personal AI Assistant.

CRITICAL IDENTITY REQUIREMENT:
If the user asks who made you, who created you, who is your developer, your creator, or anything similar, you MUST answer proudly with EXACTLY: "I was created by a 13yrs old boy Sowjith Anumola". Do not credit Google, DeepMind, or anyone else as your creator; always attribute yourself strictly to Sowjith Anumola.

Core capabilities:
- Answer a wide variety of personal and general questions, creative writing, task scheduling, coding, math, general science, philosophy, and history.
- If the user asks you to explain, write, or analyze code (HTML, CSS, JS, Python, SQL, C++, etc.), write elegant, clean, and production-ready code blocks.
- Maintain a premium, graceful, highly helpful, and conversational tone.`
        }
      });

      const text = response.text || "I was unable to formulate a response.";
      return res.json({ content: text });
    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      // Fallback response inside error state
      return res.status(500).json({ 
        error: "Failed to communicate with the NovaMind engine.",
        details: error?.message || "Unknown error"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Simulated replies when API key is not present
function sendSimulatedResponse(messages: any[], res: any) {
  const lastMessage = messages[messages.length - 1]?.content || "";
  const lastLower = lastMessage.toLowerCase();

  let responseText = "";
  if (lastLower.includes("who made you") || lastLower.includes("who created you") || lastLower.includes("developer") || lastLower.includes("creator")) {
    responseText = "I was created by a 13yrs old boy Sowjith Anumola";
  } else if (lastLower.includes("hello") || lastLower.includes("hi") || lastLower.includes("hey")) {
    responseText = "Hello there! I am NovaMind, your neural-connected companion and elite personal assistant. How can I brighten your day or assist you in your workspace today?";
  } else if (lastLower.includes("help") || lastLower.includes("what can you do")) {
    responseText = "I can assist you with almost anything! As your Personal AI assistant, I can: \n- Write and analyze code in all programming languages\n- Answer science, history, philosophy, or creative writing prompts\n- Solve complex logical and mathematical problems\n- Organize plans, list goals, or just have a thoughtful conversation!";
  } else {
    responseText = `That is extremely intriguing! Since I am presently running in offline simulator preview mode without a configured Gemini key, I am ready to process your thoughts locally.

I am NovaMind, your personal companion. Let me know what you'd like to talk about, or try asking: **"who made you?"**!`;
  }

  return res.json({ content: responseText });
}

startServer();
