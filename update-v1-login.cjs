const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'src', 'routes', 'v1.ts');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /password_hash, role,([\r\n]+)\s*failed_login_count, locked_until/,
  'password_hash, role,$1           failed_login_count, locked_until, full_name'
);

fs.writeFileSync(file, code);
console.log('script completed');