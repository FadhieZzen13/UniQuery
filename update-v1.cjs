const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'src', 'routes', 'v1.ts');
let code = fs.readFileSync(file, 'utf8');

// 1. In /auth/register, replace the response with the token generation logic
code = code.replace(
  /res\.status\(201\)\.json\(\{ userId: result\.rows\[0\]\.id \}\);/,
  `const user = result.rows[0];
      const jti = uuidv4();
      const token = signToken({
        sub: user.id,
        role: user.role,
        institution_id: user.institution_id,
        course_enrollments: [],
        jti,
      });
  
      const fingerprint = fingerprintToken(token);
      await pool.query(
        \`INSERT INTO sessions (session_id, user_id, jwt_fingerprint, last_seen_at, expires_at)
         VALUES ($1, $2, $3, now(), now() + interval '24 hours')\`,
        [jti, user.id, fingerprint]
      );
  
      res.status(201).json({
        token,
        user: {
          id: user.id,
          institutionalEmail: user.institutional_email,
          role: user.role,
          institutionId: user.institution_id,
          onboardingCompleted: user.full_name !== null,
          courseEnrollments: [],
        },
      });`
);

// 2. In /auth/login, add onboardingCompleted to the returned user
code = code.replace(
  /SELECT id, institution_id, institutional_email, password_hash, role, \\nfailed_login_count, locked_until/,
  `SELECT id, institution_id, institutional_email, password_hash, role, failed_login_count, locked_until, full_name`
);

// Need to make sure full_name is queried in login route.
// Let's actually use a regex to replace SELECT ... FROM users WHERE institutional_email = $1
code = code.replace(
  /SELECT id, institution_id, institutional_email, password_hash, role, [\s]+failed_login_count, locked_until[\s]+FROM users WHERE institutional_email = \$1/,
  `SELECT id, institution_id, institutional_email, password_hash, role, failed_login_count, locked_until, full_name FROM users WHERE institutional_email = $1`
);

code = code.replace(
  /res\.json\(\{\s+token,\s+user: \{\s+id: user\.id,\s+institutionalEmail: user\.institutional_email,\s+role: user\.role,\s+institutionId: user\.institution_id,\s+courseEnrollments,\s+\},\s+\}\);/,
  `res.json({
        token,
        user: {
          id: user.id,
          institutionalEmail: user.institutional_email,
          role: user.role,
          institutionId: user.institution_id,
          onboardingCompleted: user.full_name !== null,
          courseEnrollments,
        },
      });`
);

// 3. In /me, also return onboardingCompleted if possible? No wait `v1.ts` doesn't have a /me route. Ah, wait, /me is in `users.ts`? Or did v1 add /me?
// I will check if there is a `/me` route in v1.ts just in case.

fs.writeFileSync(file, code);
console.log('v1.ts updated');