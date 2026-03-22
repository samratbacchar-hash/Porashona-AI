import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { Camera, Download, Send, Loader2, Sun, Moon, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnswerDisplay } from "@/components/AnswerDisplay";
import { QuestionHistory } from "@/components/QuestionHistory";
import { ModeSelector } from "@/components/ModeSelector";
import { generatePDF } from "@/lib/pdf";

const CameraScanner = lazy(() =>
  import("@/components/CameraScanner").then((m) => ({ default: m.CameraScanner }))
);

export type AnswerMode = "answer" | "summary" | "bullets" | "flashcards";

export interface AnswerData {
  question: string;
  mode: AnswerMode;
  steps?: string[];
  simpleExplanation?: string;
  bengaliExplanation?: string;
  realLifeExample?: string;
  summary?: string;
  bengaliSummary?: string;
  keyTakeaway?: string;
  points?: string[];
  bengaliPoints?: string[];
  flashcards?: { front: string; back: string }[];
  bengaliFlashcards?: { front: string; back: string }[];
}

const Index = () => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [history, setHistory] = useState<AnswerData[]>([]);
  const [mode, setMode] = useState<AnswerMode>("answer");
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const askQuestion = useCallback(async (q: string, selectedMode?: AnswerMode) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setAnswer(null);
    const currentMode = selectedMode || mode;

    try {
      const { data, error } = await supabase.functions.invoke("answer-question", {
        body: { question: trimmed, mode: currentMode },
      });

      if (controller.signal.aborted) return;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result: AnswerData = { question: trimmed, mode: currentMode, ...data };
      setAnswer(result);
      setHistory((prev) => [result, ...prev.filter((h) => h.question !== trimmed).slice(0, 9)]);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error(err);
      const msg = err?.message || "Failed to get answer. Please try again.";
      toast.error(msg);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [mode]);

  const handleSubmit = useCallback(() => askQuestion(question), [askQuestion, question]);

  const handleScanResult = useCallback((text: string) => {
    setQuestion(text);
    setShowCamera(false);
    askQuestion(text);
  }, [askQuestion]);

  const handleDownloadPDF = useCallback(async () => {
    if (!answer) return;
    try {
      await generatePDF(answer);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF.");
    }
  }, [answer]);

  const handleHistorySelect = useCallback((item: AnswerData) => {
    setAnswer(item);
    setQuestion(item.question);
    setMode(item.mode);
  }, []);

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm px-4 py-3">
        <div className="container mx-auto flex items-center justify-between max-w-3xl">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shadow-sm">
              <GraduationCap size={18} />
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Porashona AI</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground hidden sm:inline font-medium">Study Assistant</span>
            <button
              onClick={() => setDark((d) => !d)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-6 space-y-5">
        <section className="text-center space-y-1.5 pt-1 pb-1">
          <h2
            className="text-xl font-semibold text-foreground sm:text-2xl"
            style={{ lineHeight: "1.15", textWrap: "balance" }}
          >
            Ask anything, learn better
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto" style={{ textWrap: "pretty" }}>
            Structured answers in English &amp; Bengali — steps, summaries, key points, or flashcards.
          </p>
        </section>

        <ModeSelector mode={mode} onModeChange={setMode} />

        <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type or paste your question here…"
            className="w-full min-h-[88px] resize-none rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50 transition-shadow"
            style={{ overflowWrap: "break-word" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSubmit}
              disabled={loading || question.trim().length < 2}
              className="gap-2 active:scale-[0.97]"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              Get Answer
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCamera(true)}
              className="gap-2 active:scale-[0.97]"
            >
              <Camera size={16} />
              Scan Question
            </Button>
          </div>
        </div>

        {showCamera && (
          <Suspense fallback={
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          }>
            <CameraScanner onResult={handleScanResult} onClose={() => setShowCamera(false)} />
          </Suspense>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-sm font-medium">Thinking…</span>
          </div>
        )}

        {answer && !loading && (
          <div className="space-y-3">
            <AnswerDisplay answer={answer} />
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto gap-2 active:scale-[0.97]"
            >
              <Download size={16} />
              Download as PDF
            </Button>
          </div>
        )}

        <QuestionHistory history={history} onSelect={handleHistorySelect} />
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        © 2026 Porashona AI — Built to help students learn better.
      </footer>
    </div>
  );
};

export default Index;
