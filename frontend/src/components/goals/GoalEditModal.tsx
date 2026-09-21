import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "../Modal";
import { Input } from "../Input";
import { Button } from "../Button";
import type { GoalProgress } from "../../types";

interface GoalEditModalProps {
  goal: GoalProgress | null;
  onClose: () => void;
  onSave: (target: number) => Promise<void>;
}

export function GoalEditModal({ goal, onClose, onSave }: GoalEditModalProps) {
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setValue(String(goal.target));
      setError(null);
    }
  }, [goal]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue <= 0) {
      setError("Enter a value greater than 0.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(numValue);
      onClose();
    } catch {
      setError("Could not save goal. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={goal !== null} onClose={onClose} title={`Edit Goal — ${goal?.label ?? ""}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={goal?.label}
          type="number"
          min={0.1}
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error ?? undefined}
          hint={goal ? `Unit: ${goal.unit}` : undefined}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
