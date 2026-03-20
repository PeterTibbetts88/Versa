import { GoogleGenAI } from "@google/genai";

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

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
