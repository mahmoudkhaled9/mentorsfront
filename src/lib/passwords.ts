/** Same rules as the server (src/auth/passwords.js), checked early so the form can say what is wrong. */
export function passwordProblem(password: string, { email, name }: { email?: string; name?: string }) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (new TextEncoder().encode(password).length > 72) return 'Password is too long';
  if (/^(.)\1+$/.test(password)) return 'Password is too simple';
  if (email && password.toLowerCase() === email.toLowerCase()) return 'Password must not be the same as the email';
  if (name && password.toLowerCase() === name.toLowerCase()) return 'Password must not be the same as the name';
  return '';
}
