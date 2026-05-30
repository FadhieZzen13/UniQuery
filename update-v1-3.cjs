const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'src', 'routes', 'v1.ts');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /SELECT id, institution_id, institutional_email, password_hash, role,[\s\r\n]*failed_login_count, locked_until/,
  "SELECT id, institution_id, institutional_email, password_hash, role, full_name, failed_login_count, locked_until"
);

fs.writeFileSync(file, code);
console.log('script 3 completed');
