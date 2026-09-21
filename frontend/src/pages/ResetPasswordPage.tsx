import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Leaf, CheckCircle2 } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { resetPassword } from "../services/authService";
import { getApiErrorMessage } from "../services/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing its token. Please request a new one.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setIsDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!token ? (
            <p className="text-sm text-red-600">
              This reset link is invalid or missing its token. Please request a new one from the{" "}
              <Link to="/forgot-password" className="font-medium underline">
                forgot password
              </Link>{" "}
              page.
            </p>
          ) : isDone ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-8 w-8 text-brand-600" />
              <p className="text-sm text-slate-700">Your password has been reset successfully.</p>
              <Button onClick={() => navigate("/login")} className="w-full">
                Go to log in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="New password"
                type="password"
                name="newPassword"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                hint="At least 8 characters."
              />
              <Input
                label="Confirm new password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Reset password
              </Button>
            </form>
          )}
        </div>

        {!isDone && (
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Back to log in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
