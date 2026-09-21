import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { updateProfile } from "../services/profileService";
import { getApiErrorMessage } from "../services/api";

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary (little to no exercise)" },
  { value: "light", label: "Light activity (1-3 days/week)" },
  { value: "moderate", label: "Moderate activity (3-5 days/week)" },
  { value: "active", label: "Very active (6-7 days/week)" },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityPreference, setActivityPreference] = useState("moderate");
  const [dailyStepGoal, setDailyStepGoal] = useState("10000");
  const [dailyWaterGoalLiters, setDailyWaterGoalLiters] = useState("2.5");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await updateProfile({
        age: age ? Number(age) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        activity_preference: activityPreference,
        daily_step_goal: Number(dailyStepGoal) || 10000,
        daily_water_goal_ml: Math.round((Number(dailyWaterGoalLiters) || 2.5) * 1000),
      });
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Let&apos;s personalize your plan</h1>
          <p className="max-w-sm text-sm text-slate-500">
            This helps us tailor your dashboard. You can change this anytime in your profile.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Age"
              type="number"
              name="age"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="30"
            />
            <Input
              label="Height (cm)"
              type="number"
              name="height"
              min={50}
              max={272}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="170"
            />
          </div>

          <Input
            label="Weight (kg)"
            type="number"
            name="weight"
            min={1}
            max={500}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="65"
          />

          <div>
            <label htmlFor="activityPreference" className="mb-1.5 block text-sm font-medium text-slate-700">
              Activity level
            </label>
            <select
              id="activityPreference"
              value={activityPreference}
              onChange={(e) => setActivityPreference(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Daily step goal"
              type="number"
              name="stepGoal"
              min={1000}
              step={500}
              value={dailyStepGoal}
              onChange={(e) => setDailyStepGoal(e.target.value)}
            />
            <Input
              label="Water goal (L)"
              type="number"
              name="waterGoal"
              min={0.5}
              step={0.1}
              value={dailyWaterGoalLiters}
              onChange={(e) => setDailyWaterGoalLiters(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Continue to dashboard
          </Button>
        </form>
      </div>
    </div>
  );
}
