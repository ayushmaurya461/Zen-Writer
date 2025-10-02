import { Component, ChangeDetectionStrategy, signal, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { GeminiService } from './services/gemini.service';
import { AnalysisResult } from './models/analysis.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private sanitizer = inject(DomSanitizer);
  
  editorContent = signal<string>('<div>Welcome to Zen Writer! Start typing here and see the magic happen. For example, try writing: "i think ur idea is bad and we shud not proceed with it."</div>');
  analysis = signal<AnalysisResult | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  
  theme = signal<'light' | 'dark'>('light');
  showMoreActions = signal(false);
  editorWidthPercent = signal(66);

  sanitizedContent = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.editorContent()));
  fontFamilies = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Comic Sans MS'];
  moreActions = ['Make Funny', 'Make Sarcastic', 'Make Encouraging', 'Make Frustrated', 'Simplify'];

  private debounceTimeout: any;

  // Bound methods for event listeners to maintain 'this' context
  private boundDoResize = this.doResize.bind(this);
  private boundStopResize = this.stopResize.bind(this);

  constructor() {
    this.initializeTheme();
    
    // Effect for debounced analysis
    effect(() => {
      const content = this.editorContent();
      const textContent = this.stripHtml(content);

      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      
      if (textContent.trim().length > 10) {
        this.debounceTimeout = setTimeout(() => this.runAnalysis(textContent), 1000);
      } else {
        this.analysis.set(null);
      }
    }, { allowSignalWrites: true });

    // Effect for theme switching and persistence
    effect(() => {
      const currentTheme = this.theme();
      if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('zen-writer-theme', currentTheme);
    });

    // Initial analysis on load
    this.runAnalysis(this.stripHtml(this.editorContent()));
  }

  private initializeTheme(): void {
    const savedTheme = localStorage.getItem('zen-writer-theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        this.theme.set(savedTheme);
    } else if (prefersDark) {
        this.theme.set('dark');
    } else {
        this.theme.set('light'); // Default to light theme
    }
  }

  toggleTheme(): void {
    this.theme.update(current => current === 'light' ? 'dark' : 'light');
  }

  private stripHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  }

  onContentChange(event: Event): void {
    const target = event.target as HTMLDivElement;
    this.editorContent.set(target.innerHTML);
  }

  format(command: string, value?: string): void {
    document.execCommand(command, false, value);
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
    if (editor) editor.focus();
  }

  startResize(event: MouseEvent): void {
    event.preventDefault();
    document.addEventListener('mousemove', this.boundDoResize);
    document.addEventListener('mouseup', this.boundStopResize, { once: true });
  }

  private doResize(event: MouseEvent): void {
    const newWidth = (event.clientX / window.innerWidth) * 100;
    // Constrain the width to prevent panels from becoming too small
    if (newWidth > 25 && newWidth < 75) {
      this.editorWidthPercent.set(newWidth);
    }
  }
  
  private stopResize(): void {
    document.removeEventListener('mousemove', this.boundDoResize);
  }
  
  async runAnalysis(text: string): Promise<void> {
    if (!text) return;
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await this.geminiService.analyzeText(text);
      this.analysis.set(result);
    } catch (e) {
      console.error(e);
      this.error.set('Failed to analyze text. The API key may be invalid or the service is unavailable.');
      this.analysis.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }
  
  async transformContent(action: string): Promise<void> {
    this.showMoreActions.set(false); // Close dropdown on action
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0;
    
    const textToTransform = hasSelection ? selection!.toString() : this.stripHtml(this.editorContent());

    if (!textToTransform) return;
    
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
        const newText = await this.geminiService.transformText(textToTransform, action);
        if (hasSelection) {
            document.execCommand('insertText', false, newText);
        } else {
            this.editorContent.set(`<div>${newText.replace(/\n/g, '<br>')}</div>`);
        }
    } catch (e) {
        console.error(e);
        this.error.set(`Failed to '${action}' text. Please try again.`);
    } finally {
        this.isLoading.set(false);
    }
  }

  applySuggestion(suggestion: string): void {
    this.editorContent.set(`<div>${suggestion.replace(/\n/g, '<br>')}</div>`);
  }

  applyGrammarCorrection(mistake: string, correction: string): void {
    this.editorContent.update(currentContent => {
        // Replace only the first occurrence to avoid unintended changes
        return currentContent.replace(mistake, correction);
    });
  }

  toneColorClass = computed(() => {
    const toneName = this.analysis()?.tone.name.toLowerCase();
    if (!toneName) return 'bg-gray-400 dark:bg-gray-600';

    const toneColorMap: { [key: string]: string } = {
        // Positive
        'formal': 'bg-green-500', 'professional': 'bg-green-500',
        'confident': 'bg-blue-500', 'joyful': 'bg-yellow-400',
        'encouraging': 'bg-teal-400', 'friendly': 'bg-sky-400',

        // Negative
        'angry': 'bg-red-600', 'critical': 'bg-red-500',
        'sad': 'bg-indigo-500', 'defensive': 'bg-orange-500',
        'frustrated': 'bg-rose-600',

        // Neutral/Other
        'casual': 'bg-sky-500', 'informal': 'bg-sky-500',
        'neutral': 'bg-slate-500', 'objective': 'bg-slate-500',
        'sarcastic': 'bg-purple-500',
    };
    
    return toneColorMap[toneName] || 'bg-gray-400 dark:bg-gray-600';
  });
}