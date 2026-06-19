import { isUniversityEmail } from '@/lib/universityEmail';

describe('isUniversityEmail', () => {
  it('accepts US .edu addresses', () => {
    expect(isUniversityEmail('student@university.edu')).toBe(true);
  });

  it('accepts Malaysian .edu.my addresses', () => {
    expect(isUniversityEmail('218319@student.upm.edu.my')).toBe(true);
  });

  it('accepts UK .ac.uk addresses', () => {
    expect(isUniversityEmail('student@cam.ac.uk')).toBe(true);
  });

  it('rejects personal email providers', () => {
    expect(isUniversityEmail('user@gmail.com')).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(isUniversityEmail(' 218319@student.upm.edu.my ')).toBe(true);
  });
});
