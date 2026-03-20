import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in environment variables.");
    }
    return new GoogleGenAI({ apiKey });
  };

  const SYSTEM_INSTRUCTIONS = `
    You are "Versa", a highly versatile and expert AI assistant.
    Your goal is to provide deep, insightful, and practical guidance on any task or dilemma the user presents.
    
    You excel at:
    - Career guidance (analyzing CVs, interview prep, career pathing).
    - Style & Aesthetics (analyzing photos to suggest hairstyles, fashion, or decor).
    - Practical daily tasks (suggesting recipes from fridge photos, DIY fixes, travel planning).
    - Complex decision-making (providing nuanced pros/cons, comparisons, or strategic advice when appropriate).
    
    Format your responses:
    - Use Markdown for clarity (bold text, lists, tables, headings).
    - Be direct, supportive, and expert in your tone.
    - If an image is provided, analyze its contents thoroughly to provide specific advice.
    
    Always maintain a helpful and professional persona.
  `;

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      const { input, attachment } = req.body;
      const ai = getAI();
      
      const prompt = `
        User Input: "${input}"
        ${attachment ? `An attachment named "${attachment.name}" has been provided for context.` : ''}
        
        Provide a comprehensive initial response in the following JSON format:
        {
          "title": "A concise, descriptive title for this session",
          "summary": "A 1-2 sentence summary of the user's request or dilemma",
          "content": "Your full detailed response in Markdown format"
        }
      `;

      const parts: any[] = [{ text: prompt }];
      if (attachment) {
        parts.push({
          inlineData: {
            data: attachment.data,
            mimeType: attachment.mimeType,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              content: { type: Type.STRING },
            },
            required: ["title", "summary", "content"],
          },
        },
      });

      res.status(200).json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("Analysis API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { history, newMessage, attachment } = req.body;
      const ai = getAI();
      
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS,
        },
        history: history.map((m: any) => ({
          role: m.role,
          parts: [{ text: m.text }]
        }))
      });

      const parts: any[] = [{ text: newMessage }];
      if (attachment) {
        parts.push({
          inlineData: {
            data: attachment.data,
            mimeType: attachment.mimeType,
          },
        });
      }

      const response = await chat.sendMessage({
        message: parts
      });

      res.status(200).json({ text: response.text });
    } catch (error: any) {
      console.error("Chat API Error:", error);
      res.status(500).json({ error: error.message });
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

startServer();
