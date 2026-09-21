import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Card } from "../Card";
import { ProgressBar } from "../ProgressBar";
import { Input } from "../Input";
import { Button } from "../Button";

interface StepProgressProps {
  steps: number;
  goal: number;
  progressPercent: number;
  onUpdateGoal: (newGoal: number) => Promise<void>;
}

export function StepProgress({ steps, goal, progressPercent, onUpdateGoal }: StepProgressProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftGoal, setDraftGoal] = useState(String(goal));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsed = Number(draftGoal);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a goal greater than 0.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onUpdateGoal(Math.round(parsed));
      setIsEditing(false);
    } catch {
      setError("Could not update goal. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setDraftGoal(String(goal));
    setError(null);
    setIsEditing(false);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Daily Goal</h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mb-3 flex items-start gap-2">
          <Input
            type="number"
            min={1}
            value={draftGoal}
            onChange={(e) => setDraftGoal(e.target.value)}
            error={error ?? undefined}
            className="max-w-[140px]"
          />
          <Button size="sm" variant="primary" onClick={handleSave} isLoading={isSaving} aria-label="Save goal">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving} aria-label="Cancel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <p className="mb-3 text-lg font-semibold text-slate-900">{goal.toLocaleString()} steps</p>
      )}

      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">
          {steps.toLocaleString()} / {goal.toLocaleString()}
        </span>
        <span className="text-slate-500">{progressPercent}% complete</span>
      </div>
      <ProgressBar percent={progressPercent} />
    </Card>
  );
}
