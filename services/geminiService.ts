import { GoogleGenAI, Type } from "@google/genai";
import { ModelConfig, GPUSearchTool, EmailTool } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 1. Basic Chat Generation
export const generateChatResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  config: ModelConfig
) => {
  const contents = [
    ...history,
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents as any,
      config: {
        systemInstruction: config.systemInstruction,
        temperature: config.temperature,
        topK: config.topK,
        topP: config.topP,
        maxOutputTokens: config.maxOutputTokens,
      },
    });
    return response;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// 2. Step 1: User asks, Model decides to call function
export const generateFunctionCall = async (
  history: any[],
  message: string,
  toolDefinitions: any[] = [GPUSearchTool, EmailTool] // Default to imported tools if none provided
) => {
  const tools = [{ functionDeclarations: toolDefinitions }];

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents as any,
      config: {
        tools: tools,
        temperature: 0.1, // Low temp for reliability
      },
    });
    return response;
  } catch (error) {
    console.error("Gemini Tool Step 1 Error:", error);
    throw error;
  }
};

// 3. Step 2: We send the function result back to the model
export const sendToolResponse = async (
  history: any[],
  functionName: string,
  functionResponseData: any,
  toolDefinitions: any[] = [GPUSearchTool, EmailTool]
) => {
  const tools = [{ functionDeclarations: toolDefinitions }];

  // Construct the proper "function" role part
  const toolResponsePart = {
    functionResponse: {
      name: functionName,
      response: { result: functionResponseData }
    }
  };

  const contents = [
    ...history,
    { role: 'tool', parts: [toolResponsePart] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents as any,
      config: {
        tools: tools, // Keep tools active in case it wants to chain calls
      },
    });
    return response;
  } catch (error) {
    console.error("Gemini Tool Step 2 Error:", error);
    throw error;
  }
};

export const generateEmbedding = async (text: string) => {
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });
    return response.embeddings[0].values;
  } catch (error) {
    console.error("Embedding Error:", error);
    throw error;
  }
};