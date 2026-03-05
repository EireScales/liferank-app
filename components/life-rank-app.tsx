"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AssessmentResult, Category, calculateAssessment, questions } from "@/lib/questions";

type Stage = "welcome" | "assessment" | "results" | "dashboard" | "profile";

const ARCHETYPE_MAP: Record<Category, string> = {
  Career: "The Builder",
  Money: "The Strategist",
  Health: "The Athlete",
  Social: "The Connector",
  Growth: "The Explorer"
};

const PLAYER_STATS_KEY = "liferank-player-stats";

const categoryOrder: Category[] = ["Career", "Money", "Health", "Social", "Growth"];

const QUEST_TEMPLATES: Record<Category, { xp: number; label: string }> = {
  Career: { xp: 3, label: "Spend 20 focused minutes moving one important work task forward." },
  Money: { xp: 3, label: "Review your spending and move a small amount into savings." },
  Health: { xp: 3, label: "Go for a 15-minute walk or do light movement." },
  Social: { xp: 2, label: "Message or call someone you care about to meaningfully check in." },
  Growth: { xp: 2, label: "Learn one useful idea (article, video, or book) and write one takeaway." }
};

const MOMENTUM_STORAGE_KEY = "liferank-momentum";
const EARLY_ACCESS_STORAGE_KEY = "liferank-early-access";

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[20px] border border-white/10 bg-white/5 p-6 shadow-glass backdrop-blur-md transition hover:shadow-glow-hover ${className}`}>
      {children}
    </div>
  );
}

const GAME_BG = "bg-[#0f0c29]";
const GAME_GRADIENT = "bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e]";

function GameLayout({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`min-h-screen ${className}`}
      style={{
        background: "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99, 102, 241, 0.12), transparent 50%)"
      }}
    >
      {children}
    </div>
  );
}

function ResultsLayout({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`-mx-4 min-h-screen px-4 pb-8 pt-6 ${className}`} style={{
      background: "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124, 58, 237, 0.15), transparent 60%)"
    }}>
      <div className="mx-auto max-w-md">{children}</div>
    </section>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] border border-white/10 bg-white/5 p-6 shadow-glass backdrop-blur-md transition hover:shadow-glow-hover ${className}`}
    >
      {children}
    </div>
  );
}

function GameButton({
  children,
  onClick,
  className = ""
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#6366F1] bg-[length:200%_100%] px-4 py-4 text-base font-bold text-white shadow-btn-glow transition hover:opacity-95 hover:shadow-[0_0_36px_rgba(167,139,250,0.5)] active:scale-[0.98] animate-glow-pulse ${className}`}
    >
      {children}
    </button>
  );
}

function RPGStatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className="text-[#A78BFA]">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#6366F1] transition-all duration-700"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function CategoryBars({ categories }: { categories: AssessmentResult["categories"] }) {
  return (
    <div className="space-y-4">
      {categoryOrder.map((category) => (
        <RPGStatBar key={category} label={category} value={categories[category]} />
      ))}
    </div>
  );
}

