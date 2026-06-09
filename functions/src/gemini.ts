import { onCall, HttpsError } from "firebase-functions/v2/https";

export const translateText = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { text, targetLanguage } = request.data;
  if (!text) {
    return { translatedText: "" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not set.");
    return { translatedText: text }; // Fallback to original text
  }

  try {
    const prompt = `Translate the following text to ${targetLanguage || 'English'}. Return ONLY the translated text, nothing else. Text: "${text}"`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    const translatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    return { translatedText };
  } catch (error) {
    console.error("Translation function error:", error);
    return { translatedText: text };
  }
});

export const detectAndTranslateText = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { text } = request.data;
  if (!text) {
    return { translatedText: "", detectedLanguage: "unknown" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not set.");
    return { translatedText: text, detectedLanguage: "unknown" };
  }

  try {
    const prompt = `Identify the language of this text and translate it to English. Output in JSON format: { "detectedLanguage": "...", "translatedText": "..." }. Text: "${text}"`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const data = JSON.parse(rawText);
    return {
      translatedText: data.translatedText || text,
      detectedLanguage: data.detectedLanguage || "unknown"
    };
  } catch (error) {
    console.error("Detect/Translate function error:", error);
    return { translatedText: text, detectedLanguage: "unknown" };
  }
});
