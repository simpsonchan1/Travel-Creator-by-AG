import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, ResponseModality } from 'firebase/ai';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new GoogleAIBackend() });

const modelImage = getGenerativeModel(ai, {
    model: "gemini-2.5-flash-image",
    generationConfig: {
        responseModalities: [ResponseModality.IMAGE]
    }
});

async function test() {
    try {
        const resultImage = await modelImage.generateContent("A cute cat");
        console.log("Success Image:", resultImage.response.inlineDataParts()?.length > 0);
    } catch (e) {
        console.error("Error generating content:", e.message);
    }
}
test();
