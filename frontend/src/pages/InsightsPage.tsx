import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { InsightCard } from "../components/ai/InsightCard";
import { InsightHistory } from "../components/ai/InsightHistory";
import { AIChat } from "../components/ai/AIChat";
import { generateDailyInsight, generateWeeklyInsight, getInsightHistory } from "../services/aiService";
import { getApiErrorMessage } from "../services/api";
import type { DailyInsight, WeeklyInsight, AIInsightHistoryItem } from "../types";

export function InsightsPage() {
  const [history, setHistory] = useState<AIInsightHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyInsight | null>(null);
  const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await getInsightHistory();
      setHistory(data);
    } catch (err) {
      setHistoryError(getApiErrorMessage(err));
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleGenerateDaily() {
    setIsGeneratingDaily(true);
    setDailyError(null);
    try {
      const insight = await generateDailyInsight();
      setDailyInsight(insight);
      await loadHistory();
    } catch (err) {
      setDailyError(getApiErrorMessage(err));
    } finally {
      setIsGeneratingDaily(false);
    }
  }

  async function handleGenerateWeekly() {
    setIsGeneratingWeekly(true);
    setWeeklyError(null);
    try {
      const insight = await generateWeeklyInsight();
      setWeeklyInsight(insight);
      await loadHistory();
    } catch (err) {
      setWeeklyError(getApiErrorMessage(err));
    } finally {
      setIsGeneratingWeekly(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">AI Insights</h1>
        <p className="text-sm text-slate-500">
          Wellness observations generated from your own logged data. This is not medical advice.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <InsightCard
              title="Daily Insight"
              content={dailyInsight?.content ?? null}
              disclaimer={dailyInsight?.disclaimer}
              source={dailyInsight?.source}
              generatedAt={dailyInsight?.generated_at}
              isLoading={isGeneratingDaily}
              onGenerate={handleGenerateDaily}
              generateLabel="Generate Daily Insight"
            />
            {dailyError && <p className="mt-2 text-sm text-red-600">{dailyError}</p>}
          </div>

          <div>
            <InsightCard
              title="Weekly Analysis"
              content={weeklyInsight?.content ?? null}
              disclaimer={weeklyInsight?.disclaimer}
              source={weeklyInsight?.source}
              generatedAt={weeklyInsight?.generated_at}
              isLoading={isGeneratingWeekly}
              onGenerate={handleGenerateWeekly}
              generateLabel="Generate Weekly Analysis"
            />
            {weeklyError && <p className="mt-2 text-sm text-red-600">{weeklyError}</p>}
          </div>
        </div>

        <AIChat />

        {isLoadingHistory && <LoadingState message="Loading insight history..." />}
        {!isLoadingHistory && historyError && <ErrorState message="Unable to load insight history." onRetry={loadHistory} />}
        {!isLoadingHistory && !historyError && <InsightHistory items={history} />}
      </div>
    </AppLayout>
  );
}
