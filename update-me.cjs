const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'src', 'routes', 'v1.ts');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /res\.json\(result\.rows\[0\]\);\s*\}\s*catch\s*\(error\)\s*\{\s*console\.error\('Me error:', error\);/,
  `const dbUser = result.rows[0];
      res.json({
        user: {
          id: dbUser.id,
          institutionalEmail: dbUser.institutional_email,
          role: dbUser.role,
          institutionId: dbUser.institution_id,
          onboardingCompleted: dbUser.full_name !== null,
          courseEnrollments: [], // Can query if needed
        }
      });
    } catch (error) {
      console.error('Me error:', error);`
);

fs.writeFileSync(file, code);
console.log('script me completed');
