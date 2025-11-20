import { Type } from "@google/genai";

export enum DemoMode {
  ChatConfig = 'CHAT_CONFIG',
  FunctionCalling = 'FUNCTION_CALLING',
  Embeddings = 'EMBEDDINGS',
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  toolCalls?: any[]; // For visualization
  toolResponse?: any; // For visualization
}

export interface ModelConfig {
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
  systemInstruction: string;
}

// Definitions for our mock tools
export const GPUSearchTool = {
  name: 'getNvidiaGpuPrice',
  parameters: {
    type: Type.OBJECT,
    description: 'Get the current market price and availability of an Nvidia GPU.',
    properties: {
      modelName: {
        type: Type.STRING,
        description: 'The model name of the GPU (e.g., RTX 4090, RTX 3060).',
      },
      currency: {
        type: Type.STRING,
        description: 'The currency to display the price in (e.g., USD, TWD).',
      },
    },
    required: ['modelName'],
  },
};

export const EmailTool = {
  name: 'sendEmail',
  parameters: {
    type: Type.OBJECT,
    description: 'Send an email to a specific recipient.',
    properties: {
      recipient: {
        type: Type.STRING,
        description: 'The email address of the recipient.',
      },
      subject: {
        type: Type.STRING,
        description: 'The subject line of the email.',
      },
      body: {
        type: Type.STRING,
        description: 'The body content of the email.',
      },
    },
    required: ['recipient', 'subject', 'body'],
  },
};