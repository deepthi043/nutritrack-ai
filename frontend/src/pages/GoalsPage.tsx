import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { GoalSummary } from "../components/goals/GoalSummary";
import { GoalEditModal } from "../components/goals/GoalEditModal";
import { getGoals, updateGoal } from "../services/goalService";
import { getApiErrorMessage } from "../services/api";
import type { GoalProgress } from "../types";

export function GoalsPage() {
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<GoalProgress | null>(null);

  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getGoals();
      setGoals(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  async function handleSaveGoal(target: number) {
    if (!editingGoal) return;
    await updateGoal(editingGoal.key, target);
    await loadGoals();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My Goals</h1>
        <p className="text-sm text-slate-500">
          Set and track your activity and hydration goals. These are targets you choose — not medical
          prescriptions.
        </p>
      </div>

      {isLoading && <LoadingState message="Loading your goals..." />}

      {!isLoading && error && <ErrorState message="Unable to load goals." onRetry={loadGoals} />}

      {!isLoading && !error && <GoalSummary goals={goals} onEditGoal={setEditingGoal} />}

      <GoalEditModal goal={editingGoal} onClose={() => setEditingGoal(null)} onSave={handleSaveGoal} />
    </AppLayout>
  );
}
