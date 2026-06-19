const UNIVERSITY_EMAIL_DOMAIN =
  /\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$/i;

/** Accepts US .edu and international university domains such as .edu.my or .ac.uk. */
export function isUniversityEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1) return false;

  const domain = normalized.slice(at + 1);
  return UNIVERSITY_EMAIL_DOMAIN.test(domain);
}

export const UNIVERSITY_EMAIL_ERROR =
  'Email must be a valid university address (e.g. name@university.edu or name@student.university.edu.my).';
