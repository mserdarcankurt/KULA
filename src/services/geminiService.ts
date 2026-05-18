/**
 * FILE: geminiService.ts
 * ROLE IN KULA: The "Translator" — AI-powered language translation for a multilingual community.
 * 
 * WHY THIS EXISTS:
 *   Berlin neighborhoods are DEEPLY multilingual. A single circle might have
 *   Turkish, German, Arabic, English, and Ukrainian speakers. KULA uses Google's
 *   Gemini AI to auto-translate messages so language is never a barrier to community.
 * 
 * CALLED BY:
 *   - ChatRoom.tsx → when a user long-presses a message and selects "Translate"
 *   - ItemDetailsSheet.tsx → optional auto-translation of item descriptions
 * 
 * FUNCTIONS:
 *   1. translateText(): Translates a string to a specified language.
 *   2. detectAndTranslate(): Detects the source language AND translates to English.
 * 
 * SECURITY NOTE: The API key is exposed in the client bundle via VITE_GEMINI_API_KEY.
 * For production, this should be proxied through a Cloud Function (functions/index.ts)
 * to prevent key abuse. Currently acceptable for the first 100 users but must be
 * moved server-side before scaling.
 * 
 * CONNECTION TO UserProfile:
 *   The user's `preferredLanguage` field (in types.ts) can be used as the
 *   `targetLanguage` parameter. This means each user's translations are
 *   personalized to their language preference.
 */
import { GoogleGenAI } from "@google/genai";

// Read the API key from the environment (.env file).
// If not set, translation is silently disabled (returns original text).
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize the Gemini AI client
const ai = new GoogleGenAI({
  apiKey: GEMINI_KEY
});

/**
 * translateText():
 * Translates a string to a target language.
 * 
 * PROMPT DESIGN: We tell Gemini to return "ONLY the translated text, nothing else."
 * This prevents the AI from adding explanations or notes around the translation.
 * 
 * GRACEFUL DEGRADATION: If the API key is missing or the call fails,
 * we return the original text. The user never sees an error — they just
 * see the untranslated message, which is better than a broken UI.
 * 
 * @param text - The text to translate
 * @param targetLanguage - The language to translate into (e.g., "German", "Turkish")
 * @returns The translated text, or the original text if translation fails
 */
export async function translateText(text: string, targetLanguage: string = 'the user\'s likely language (detected from context)'): Promise<string> {
  if (!text) return '';
  if (!GEMINI_KEY) {
    console.warn("VITE_GEMINI_API_KEY is not set. Translation disabled.");
    return text; // Graceful fallback: return original text
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else. Text: "${text}"`,
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text; // On failure, show original text rather than crashing
  }
}

/**
 * detectAndTranslate():
 * A two-in-one function: detects the source language AND translates to English.
 * 
 * PROMPT DESIGN: We request JSON output ({ detectedLanguage, translatedText })
 * using Gemini's `responseMimeType: "application/json"` feature.
 * This ensures we get structured data back, not free-form text.
 * 
 * USE CASE: When someone posts a message in Turkish in a mixed-language circle,
 * this function detects "Turkish" and provides the English translation.
 * The UI can then show both the original and translated versions.
 * 
 * @param text - The text to detect and translate
 * @returns { translatedText: string, detectedLanguage: string }
 */
export async function detectAndTranslate(text: string): Promise<{ translatedText: string; detectedLanguage: string }> {
  if (!text) return { translatedText: '', detectedLanguage: 'unknown' };
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify the language of this text and translate it to English. Output in JSON format: { "detectedLanguage": "...", "translatedText": "..." }. Text: "${text}"`,
      config: {
        // This tells Gemini to respond in strict JSON format
        // rather than wrapping it in markdown or explanation text
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
