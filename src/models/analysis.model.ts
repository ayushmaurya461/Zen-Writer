export interface Tone {
  name: string;
  score: number;
}

export interface GrammarMistake {
  mistake: string;
  correction: string;
  explanation: string;
}

export interface AnalysisResult {
  tone: Tone;
  suggestions: string[];
  grammarMistakes: GrammarMistake[];
}
