import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
});

export async function translateText(text: string, targetLanguage: string = 'the user\'s likely language (detected from context)'): Promise<string> {
  if (!text) return '';
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set. Translation disabled.");
    return text;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else. Text: "${text}"`,
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

export async function detectAndTranslate(text: string): Promise<{ translatedText: string; detectedLanguage: string }> {
  if (!text) return { translatedText: '', detectedLanguage: 'unknown' };
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify the language of this text and translate it to English. Output in JSON format: { "detectedLanguage": "...", "translatedText": "..." }. Text: "${text}"`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      translatedText: result.translatedText || text,
      detectedLanguage: result.detectedLanguage || 'unknown'
    };
  } catch (error) {
    console.error("Detection/Translation error:", error);
    return { translatedText: text, detectedLanguage: 'unknown' };
  }
}
