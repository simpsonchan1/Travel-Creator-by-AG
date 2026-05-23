/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";

function getAiInstance() {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) throw new Error("API Key not found. Please set your Gemini API Key in the Settings.");
    return new GoogleGenAI({ apiKey: key });
}

export async function generateCarouselStory(keyword: string, slideCount: number, isLongContent: boolean = false, language: "zh" | "en" = "zh"): Promise<any> {
    const ai = getAiInstance();
    const lengthInstruction = language === "en" ? 
        (isLongContent ? "Must be exceptionally long, detailed, and insightful (min 800 words)." : "Must be concise and punchy, strictly UNDER 500 characters.") :
        (isLongContent ? "Must be exceptionally long, detailed, and insightful (至少 800 字以上)." : "Must be concise and punchy, strictly UNDER 500 characters (必須在 500 個字元內，適合 Threads 使用).");

    const langInstruction = language === "en" 
        ? "Written in professional travel news style in UK English. Use rich and formal UK English."
        : "Written in professional travel news style, Traditional Chinese, Hong Kong (香港MM/Mill MILK專業深入旅遊專題風格).";

    const systemPrompt = `You are an expert travel journalist and professional Instagram editor for 'Traveltopia', a high-end travel and lifestyle platform. 
    Create a highly detailed, comprehensive ${slideCount}-slide Instagram carousel story.
    Rules:
    1. mainCaption: ${langInstruction} ${lengthInstruction} Explore cultural depths, trendy phenomena, and provide practical yet uncommon tips. The tone should be engaging, trendy, and spark deep discussion. Include a provocative hook and a strong call-to-action. End with exactly 5 highly relevant hashtags. NEVER use the em dash character.
    2. slides: Generate exactly ${slideCount} slides with a clear narrative arc (Hook -> Context -> Details -> Climax -> Call to Action).
    3. imageText: A compelling, editorial title (max 20 chars). ${language === "en" ? "Must be in UK English." : "Must be in formal Traditional Chinese."}
    4. imageBody: A highly detailed, informative, and sophisticated description to be overlaid on the image (2-4 rich and descriptive sentences). ${language === "en" ? "Must be in UK English." : "Must be in 繁體中文書面語."} Provide trendy, thought-provoking, or culturally deep content that adds significant value.
    5. imagePrompt MUST BE IN ENGLISH: Extremely detailed visual prompt describing the scene, lighting, composition, and mood for an AI image generator to create a high-quality visualization.
    6. imagePromptZh MUST BE IN CHINESE: Professional Traditional Chinese (Hong Kong style) translation of the imagePrompt.`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Generate an exceptional, highly detailed ${slideCount}-slide carousel masterclass about: ${keyword}. Provide the best possible content.`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    mainCaption: { type: Type.STRING },
                    slides: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.INTEGER },
                                imageText: { type: Type.STRING },
                                imageBody: { type: Type.STRING },
                                imagePrompt: { type: Type.STRING },
                                imagePromptZh: { type: Type.STRING }
                            },
                            required: ["id", "imageText", "imageBody", "imagePrompt", "imagePromptZh"]
                        }
                    }
                },
                required: ["mainCaption", "slides"]
            }
        }
    });

    return JSON.parse(response.text!);
}

export async function regenerateSlidesFromCaption(caption: string, slideCount: number, language: "zh" | "en"): Promise<any> {
    const ai = getAiInstance();
    const langInstruction = language === 'en' 
        ? "The 'imageText' and 'imageBody' MUST be written in English." 
        : "The 'imageText' and 'imageBody' MUST be written in professional travel news style, Traditional Chinese, Hong Kong (香港MM/Mill MILK專業深入旅遊專題風格). Use profound, rich, and formal language.";

    const systemPrompt = `You are an expert content strategist and editor for 'Traveltopia'. 
    Based on the user's provided Instagram caption, break it down and plan exactly ${slideCount} slides for an image carousel.
    Rules:
    1. imageText: A compelling title (max 20 chars) to be overlaid on the image.
    2. imageBody: A highly detailed, informative 2-4 sentence description to be overlaid. It should deeply match the caption's flow and provide substantial value to the reader.
    3. imagePrompt MUST BE IN ENGLISH: Extremely detailed visual prompt describing the scene, lighting, composition, and mood for an AI image generator to create a high-quality visualization.
    4. imagePromptZh MUST BE IN CHINESE: Professional Traditional Chinese (Hong Kong style) translation of the imagePrompt.
    5. ${langInstruction}`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Generate exactly ${slideCount} slides based on this caption:\n\n${caption}`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.INTEGER },
                        imageText: { type: Type.STRING },
                        imageBody: { type: Type.STRING },
                        imagePrompt: { type: Type.STRING },
                        imagePromptZh: { type: Type.STRING }
                    },
                    required: ["id", "imageText", "imageBody", "imagePrompt", "imagePromptZh"]
                }
            }
        }
    });

    return JSON.parse(response.text!);
}

