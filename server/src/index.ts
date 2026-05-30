import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import questionsRoutes from './routes/questions.js';
import answersRoutes from './routes/answers.js';
import votesRoutes from './routes/votes.js';
import v1Routes from './routes/v1.js';
import { startDigestCron } from './services/digest-cron.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// PostgreSQL connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connected successfully');
  }
});

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:5173', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081'],
  credentials: true
}));
app.use(express.json());

// --- Example route ---
app.get('/', (req, res) => {
  res.send('Campus Connect API is running');
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/answers', answersRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/v1', v1Routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

if (process.env.ENABLE_DIGEST_CRON === 'true') {
  startDigestCron();
}