export default function LifeRankApp() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [hasSavedRun, setHasSavedRun] = useState(false);
  const [history, setHistory] = useState<{ score: number; timestamp: string }[]>([]);
  const [resultStep, setResultStep] = useState(1);
  const [momentumStreak, setMomentumStreak] = useState(0);
  const [momentumLastDate, setMomentumLastDate] = useState<string | null>(null);
  const [completedQuestsToday, setCompletedQuestsToday] = useState<string[]>([]);
  const [questSuccess, setQuestSuccess] = useState<{ xp: number } | null>(null);
  const [playerStats, setPlayerStats] = useState({
    totalXPEarned: 0,
    questsCompleted: 0,
    highestLevelReached: 1
  });
  const [earlyAccessModalOpen, setEarlyAccessModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [earlyAccessEmail, setEarlyAccessEmail] = useState("");
  const [earlyAccessSuccess, setEarlyAccessSuccess] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const currentQuestion = questions[step];
  const result = useMemo(() => calculateAssessment(answers), [answers]);

  const currentValue = answers[currentQuestion?.id] ?? currentQuestion?.defaultValue ?? 5;

  const handleNext = () => {
    if (step < questions.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    setResultStep(1);
    setStage("results");
  };

  const goToNextResultStep = () => {
    setResultStep((prev) => Math.min(7, prev + 1));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("liferank-history");
      if (stored) {
        const parsed = JSON.parse(stored) as { score: number; timestamp: string }[];
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(MOMENTUM_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        lastQuestCompletedDate?: string;
        streakDays?: number;
        completedToday?: string[];
      };
      const today = getTodayISO();
      const yesterday = getYesterdayISO();
      const last = data.lastQuestCompletedDate ?? null;
      let streak = Math.max(0, data.streakDays ?? 0);
      if (last && last < yesterday) {
        streak = 0;
        window.localStorage.setItem(
          MOMENTUM_STORAGE_KEY,
          JSON.stringify({ lastQuestCompletedDate: null, streakDays: 0, completedToday: [] })
        );
      }
      const completedToday = last === today ? (data.completedToday ?? []) : [];
      setMomentumLastDate(last && last >= yesterday ? last : null);
      setMomentumStreak(streak);
      setCompletedQuestsToday(Array.isArray(completedToday) ? completedToday : []);
    } catch {
      // ignore
    }
  }, []);

  const completeQuest = (category: Category, xp: number) => {
    const today = getTodayISO();
    const yesterday = getYesterdayISO();
    const completedNext = completedQuestsToday.includes(category)
      ? completedQuestsToday
      : [...completedQuestsToday, category];
    let nextStreak = momentumStreak;
    if (momentumLastDate === yesterday) nextStreak = momentumStreak + 1;
    else if (momentumLastDate !== today) nextStreak = 1;

    setCompletedQuestsToday(completedNext);
    setMomentumLastDate(today);
    setMomentumStreak(nextStreak);
    setPlayerStats((prev) => {
      const next = {
        totalXPEarned: prev.totalXPEarned + xp,
        questsCompleted: prev.questsCompleted + 1,
        highestLevelReached: prev.highestLevelReached
      };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          MOMENTUM_STORAGE_KEY,
          JSON.stringify({ lastQuestCompletedDate: today, streakDays: nextStreak, completedToday: completedNext })
        );
      }
    } catch {
      // ignore
    }
    setQuestSuccess({ xp });
    setTimeout(() => setQuestSuccess(null), 2200);
  };

  useEffect(() => {
    if (stage === "results" && resultStep === 1) {
      setHasSavedRun(false);
      setAnalysisStep(0);
      const messagesCount = 3;
      const interval = 700;

      const intervalId = window.setInterval(() => {
        setAnalysisStep((prev) => (prev + 1) % messagesCount);
      }, interval);

      const timeoutId = window.setTimeout(() => {
        window.clearInterval(intervalId);
        goToNextResultStep();
      }, 2100);

      return () => {
        window.clearInterval(intervalId);
        window.clearTimeout(timeoutId);
      };
    }
  }, [stage, resultStep]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PLAYER_STATS_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { totalXPEarned?: number; questsCompleted?: number; highestLevelReached?: number };
        setPlayerStats((prev) => ({
          totalXPEarned: data.totalXPEarned ?? prev.totalXPEarned,
          questsCompleted: data.questsCompleted ?? prev.questsCompleted,
          highestLevelReached: Math.max(prev.highestLevelReached, data.highestLevelReached ?? 1)
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((stage === "results" || stage === "dashboard") && !hasSavedRun && result.lifeScore > 0) {
      setHasSavedRun(true);
      setHistory((prev) => {
        const next = [...prev, { score: result.lifeScore, timestamp: new Date().toISOString() }];
        try {
          window.localStorage.setItem("liferank-history", JSON.stringify(next));
        } catch {
          // ignore persistence errors
        }
        return next;
      });
      setPlayerStats((prev) => {
        let base = prev;
        try {
          const raw = window.localStorage.getItem(PLAYER_STATS_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as { totalXPEarned?: number; questsCompleted?: number; highestLevelReached?: number };
            base = {
              totalXPEarned: parsed.totalXPEarned ?? prev.totalXPEarned,
              questsCompleted: parsed.questsCompleted ?? prev.questsCompleted,
              highestLevelReached: parsed.highestLevelReached ?? prev.highestLevelReached
            };
          }
        } catch {
          // ignore
        }
        const nextLevel = Math.max(base.highestLevelReached, result.level);
        const next = { ...base, highestLevelReached: nextLevel };
        try {
          window.localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [stage, hasSavedRun, result.lifeScore, result.level]);

  const handleCopyResult = async () => {
    const summary = `My LifeRank Score: ${result.lifeScore}
Potential Score: ${result.potentialScore}
Operating at ${result.operatingPercent}% of my potential.

Top Strength: ${categoryOrder.reduce((best, category) =>
  result.categories[category] > result.categories[best] ? category : best
, categoryOrder[0])}
Biggest Opportunity: ${categoryOrder.reduce((worst, category) =>
  result.categories[category] < result.categories[worst] ? category : worst
, categoryOrder[0])}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      }
    } catch {
      // ignore copy errors
    }
  };

  const handleDownloadImage = () => {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#2E1065");
    gradient.addColorStop(0.5, "#4C1D95");
    gradient.addColorStop(1, "#0F172A");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(48, 48, width - 96, height - 96);

    ctx.fillStyle = "#A78BFA";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillText(`LEVEL ${result.level} — ${result.levelLabel.toUpperCase()}`, 80, 120);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("LifeRank Score: " + result.lifeScore, 80, 180);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("Ahead of " + result.aheadPercent + "% of players.", 80, 240);

    const topStrength = [...categoryOrder].sort((a, b) => result.categories[b] - result.categories[a])[0];
    const biggestOpportunity = [...categoryOrder].sort((a, b) => result.categories[a] - result.categories[b])[0];
    ctx.fillText("Top Strength: " + topStrength, 80, 300);
    ctx.fillText("Biggest Opportunity: " + biggestOpportunity, 80, 340);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText("LifeRank", 80, 420);
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText("Level up your life", 80, 455);

    const link = document.createElement("a");
    link.download = "liferank-card.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopyScore = async () => {
    const topStrength = [...categoryOrder].sort((a, b) => result.categories[b] - result.categories[a])[0];
    const biggestOpportunity = [...categoryOrder].sort((a, b) => result.categories[a] - result.categories[b])[0];
    const text = `LEVEL ${result.level} — ${result.levelLabel}\nLifeRank Score: ${result.lifeScore}\nAhead of ${result.aheadPercent}% of players.\nTop Strength: ${topStrength}\nBiggest Opportunity: ${biggestOpportunity}\n\nLifeRank — Level up your life`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const handleShareOnInstagram = async () => {
    handleDownloadImage();
    const topStrength = [...categoryOrder].sort((a, b) => result.categories[b] - result.categories[a])[0];
    const biggestOpportunity = [...categoryOrder].sort((a, b) => result.categories[a] - result.categories[b])[0];
    const caption = `Level ${result.level} — ${result.levelLabel} ✨ LifeRank Score: ${result.lifeScore}. Ahead of ${result.aheadPercent}% of players. Top strength: ${topStrength}. Biggest opportunity: ${biggestOpportunity}. #LifeRank #LevelUpYourLife`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(caption);
    } catch {
      // ignore
    }
  };

  const handleShareOnX = async () => {
    const strengthsSorted = [...categoryOrder].sort(
      (a, b) => result.categories[b] - result.categories[a]
    );
    const topStrength = strengthsSorted[0];
    const biggestOpportunity = strengthsSorted[strengthsSorted.length - 1];

    const text = `My LifeRank Score: ${result.lifeScore}\nPotential: ${result.potentialScore}\nTop Strength: ${topStrength}\nBiggest Opportunity: ${biggestOpportunity}\n\nTime to level up my life like a game.`;
    const url = typeof window !== "undefined" ? window.location.href : "https://liferank.app";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My LifeRank Results",
          text,
          url
        });
        return;
      }
    } catch {
      // fall through to intent link
    }

    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${url}`)}`;
    if (typeof window !== "undefined") {
      window.open(intent, "_blank");
    }
  };

  const handleJoinWaitlist = (e: FormEvent) => {
    e.preventDefault();
    const email = earlyAccessEmail.trim();
    if (!email) return;
    try {
      const payload = { email, joinedAt: new Date().toISOString() };
      if (typeof window !== "undefined") {
        const existing = window.localStorage.getItem(EARLY_ACCESS_STORAGE_KEY);
        const list = existing ? (JSON.parse(existing) as { email: string; joinedAt: string }[]) : [];
        list.push(payload);
        window.localStorage.setItem(EARLY_ACCESS_STORAGE_KEY, JSON.stringify(list));
      }
      setEarlyAccessSuccess(true);
      setTimeout(() => {
        setEarlyAccessModalOpen(false);
        setEarlyAccessSuccess(false);
        setEarlyAccessEmail("");
        setFeedbackModalOpen(true);
      }, 1800);
    } catch {
      // ignore
    }
  };

  const handleSendFeedback = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(EARLY_ACCESS_STORAGE_KEY);
        const list: { email?: string; joinedAt?: string; feedback?: string; sentAt?: string }[] = raw ? JSON.parse(raw) : [];
        const last = list[list.length - 1];
        if (last && typeof last === "object") {
          last.feedback = feedbackText.trim();
          last.sentAt = new Date().toISOString();
          window.localStorage.setItem(EARLY_ACCESS_STORAGE_KEY, JSON.stringify(list));
        } else {
          window.localStorage.setItem(EARLY_ACCESS_STORAGE_KEY, JSON.stringify([{ feedback: feedbackText.trim(), sentAt: new Date().toISOString() }]));
        }
      }
      setFeedbackText("");
      setFeedbackModalOpen(false);
    } catch {
      // ignore
    }
  };

  const onAskAI = async (event: FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim()) return;

    try {
      setChatLoading(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: chatInput,
          profile: result
        })
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      setChatReply(data.reply ?? data.error ?? "No response available.");
    } catch {
      setChatReply("Unable to connect to LifeRank AI right now. Please try again soon.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <GameLayout>
      <main className="mx-auto min-h-screen w-full max-w-md px-4 py-6 text-slate-200">
        {stage === "welcome" && (
          <section className="flex min-h-[92vh] animate-rise flex-col justify-center">
            <GlassCard className="text-center">
              <h1 className="text-3xl font-extrabold uppercase tracking-tight text-white">Welcome Player</h1>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                Most people drift through life.
              </p>
              <p className="mt-1 text-base font-medium text-slate-200">Players build their character.</p>
              <GameButton onClick={() => setEarlyAccessModalOpen(true)} className="mt-8">
                Early players shape the game
              </GameButton>
              <button
                type="button"
                onClick={() => setStage("assessment")}
                className="mt-3 w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-slate-300 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
              >
                Start Your Character
              </button>
            </GlassCard>
          </section>
        )}

        {stage === "assessment" && currentQuestion && (
          <section className="animate-rise space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Character Build Questions — {step + 1} / {questions.length}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#6366F1] transition-all duration-500"
                style={{ width: `${((step + 1) / questions.length) * 100}%` }}
              />
            </div>
            <GlassCard>
              <h2 className="text-xl font-bold text-white">{currentQuestion.label}</h2>
              {currentQuestion.type === "slider" ? (
                <div className="mt-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Casual → Disciplined</p>
                  <input
                    type="range"
                    min={currentQuestion.min}
                    max={currentQuestion.max}
                    value={currentValue}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: Number(e.target.value) }))}
                    className="h-3 w-full cursor-pointer appearance-none rounded-full bg-white/10 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-[#7C3AED] [&::-webkit-slider-thumb]:to-[#EC4899] [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(167,139,250,0.6)]"
                  />
                  <div className="mt-2 text-center text-2xl font-bold text-[#A78BFA]">{currentValue} / 10</div>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {currentQuestion.options?.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option.value }))}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                        currentValue === option.value
                          ? "border-[#A78BFA] bg-[#A78BFA]/20 text-white shadow-[0_0_20px_rgba(167,139,250,0.3)]"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-[#A78BFA]/50 hover:bg-white/10"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              <GameButton onClick={handleNext} className="mt-8">
                {step === questions.length - 1 ? "Reveal My LifeRank" : "Continue"}
              </GameButton>
            </GlassCard>
          </section>
        )}

      {stage === "results" && (
        <ResultsLayout>
          <div key={resultStep} className="animate-slide-up space-y-6">
            {resultStep === 1 && (
              <GlassCard className="text-center">
                <p className="text-lg font-bold uppercase tracking-wider text-white">
                  Generating Your Character
                </p>
                <div className="mt-6 space-y-2 text-sm text-slate-300">
                  <p className={analysisStep >= 0 ? "opacity-100 transition-opacity duration-500" : "opacity-0"}>
                    Analyzing your stats...
                  </p>
                  <p className={analysisStep >= 1 ? "opacity-100 transition-opacity duration-500" : "opacity-0"}>
                    Mapping your character build...
                  </p>
                  <p className={analysisStep >= 2 ? "opacity-100 transition-opacity duration-500" : "opacity-0"}>
                    Calculating your LifeRank...
                  </p>
                </div>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <div className="flex gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]/70 [animation-delay:120ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]/50 [animation-delay:240ms]" />
                  </div>
                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] transition-all duration-700"
                      style={{ width: `${((analysisStep + 1) / 3) * 100}%` }}
                    />
                  </div>
                </div>
              </GlassCard>
            )}

            {resultStep === 2 && (
              <GlassCard className="text-center">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#A78BFA]">
                  Level {result.level} — {result.levelLabel.toUpperCase()}
                </p>
                <p className="mt-4 text-sm text-slate-400">LifeRank Score</p>
                <div
                  className="my-2 text-6xl font-extrabold text-white sm:text-7xl"
                  style={{ textShadow: "0 0 32px rgba(167, 139, 250, 0.4)" }}
                >
                  {result.lifeScore}
                </div>
                <div className="mt-6">
                  <GameButton onClick={goToNextResultStep}>Next</GameButton>
                </div>
              </GlassCard>
            )}

            {resultStep === 3 && (
              <GlassCard className="text-center">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#A78BFA]">Potential Score</p>
                <div
                  className="my-4 text-5xl font-extrabold text-white sm:text-6xl"
                  style={{ textShadow: "0 0 28px rgba(167, 139, 250, 0.4)" }}
                >
                  {result.potentialScore}
                </div>
                <p className="text-sm text-slate-300">
                  You are operating at{" "}
                  <span className="font-bold text-[#A78BFA]">{result.operatingPercent}%</span> of your potential.
                </p>
                <div className="mt-6">
                  <GameButton onClick={goToNextResultStep}>Next</GameButton>
                </div>
              </GlassCard>
            )}

            {resultStep === 4 && (
              <GlassCard className="text-center">
                {(() => {
                  const topCategory = [...categoryOrder].sort(
                    (a, b) => result.categories[b] - result.categories[a]
                  )[0];
                  const archetypeMap: Record<Category, { title: string; description: string }> = {
                    Career: {
                      title: "The Builder",
                      description:
                        "You think in terms of projects, progress, and long-term wins. You naturally build systems and careers that compound over time."
                    },
                    Money: {
                      title: "The Strategist",
                      description:
                        "You see resources as levers. You enjoy optimizing, planning, and making smart moves that give you more options in the future."
                    },
                    Health: {
                      title: "The Athlete",
                      description:
                        "Energy, strength and vitality matter to you. When your body is taken care of, every other area of life levels up with it."
                    },
                    Social: {
                      title: "The Connector",
                      description:
                        "Relationships are your superpower. You create opportunities through people, community, and being the person others want around."
                    },
                    Growth: {
                      title: "The Explorer",
                      description:
                        "You are always learning, experimenting, and expanding your world. New skills and ideas are your favorite kind of XP."
                    }
                  };
                  const archetype = archetypeMap[topCategory];
                  return (
                    <>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{topCategory} Archetype</p>
                      <p className="mt-3 text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
                        {archetype.title}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">{archetype.description}</p>
                    </>
                  );
                })()}
                <div className="mt-6">
                  <GameButton onClick={goToNextResultStep}>Next</GameButton>
                </div>
              </GlassCard>
            )}

            {resultStep === 5 && (
              <GlassCard>
                <h3 className="text-lg font-bold text-white">Opportunity Points</h3>
                <p className="mt-1 text-xs text-slate-400">Fastest ways to gain points and level up.</p>
                <div className="mt-4 space-y-3">
                  {result.opportunities.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 shadow-[0_0_20px_rgba(167,139,250,0.1)]"
                    >
                      <span className="font-medium text-slate-200">{item.category}</span>
                      <span className="text-lg font-bold text-[#A78BFA]">+{item.potential}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <GameButton onClick={goToNextResultStep}>Next</GameButton>
                </div>
              </GlassCard>
            )}

            {resultStep === 6 && (
              <GlassCard>
                <h3 className="text-lg font-bold text-white">Daily LifeRank Quests</h3>
                <p className="mt-1 text-xs text-slate-400">Complete these today to earn XP.</p>
                <div className="mt-4 space-y-3">
                  {(() => {
                    const weakestCategories = [...categoryOrder].sort(
                      (a, b) => result.categories[a] - result.categories[b]
                    );
                    return weakestCategories.slice(0, 3).map((category) => {
                      const quest = QUEST_TEMPLATES[category];
                      return (
                        <div
                          key={category}
                          className="rounded-[16px] border border-white/10 bg-white/5 p-4 shadow-[0_0_20px_rgba(167,139,250,0.1)]"
                        >
                          <p className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
                            +{quest.xp} {category} XP
                          </p>
                          <p className="mt-1 text-sm text-slate-300">{quest.label}</p>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="mt-6">
                  <GameButton onClick={goToNextResultStep}>Next</GameButton>
                </div>
              </GlassCard>
            )}

            {resultStep === 7 && (
              <GlassCard className="text-center">
                <p className="text-base font-semibold text-white">Your character has been created.</p>
                <p className="mt-3 text-base text-slate-300">Life is the ultimate strategy game.</p>
                <p className="mt-2 text-base font-medium text-slate-200">Now it&apos;s time to play.</p>
                <div className="mt-8">
                  <GameButton onClick={() => setStage("dashboard")}>
                    Continue to Game
                  </GameButton>
                </div>
              </GlassCard>
            )}
          </div>
        </ResultsLayout>
      )}

      {stage === "dashboard" && (
        <section className="animate-rise space-y-4 pb-6">
          {questSuccess && (
            <div
              className="fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-[#2E1065] to-[#0F172A] px-8 py-6 shadow-[0_0_40px_rgba(124,58,237,0.4)] animate-rise"
              role="status"
              aria-live="polite"
            >
              <p className="text-2xl font-bold text-[#A78BFA]">+{questSuccess.xp} XP</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white">
                <span aria-hidden>🔥</span> Momentum continues!
              </p>
            </div>
          )}

          <Card className="relative overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#A78BFA]">
                  Level {result.level} — {result.levelLabel.toUpperCase()}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">LifeRank Score</p>
                <p className="mt-1 text-5xl font-extrabold text-white" style={{ textShadow: "0 0 32px rgba(167, 139, 250, 0.5)" }}>
                  {result.lifeScore}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStage("profile")}
                className="shrink-0 rounded-xl border border-[#A78BFA]/50 bg-[#A78BFA]/10 px-3 py-2 text-xs font-semibold text-[#A78BFA] transition hover:bg-[#A78BFA]/20"
              >
                Player Profile
              </button>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs font-semibold text-slate-400">
                <span>{result.lifeScore} / {result.nextLevelScore} XP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#6366F1] transition-all duration-700"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        ((result.lifeScore - result.levelMinScore) /
                          Math.max(1, result.nextLevelScore - result.levelMinScore)) *
                          100
                      )
                    )}%`
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {result.pointsToNextLevel > 0
                  ? `Next Level Unlock in ${result.pointsToNextLevel} Point${result.pointsToNextLevel !== 1 ? "s" : ""}`
                  : "Max level reached!"}
              </p>
            </div>
          </Card>

          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/5 p-5 shadow-glass backdrop-blur-md transition hover:shadow-glow-hover">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <span aria-hidden>🔥</span> Momentum Streak
            </h3>
            <p className="mt-2 text-2xl font-extrabold text-[#A78BFA]">
              Current streak: {momentumStreak} day{momentumStreak !== 1 ? "s" : ""}
            </p>
            <div className="mt-4 space-y-1.5 text-sm text-slate-300">
              <p className="font-semibold text-slate-200">XP Multiplier:</p>
              <p>3 days → 1.2× XP</p>
              <p>7 days → 1.5× XP</p>
              <p>14 days → 2× XP</p>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Complete a quest today to keep your momentum.
            </p>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/5 p-5 shadow-glass backdrop-blur-md">
            <h3 className="text-lg font-bold uppercase tracking-wider text-white">Global Player Rank</h3>
            <p className="mt-3 text-xl font-semibold text-slate-200">
              You are ahead of <span className="text-[#A78BFA]">{result.aheadPercent}%</span> of players.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Percentile</p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-300">
              <li>Top 25% = 70+</li>
              <li>Top 10% = 82+</li>
              <li>Top 1% = 92+</li>
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Top Players</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              <li><span className="text-[#A78BFA]">1️⃣</span> Level 14 — Strategist</li>
              <li><span className="text-[#A78BFA]">2️⃣</span> Level 13 — Architect</li>
              <li><span className="text-[#A78BFA]">3️⃣</span> Level 12 — Titan</li>
            </ul>
          </div>

          <Card>
            <h3 className="text-lg font-bold text-white">Daily Quests</h3>
            <p className="mt-1 text-xs text-slate-400">
              Complete at least one per day to build your Momentum Streak.
            </p>
            <div className="mt-4 space-y-3">
              {(() => {
                const weakestCategories = [...categoryOrder].sort(
                  (a, b) => result.categories[a] - result.categories[b]
                );
                return weakestCategories.slice(0, 3).map((category) => {
                  const quest = QUEST_TEMPLATES[category];
                  const done = completedQuestsToday.includes(category);
                  return (
                    <div
                      key={category}
                      className={`rounded-2xl border px-4 py-4 transition ${
                        done
                          ? "border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_24px_rgba(52,211,153,0.2)]"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
                            +{quest.xp} {category} XP
                          </p>
                          <p className="mt-1 text-sm text-slate-300">{quest.label}</p>
                          {done && (
                            <p className="mt-2 text-xs font-semibold text-emerald-400">+{quest.xp} XP earned</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => !done && completeQuest(category, quest.xp)}
                          disabled={done}
                          className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                            done
                              ? "cursor-default bg-emerald-500/20 text-emerald-300"
                              : "bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:opacity-95 active:scale-[0.98]"
                          }`}
                        >
                          {done ? "Done" : "Complete Quest"}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Category Stats</h3>
            <CategoryBars categories={result.categories} />
          </Card>

          <Card>
            {(() => {
              const topCategory = [...categoryOrder].sort(
                (a, b) => result.categories[b] - result.categories[a]
              )[0];
              const archetypeMap: Record<Category, { title: string; description: string }> = {
                Career: { title: "The Builder", description: "You think in terms of projects, progress, and long-term wins. You naturally build systems and careers that compound over time." },
                Money: { title: "The Strategist", description: "You see resources as levers. You enjoy optimizing, planning, and making smart moves that give you more options in the future." },
                Health: { title: "The Athlete", description: "Energy, strength, and vitality matter to you. When your body is taken care of, every other area of life levels up with it." },
                Social: { title: "The Connector", description: "Relationships are your superpower. You create opportunities through people, community, and being the person others want around." },
                Growth: { title: "The Explorer", description: "You are always learning, experimenting, and expanding your world. New skills and ideas are your favorite kind of XP." }
              };
              const archetype = archetypeMap[topCategory];
              return (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{topCategory} Archetype</p>
                  <p className="mt-2 text-2xl font-bold text-white">{archetype.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{archetype.description}</p>
                </>
              );
            })()}
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-white">Opportunity Points</h3>
            <p className="mt-1 text-xs text-slate-400">
              Areas where you can gain the most points.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              {result.opportunities.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-slate-300">{item.category}</span>
                  <span className="font-bold text-[#A78BFA]">+{item.potential} pts</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-white">LifeRank Progress</h3>
            <p className="mt-1 text-xs text-slate-400">
              Track how your LifeRank score improves over time.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              {history.length === 0 && (
                <p className="text-slate-400">Your first run is saved. Come back next week to see your progress.</p>
              )}
              {history.map((entry, index) => (
                <div
                  key={`${entry.timestamp}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-slate-300">Week {index + 1}</span>
                  <span className="font-bold text-[#A78BFA]">{entry.score}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-white">Shareable LifeRank Card</h3>
            <p className="mt-1 text-xs text-slate-400">
              Share your level, score, and progress.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#2E1065] to-[#0F172A] p-4 shadow-[0_8px_24px_rgba(124,58,237,0.2)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#A78BFA]">
                Level {result.level} — {result.levelLabel.toUpperCase()}
              </p>
              <p className="mt-1 text-2xl font-bold text-white">LifeRank Score: {result.lifeScore}</p>
              <p className="mt-1 text-sm text-slate-300">Ahead of {result.aheadPercent}% of players.</p>
              <p className="mt-2 text-xs text-slate-400">
                Top Strength: {[...categoryOrder].sort((a, b) => result.categories[b] - result.categories[a])[0]}
              </p>
              <p className="text-xs text-slate-400">
                Biggest Opportunity: {[...categoryOrder].sort((a, b) => result.categories[a] - result.categories[b])[0]}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500">LifeRank — Level up your life</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleShareOnX}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Share on X
              </button>
              <button
                type="button"
                onClick={handleShareOnInstagram}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Share on Instagram
              </button>
              <button
                type="button"
                onClick={handleCopyScore}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Copy Score
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] px-3 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] transition hover:opacity-95"
              >
                Download Card
              </button>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-white">Ask LifeRank AI</h3>
            <form onSubmit={onAskAI} className="mt-4 space-y-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="How can I improve my social score in 30 days?"
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-[#A78BFA]/50"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="w-full rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] px-4 py-3 font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-60"
              >
                {chatLoading ? "Thinking..." : "Ask AI"}
              </button>
            </form>
            {chatReply && <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-300">{chatReply}</p>}
          </Card>

          <Card>
            <h3 className="text-xl font-bold text-white">Your LifeRank Result</h3>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">LifeRank</p>
                <p className="text-3xl font-extrabold text-white" style={{ textShadow: "0 0 24px rgba(167, 139, 250, 0.5)" }}>{result.lifeScore}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Level</p>
                <p className="text-lg font-bold text-[#A78BFA]">{result.level} — {result.levelLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Potential</p>
                <p className="text-lg font-bold text-white">{result.potentialScore}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-300">You are ahead of <span className="font-bold text-[#A78BFA]">{result.aheadPercent}%</span> of players.</p>
            <p className="mt-4 text-sm text-slate-400">
              LifeRank is launching soon. Early players will help shape the system and get priority access.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Features coming soon:</p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-slate-400">
              <li>• AI Life Coach</li>
              <li>• Daily Quests</li>
              <li>• Progress Tracking</li>
              <li>• Character Archetypes</li>
              <li>• Global Leaderboards</li>
            </ul>
            <GameButton onClick={() => setEarlyAccessModalOpen(true)} className="mt-5">
              Join Early Access
            </GameButton>
          </Card>
        </section>
      )}

      {stage === "profile" && (
        <section
          className="animate-rise -mx-4 min-h-screen px-4 pb-8 pt-6"
          style={{
            background: "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
            backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124, 58, 237, 0.15), transparent 60%)"
          }}
        >
          <div className="mx-auto max-w-md space-y-5">
            <button
              type="button"
              onClick={() => setStage("dashboard")}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white">Player Profile</h1>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Level</p>
              <p className="mt-1 text-xl font-bold text-[#A78BFA]">
                {result.level} — {result.levelLabel}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">LifeRank Score</p>
              <p
                className="mt-1 text-4xl font-extrabold text-white"
                style={{ textShadow: "0 0 24px rgba(167, 139, 250, 0.5)" }}
              >
                {result.lifeScore}
              </p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Archetype</p>
              <p className="mt-1 text-lg font-bold text-white">
                {ARCHETYPE_MAP[[...categoryOrder].sort((a, b) => result.categories[b] - result.categories[a])[0]]}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Momentum Streak</p>
              <p className="mt-1 text-xl font-bold text-[#A78BFA]">{momentumStreak} days</p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-sm font-bold text-white">Stats</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li className="flex justify-between">
                  <span>Total XP Earned</span>
                  <span className="font-bold text-[#A78BFA]">{playerStats.totalXPEarned}</span>
                </li>
                <li className="flex justify-between">
                  <span>Quests Completed</span>
                  <span className="font-bold text-[#A78BFA]">{playerStats.questsCompleted}</span>
                </li>
                <li className="flex justify-between">
                  <span>Highest Level Reached</span>
                  <span className="font-bold text-[#A78BFA]">{playerStats.highestLevelReached}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-sm font-bold text-white">Achievements</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { id: "streak7", label: "7 Day Streak", unlocked: momentumStreak >= 7 },
                  { id: "levelup", label: "First Level Up", unlocked: playerStats.highestLevelReached >= 2 },
                  { id: "questmaster", label: "Quest Master", unlocked: playerStats.questsCompleted >= 5 }
                ].map(({ id, label, unlocked }) => (
                  <div
                    key={id}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      unlocked
                        ? "border-[#A78BFA]/50 bg-[#A78BFA]/10 text-[#A78BFA]"
                        : "border-white/10 bg-white/5 text-slate-500"
                    }`}
                  >
                    {unlocked ? "🏆" : "🔒"} {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Top Strength</p>
              <p className="mt-1 font-bold text-white">
                {[...categoryOrder].sort((a, b) => result.categories[b] - result.categories[a])[0]}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Biggest Opportunity</p>
              <p className="mt-1 font-bold text-[#A78BFA]">
                {[...categoryOrder].sort((a, b) => result.categories[a] - result.categories[b])[0]}
              </p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-sm font-bold text-white">Category Stats</p>
              <div className="mt-3 space-y-3">
                <CategoryBars categories={result.categories} />
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-sm font-bold text-white">Global Rank</p>
              <p className="mt-2 text-lg font-semibold text-slate-200">
                You are ahead of <span className="text-[#A78BFA]">{result.aheadPercent}%</span> of players.
              </p>
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>Top 25% = 70+</p>
                <p>Top 10% = 82+</p>
                <p>Top 1% = 92+</p>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-400">Top Players</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-300">
                <li>1. Level 14 — Strategist</li>
                <li>2. Level 13 — Architect</li>
                <li>3. Level 12 — Titan</li>
              </ul>
            </div>
          </div>
        </section>
      )}

        {/* Early Access Modal */}
        {earlyAccessModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="early-access-title"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !earlyAccessSuccess && setEarlyAccessModalOpen(false)}
              aria-hidden
            />
            <div className="relative w-full max-w-md rounded-[20px] border border-white/10 bg-gradient-to-b from-[#1a1535] to-[#0f0c29] p-6 shadow-glass shadow-[0_0_48px_rgba(124,58,237,0.2)] backdrop-blur-md animate-fade-in">
              {earlyAccessSuccess ? (
                <div className="text-center py-4">
                  <h2 id="early-access-title" className="text-2xl font-bold text-white">You&apos;re in.</h2>
                  <p className="mt-3 text-slate-300">We&apos;ll notify you when LifeRank opens.</p>
                </div>
              ) : (
                <>
                  <h2 id="early-access-title" className="text-xl font-bold text-white">Join Early Access</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    LifeRank is launching soon. Early players will get priority access and help shape the game.
                  </p>
                  <form onSubmit={handleJoinWaitlist} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="early-access-email" className="sr-only">Email address</label>
                      <input
                        id="early-access-email"
                        type="email"
                        value={earlyAccessEmail}
                        onChange={(e) => setEarlyAccessEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-[#A78BFA]/50"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#6366F1] px-4 py-3.5 text-base font-bold text-white shadow-[0_0_24px_rgba(124,58,237,0.4)] transition hover:opacity-95 hover:shadow-[0_0_32px_rgba(124,58,237,0.5)]"
                    >
                      Join the Waitlist
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* Feedback Modal */}
        {feedbackModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setFeedbackModalOpen(false)}
              aria-hidden
            />
            <div className="relative w-full max-w-md rounded-[20px] border border-white/10 bg-gradient-to-b from-[#1a1535] to-[#0f0c29] p-6 shadow-glass shadow-[0_0_48px_rgba(124,58,237,0.2)] backdrop-blur-md animate-fade-in">
              <h2 id="feedback-title" className="text-xl font-bold text-white">Help shape LifeRank</h2>
              <p className="mt-2 text-sm text-slate-400">
                What do you think about the concept so far?
              </p>
              <form onSubmit={handleSendFeedback} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="feedback-input" className="sr-only">Your thoughts</label>
                  <textarea
                    id="feedback-input"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Your thoughts, ideas, or suggestions..."
                    rows={5}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200 placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-[#A78BFA]/50"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#6366F1] px-4 py-3.5 text-base font-bold text-white shadow-[0_0_24px_rgba(124,58,237,0.4)] transition hover:opacity-95 hover:shadow-[0_0_32px_rgba(124,58,237,0.5)]"
                  >
                    Send Feedback
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFeedbackText(""); setFeedbackModalOpen(false); }}
                    className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3.5 text-sm font-medium text-slate-300 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
                  >
                    Skip
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </main>
    </GameLayout>
  );
}
