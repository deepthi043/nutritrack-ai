import { validateSignupForm } from "../app/validateSignupForm";

describe("validateSignupForm (section 10)", () => {
  it("requires a full name", () => {
    expect(validateSignupForm("", "a@b.com", "password123", "password123")).toBe("Full name is required.");
    expect(validateSignupForm("   ", "a@b.com", "password123", "password123")).toBe("Full name is required.");
  });

  it("requires an email", () => {
    expect(validateSignupForm("Jane Doe", "", "password123", "password123")).toBe("Email is required.");
  });

  it("requires a password of at least 8 characters", () => {
    expect(validateSignupForm("Jane Doe", "a@b.com", "short", "short")).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("rejects a confirm-password mismatch", () => {
    expect(validateSignupForm("Jane Doe", "a@b.com", "password123", "password124")).toBe(
      "Passwords do not match."
    );
  });

  it("accepts a fully valid form", () => {
    expect(validateSignupForm("Jane Doe", "a@b.com", "password123", "password123")).toBeNull();
  });
});