export async function generateRewrite(caption: string, language: "zh" | "en" = "zh"): Promise<string[]> {
    const ai = getAiInstance();
    const langInstruction = language === "en" 
        ? "The rewritten versions MUST follow a professional travel news style in UK English. Ensure the tone is engaging, trendy, and sparks discussion."
        : "The rewritten versions MUST follow a professional travel news style, Traditional Chinese, Hong Kong (香港MM/Mill MILK專業深入旅遊專題風格). Ensure the tone is engaging, trendy, and sparks discussion.";

    const systemPrompt = `You are an expert Instagram copywriter for 'Traveltopia', a high-end travel magazine. Analyze the provided caption and generate 2 different rewritten versions.
    CRITICAL RULE: ${langInstruction} DO NOT use the em dash character. Return ONLY a JSON array of 2 strings.`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Rewrite this caption to make it better and professional for social media:\n${caption}`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });

    return JSON.parse(response.text!);
}

export async function generateTrivia(topic: string, language: "zh" | "en" = "zh"): Promise<string[]> {
    const ai = getAiInstance();
    const langInstruction = language === "en"
        ? "Use professional travel news style in UK English."
        : "Use professional travel news style, Traditional Chinese, Hong Kong (香港MM/Mill MILK專業深入旅遊專題風格).";

    const systemPrompt = `You are a knowledgeable travel guide for 'Traveltopia'. Generate 3 fascinating, lesser-known fun facts (trivia) about the user's topic. Focus on trendy or culturally deep content. ${langInstruction} Return ONLY a JSON array of 3 strings. Emojis are encouraged.`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Generate 3 fun facts related to this topic:\n${topic}`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });

    return JSON.parse(response.text!);
}

export async function generateSlideTextRewrite(captionText: string, slideText: string, language: "zh" | "en" = "zh"): Promise<any> {
    const ai = getAiInstance();
    const langInstruction = language === "en"
        ? "Maintain a professional travel news style in UK English."
        : "Maintain a professional travel news style in Traditional Chinese (Hong Kong style, 香港MM/Mill MILK專業風格).";

    const systemPrompt = `You are an expert travel journalist for 'Traveltopia'. 
    The user wants to improve the text of a single slide in their Instagram carousel.
    Write a catchy, editorial title (max 20 chars) and a highly detailed description (2-4 rich sentences).
    ${langInstruction}
    Use the provided main caption context if helpful. NEVER use the em dash character.`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Main Caption Context:\n${captionText}\n\nCurrent Slide Text to improve:\n${slideText}\n\nProvide the new title and body.`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    imageText: { type: Type.STRING },
                    imageBody: { type: Type.STRING }
                },
                required: ["imageText", "imageBody"]
            }
        }
    });

    return JSON.parse(response.text!);
}

export async function generateSlidePrompt(captionText: string, slideText: string): Promise<{promptEn: string, promptZh: string}> {
    const ai = getAiInstance();
    const systemPrompt = `You are an expert AI image prompt engineer. 
    Based on the provided context, generate a highly detailed prompt (IN ENGLISH) describing the scene, lighting, composition, and mood optimized for an AI image generator. Also provide a professional Traditional Chinese (Hong Kong style) translation of the prompt.`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Context:\nCaption: ${captionText}\nSlide Text: ${slideText}\n\nGenerate the English image prompt and its Chinese translation.`,
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    promptEn: { type: Type.STRING },
                    promptZh: { type: Type.STRING }
                },
                required: ["promptEn", "promptZh"]
            }
        }
    });

    return JSON.parse(response.text!);
}

