import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from '../models/analysis.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly ai: GoogleGenAI;
  private readonly analysisModel = 'gemini-2.5-flash';

  constructor() {
    // IMPORTANT: This assumes process.env.API_KEY is set in the environment.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private readonly analysisSchema = {
    type: Type.OBJECT,
    properties: {
      tone: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'A single word for the primary tone (e.g., Formal, Casual, Angry).' },
          score: { type: Type.INTEGER, description: 'A score from 0 to 100 for the tone intensity.' }
        }
      },
      suggestions: {
        type: Type.ARRAY,
        description: 'Three alternative phrasings for the text, each with a different style.',
        items: { type: Type.STRING }
      },
      grammarMistakes: {
        type: Type.ARRAY,
        description: 'A list of grammatical mistakes found.',
        items: {
          type: Type.OBJECT,
          properties: {
            mistake: { type: Type.STRING, description: 'The incorrect phrase.' },
            correction: { type: Type.STRING, description: 'The suggested correction.' },
            explanation: { type: Type.STRING, description: 'A brief explanation of the error.' }
          }
        }
      }
    }
  };

  async analyzeText(text: string): Promise<AnalysisResult> {
    const response = await this.ai.models.generateContent({
      model: this.analysisModel,
      contents: `Analyze the following text and provide feedback on its tone, suggest three alternative phrasings, and list any grammatical mistakes. Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: this.analysisSchema,
      },
    });

    const jsonString = response.text.trim();
    return JSON.parse(jsonString) as AnalysisResult;
  }

  async transformText(text: string, action: string): Promise<string> {
    let prompt: string;
    switch (action.toLowerCase()) {
      case 'shorten':
        prompt = `Make the following text more concise: "${text}"`;
        break;
      case 'formalize':
        prompt = `Rewrite the following text in a more formal and professional tone: "${text}"`;
        break;
      default:
        // Handles actions like "Make Funny", "Make Frustrated", etc.
        prompt = `${action} the following text: "${text}"`;
        break;
    }

    const response = await this.ai.models.generateContent({
      model: this.analysisModel,
      contents: prompt,
    });
    
    return response.text;
  }
}