import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
async function test() {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002', // Is this the right model name? Or gemini-2.5-flash-image?
            prompt: 'cute dog',
            config: {
                aspectRatio: '3:4',
            }
        });
        console.log(response);
    } catch(e) {
        console.error(e);
        try {
            const resp2 = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: 'cute dog'
            });
            console.log("generateContent =>", JSON.stringify(resp2, null, 2));
        } catch(e2) {
            console.error("also failed:", e2);
        }
    }
}
test();
