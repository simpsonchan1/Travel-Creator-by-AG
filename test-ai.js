import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('../firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const ai = getAI(app, { backend: new GoogleAIBackend() });

const model = getGenerativeModel(ai, {
    model: "gemini-2.5-flash-lite",
});

async function test() {
    try {
        const result = await model.generateContent("Hello, who are you?");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Error generating content:", e.message);
        console.error(e);
    }
}
test();