export async function generateCarouselImage(prompt: string, style: string, instruction: string, referenceImage?: { dataUrl: string, category: string }, includeMascot = true, mascotImage?: { dataUrl: string }, layoutImage?: { dataUrl: string }): Promise<string> {
    const ai = getAiInstance();
    const mascotPrompt = includeMascot 
      ? "Include a cute teal alien mascot. Maintain consistent size and proportions for the mascot across all scenes. " 
      : "Empty scene, NO characters. ";
    
    // Clean prompt
    const baseScene = prompt.replace(/[\r\n]+/g, ' ').substring(0, 500);

    try {
        const parts: any[] = [];
        let contextPrompt = '';

        const noTextInstruction = "IMPORTANT: DO NOT INCLUDE ANY TEXT, WORDS, OR LETTERS IN THE IMAGE. The image must be clean and textless.";

        if (mascotImage && layoutImage && includeMascot) {
            contextPrompt = `Generate an image. Use the FIRST attached image strictly for character design reference (character MUST have exactly the same color and shape, but can have a different emotion, action, and pose). Use the SECOND attached image strictly for layout/style reference (100% same layout and style as the second image). New scene: ${baseScene}. Art style: ${style}. ${instruction}. ${noTextInstruction}`;
        } else if (mascotImage && includeMascot) {
            contextPrompt = `Generate an image. Use the attached image strictly for character design reference. The character MUST have exactly the same color and shape (100% similarity), but can have a different emotion, action, and pose based on the scene. New scene: ${baseScene}. Art style: ${style}. ${instruction}. ${noTextInstruction}`;
        } else if (layoutImage) {
            contextPrompt = `Generate an image. Use the attached image strictly for layout/style reference. Ensure 100% same layout and style as the attached image. New scene: ${baseScene}. ${mascotPrompt} Art style: ${style}. ${instruction}. ${noTextInstruction}`;
        } else {
            const finalPrompt = `Scene: ${baseScene}. ${mascotPrompt} Style: ${style}. ${instruction}. ${noTextInstruction}`;
            parts.push({ text: finalPrompt });
        }

        if (contextPrompt) {
            parts.push({ text: contextPrompt });
        }

        if (mascotImage && includeMascot) {
            const b64 = mascotImage.dataUrl.split(',')[1];
            const mimeType = mascotImage.dataUrl.split(';')[0].split(':')[1];
            parts.push({ inlineData: { data: b64, mimeType } });
        }

        if (layoutImage) {
            const b64 = layoutImage.dataUrl.split(',')[1];
            const mimeType = layoutImage.dataUrl.split(';')[0].split(':')[1];
            parts.push({ inlineData: { data: b64, mimeType } });
        }

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: {
                parts: parts
            },
            config: {
                imageConfig: {
                    aspectRatio: "3:4"
                }
            }
        });
        
        for (const part of response.candidates![0].content!.parts!) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("No image generated by Gemini 3.1 Flash Image.");

    } catch (e) {
        console.error("Image gen error", e);
        throw e;
    }
}

export async function generateDesignSuggestion(imageBase64: string, titleText: string, bodyText: string): Promise<any> {
    const ai = getAiInstance();
    const b64 = imageBase64.split(',')[1];
    const mimeType = imageBase64.split(';')[0].split(':')[1];

    const systemPrompt = `You are an expert graphic designer and typographer. 
    Analyze the provided image (take note of graphics, mascots, safe spaces and tone), title text, and body text.
    Suggest the most visually appealing design layout settings that match the mood of the image and enhance readability.
    fontFamily options: "Inter", "'Noto Sans TC', sans-serif", "'Noto Serif TC', serif", "'Oswald', sans-serif", "'Playfair Display', serif", "'Pacifico', cursive", "'Dancing Script', cursive", "'Anton', sans-serif", "'Space Grotesk', sans-serif", "'Outfit', sans-serif".
    titleSize options: 40, 60, 80, 100, 120.
    bodySize options: 24, 36, 46, 60, 80.
    Colors must be in HEX format (e.g. #FFFFFF). Suggest rich, complementary brand colors instead of default black/white if it matches the aesthetic.
    layoutStyle options: "gradient", "solid", "glass", "textOnly".
    layoutOpacity options: 0, 25, 50, 75, 100.
    textEffect options: "none", "shadow", "outline", "neon".`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
            parts: [
                { inlineData: { data: b64, mimeType } },
                { text: `Title Text: ${titleText}\nBody Text: ${bodyText}\n\nProvide the best cohesive layout, separate title & body typography, textEffect, and color settings based on this image's mood.` }
            ]
        },
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    titleFontFamily: { type: Type.STRING },
                    titleTextEffect: { type: Type.STRING },
                    titleColor: { type: Type.STRING },
                    titleSize: { type: Type.INTEGER },
                    bodyFontFamily: { type: Type.STRING },
                    bodyTextEffect: { type: Type.STRING },
                    bodyColor: { type: Type.STRING },
                    bodySize: { type: Type.INTEGER },
                    layoutStyle: { type: Type.STRING },
                    layoutOpacity: { type: Type.INTEGER },
                },
                required: ["titleFontFamily", "titleTextEffect", "titleColor", "titleSize", "bodyFontFamily", "bodyTextEffect", "bodyColor", "bodySize", "layoutStyle", "layoutOpacity"]
            }
        }
    });

    return JSON.parse(response.text!);
}

export async function editImageInpaint(base64Image: string, prompt: string): Promise<string> {
    const ai = getAiInstance();
    try {
        const b64 = base64Image.split(',')[1];
        const mimeType = base64Image.split(';')[0].split(':')[1];
        
        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: {
                parts: [
                    { inlineData: { data: b64, mimeType } },
                    { text: `Please apply the following edit to the area approximately indicated by the red drawn shape: "${prompt}". DO NOT ADD TEXT OR LETTERS TO THE IMAGE.` }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: "3:4"
                }
            }
        });
        
        for (const part of response.candidates![0].content!.parts!) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("No image returned from editing.");
    } catch (e) {
        console.error("Edit image error", e);
        throw e;
    }
}
