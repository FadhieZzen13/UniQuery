require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const query = `
SELECT f.*, im.id as marker_id,
        q.title as question_title,
        q.body as question_body,
        a.body as answer_body
 FROM flags f
 LEFT JOIN questions q ON f.target_type = 'QUESTION' AND f.target_id = q.id
 LEFT JOIN answers a ON f.target_type = 'ANSWER' AND f.target_id = a.id
 LEFT JOIN questions aq ON a.question_id = aq.id
 LEFT JOIN identity_markers im ON im.target_type = f.target_type AND im.target_id = f.target_id
`;

pool.query(query).then(res => {
  console.log(res.rows);
}).catch(err => {
  console.error(err);
}).finally(() => pool.end());
