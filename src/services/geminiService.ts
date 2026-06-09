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
 * SECURITY NOTE: This service is secured by proxying all requests through Firebase
 * Cloud Functions (functions/src/gemini.ts). The Gemini API key is stored securely on the
 * backend, preventing exposure in the client bundle.
 * 
 * CONNECTION TO UserProfile:
 *   The user's `preferredLanguage` field (in types.ts) can be used as the
 *   `targetLanguage` parameter. This means each user's translations are
 *   personalized to their language preference.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

// Initialize HTTPS Callable Cloud Functions
const translateTextFn = httpsCallable<{ text: string; targetLanguage: string }, { translatedText: string }>(functions, 'translateText');
const detectAndTranslateTextFn = httpsCallable<{ text: string }, { translatedText: string; detectedLanguage: string }>(functions, 'detectAndTranslateText');

/**
 * translateText():
 * Translates a string to a target language via backend Cloud Function.
 * 
 * GRACEFUL DEGRADATION: If the API call fails, we return the original text.
 * The user never sees an error — they just see the untranslated message,
 * which is better than a broken UI.
 * 
 * @param text - The text to translate
 * @param targetLanguage - The language to translate into (e.g., "German", "Turkish")
 * @returns The translated text, or the original text if translation fails
 */
export async function translateText(text: string, targetLanguage: string = 'the user\'s likely language (detected from context)'): Promise<string> {
  if (!text) return '';

  try {
    const response = await translateTextFn({ text, targetLanguage });
    return response.data.translatedText || text;
  } catch (error) {
    console.error("Translation function error:", error);
    return text; // On failure, show original text rather than crashing
  }
}

/**
 * detectAndTranslate():
 * A two-in-one function: detects the source language AND translates to English via backend Cloud Function.
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
    const response = await detectAndTranslateTextFn({ text });
    return {
      translatedText: response.data.translatedText || text,
      detectedLanguage: response.data.detectedLanguage || 'unknown'
    };
  } catch (error) {
    console.error("Detect/Translation function error:", error);
    return { translatedText: text, detectedLanguage: 'unknown' };
  }
}
