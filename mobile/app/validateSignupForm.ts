/** Pure validation for the Signup form — extracted from SignupScreen so it's
 * unit-testable without rendering the component. Returns the first error
 * found, or null if the form is valid. */
export function validateSignupForm(
  fullName: string,
  email: string,
  password: string,
  confirmPassword: string
): string | null {
  if (!fullName.trim()) return "Full name is required.";
  if (!email.trim()) return "Email is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}
