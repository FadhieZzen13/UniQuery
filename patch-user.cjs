const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'src', 'routes', 'v1.ts');
let code = fs.readFileSync(file, 'utf8');

// The replacement payload:
const userPayload = `
        user: {
          id: user.id || dbUser?.id,
          email: user.institutional_email || dbUser?.institutional_email,
          name: user.full_name || dbUser?.full_name,
          role: user.role || dbUser?.role,
          institutionId: user.institution_id || dbUser?.institution_id,
          onboardingCompleted: (user.full_name || dbUser?.full_name) !== null,
          courseEnrollments: typeof courseEnrollments !== 'undefined' ? courseEnrollments : [],
        }`;

code = code.replace(/user: \{\s+id: user.id,\s+institutionalEmail: user.institutional_email,\s+role: user.role,\s+institutionId: user.institution_id,\s+onboardingCompleted: user.full_name !== null,\s+courseEnrollments: \[\],\s+\}/, userPayload.replace(/user\.id \|\| dbUser\?\.id/g, 'user.id').replace(/user\.institutional_email \|\| dbUser\?\.institutional_email/g, 'user.institutional_email').replace(/user\.full_name \|\| dbUser\?\.full_name/g, 'user.full_name').replace(/user\.role \|\| dbUser\?\.role/g, 'user.role').replace(/user\.institution_id \|\| dbUser\?\.institution_id/g, 'user.institution_id').replace(/typeof courseEnrollments !== 'undefined' \? courseEnrollments : \[\]/g, '[]'));

code = code.replace(/user: \{\s+id: user.id,\s+institutionalEmail: user.institutional_email,\s+role: user.role,\s+institutionId: user.institution_id,\s+onboardingCompleted: user.full_name !== null,\s+courseEnrollments,\s+\}/, userPayload.replace(/user\.id \|\| dbUser\?\.id/g, 'user.id').replace(/user\.institutional_email \|\| dbUser\?\.institutional_email/g, 'user.institutional_email').replace(/user\.full_name \|\| dbUser\?\.full_name/g, 'user.full_name').replace(/user\.role \|\| dbUser\?\.role/g, 'user.role').replace(/user\.institution_id \|\| dbUser\?\.institution_id/g, 'user.institution_id').replace(/typeof courseEnrollments !== 'undefined' \? courseEnrollments : \[\]/g, 'courseEnrollments'));

code = code.replace(/user: \{\s+id: dbUser.id,\s+institutionalEmail: dbUser.institutional_email,\s+role: dbUser.role,\s+institutionId: dbUser.institution_id,\s+onboardingCompleted: dbUser.full_name !== null,\s+courseEnrollments: \[\],\s+\}/, userPayload.replace(/user\.id \|\| dbUser\?\.id/g, 'dbUser.id').replace(/user\.institutional_email \|\| dbUser\?\.institutional_email/g, 'dbUser.institutional_email').replace(/user\.full_name \|\| dbUser\?\.full_name/g, 'dbUser.full_name').replace(/user\.role \|\| dbUser\?\.role/g, 'dbUser.role').replace(/user\.institution_id \|\| dbUser\?\.institution_id/g, 'dbUser.institution_id').replace(/typeof courseEnrollments !== 'undefined' \? courseEnrollments : \[\]/g, '[]'));

fs.writeFileSync(file, code);
console.log('User struct patched successfully');
