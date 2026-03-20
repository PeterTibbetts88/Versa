import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface Message {
  role: 'user' | 'model';
  text: string;
  attachment?: Attachment;
}

export interface Attachment {
  data: string; // base64
  mimeType: string;
  name: string;
}

export interface AnalysisResponse {
  title: string;
  summary: string;
  content: string; // Markdown content
}

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

export async function startAnalysis(
  input: string, 
  attachment?: Attachment
): Promise<AnalysisResponse> {
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

  const ai = getAI();
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

  return JSON.parse(response.text);
}

export async function sendChatMessage(
  history: Message[],
  newMessage: string,
  attachment?: Attachment
): Promise<string> {
  const ai = getAI();
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
    },
    history: history.map(m => ({
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

  return response.text;
}
