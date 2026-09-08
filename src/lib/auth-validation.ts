const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_RE.test(trimmed)) return "Invalid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export function validateSignIn(email: string, password: string): string | null {
  return validateEmail(email) ?? validatePassword(password);
}

export function validateSignUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}): string | null {
  if (!input.name.trim()) return "Full name is required.";
  const emailErr = validateEmail(input.email);
  if (emailErr) return emailErr;
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 10) return "Mobile number is required.";
  const passErr = validatePassword(input.password);
  if (passErr) return passErr;
  if (input.password !== input.confirmPassword) {
    return "Confirm password must match.";
  }
  if (!input.agreedToTerms) {
    return "You must agree to the Terms & Conditions.";
  }
  return null;
}
