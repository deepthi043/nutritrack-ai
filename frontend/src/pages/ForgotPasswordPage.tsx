import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Leaf, FlaskConical } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { requestPasswordReset } from "../services/authService";
import { getApiErrorMessage } from "../services/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset(email);
      setMessage(response.message);
      setDevResetLink(response.dev_reset_link ?? null);
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
          <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!message ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Send reset link
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">{message}</p>

              {devResetLink && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Development mode — no email service configured
                  </p>
                  <p className="mb-2">
                    This link would normally be emailed to you. For now, use it directly:
                  </p>
                  <Link to={devResetLink.replace(window.location.origin, "")} className="break-all font-medium underline">
                    {devResetLink}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
