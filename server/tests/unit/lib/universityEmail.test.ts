import { isUniversityEmail } from '../../../src/lib/universityEmail.js';

describe('isUniversityEmail', () => {
  it('accepts US .edu addresses', () => {
    expect(isUniversityEmail('student@test.edu')).toBe(true);
  });

  it('accepts Malaysian .edu.my addresses', () => {
    expect(isUniversityEmail('218319@student.upm.edu.my')).toBe(true);
  });

  it('rejects personal email providers', () => {
    expect(isUniversityEmail('user@gmail.com')).toBe(false);
  });
});
