import { useState, type FormEvent } from "react";
import { FlaskConical } from "lucide-react";
import { Modal } from "../Modal";
import { Input } from "../Input";
import { Button } from "../Button";
import type { AddActivityInput } from "../../types";

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: AddActivityInput) => Promise<void>;
}

interface FormErrors {
  steps?: string;
  distance_km?: string;
  active_minutes?: string;
}

export function AddActivityModal({ isOpen, onClose, onSubmit }: AddActivityModalProps) {
  const [steps, setSteps] = useState("500");
  const [distanceKm, setDistanceKm] = useState("0.35");
  const [activeMinutes, setActiveMinutes] = useState("5");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const nextErrors: FormErrors = {};
    const stepsNum = Number(steps);
    const distanceNum = Number(distanceKm);
    const minutesNum = Number(activeMinutes);

    if (!Number.isFinite(stepsNum) || stepsNum < 0) nextErrors.steps = "Steps cannot be negative.";
    if (!Number.isFinite(distanceNum) || distanceNum < 0) nextErrors.distance_km = "Distance cannot be negative.";
    if (!Number.isFinite(minutesNum) || minutesNum < 0) nextErrors.active_minutes = "Active minutes cannot be negative.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        steps: Math.round(Number(steps)),
        distance_km: Number(distanceKm),
        active_minutes: Math.round(Number(activeMinutes)),
      });
      onClose();
      setSteps("500");
      setDistanceKm("0.35");
      setActiveMinutes("5");
    } catch {
      setSubmitError("Could not save activity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Activity">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Development / Demo Activity Data.</span> This entry is manually added for
          testing — it is not real sensor-tracked activity from a phone or wearable.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Steps"
          type="number"
          min={0}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          error={errors.steps}
        />
        <Input
          label="Distance (km)"
          type="number"
          min={0}
          step="0.01"
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          error={errors.distance_km}
        />
        <Input
          label="Active minutes"
          type="number"
          min={0}
          value={activeMinutes}
          onChange={(e) => setActiveMinutes(e.target.value)}
          error={errors.active_minutes}
        />

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Activity
          </Button>
        </div>
      </form>
    </Modal>
  );
}
