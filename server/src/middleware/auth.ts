import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../index.js';

export interface AuthContext {
  userId: string;
  role: string;
  institutionId: string;
  courseEnrollments: string[];
  sessionId: string;
}

export interface AuthRequest extends Request {
  auth?: AuthContext;
}

const jwtSecret = process.env.JWT_SECRET;
const sessionFreshnessHours = 24;

const getFingerprint = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (!jwtSecret) {
    return res.status(500).json({ error: 'JWT secret not configured' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as {
      sub: string;
      role: string;
      institution_id: string;
      course_enrollments: string[];
      jti: string;
      exp: number;
    };

    const fingerprint = getFingerprint(token);

    const sessionResult = await pool.query(
      `SELECT session_id, user_id, revoked_at, last_seen_at, expires_at
       FROM sessions
       WHERE session_id = $1 AND user_id = $2 AND jwt_fingerprint = $3`,
      [payload.jti, payload.sub, fingerprint]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    if (session.revoked_at) {
      return res.status(401).json({ error: 'Session revoked' });
    }

    const lastSeenAt = new Date(session.last_seen_at).getTime();
    const freshnessMs = sessionFreshnessHours * 60 * 60 * 1000;
    if (Date.now() - lastSeenAt > freshnessMs) {
      return res.status(401).json({ error: 'Session expired' });
    }

    await pool.query('UPDATE sessions SET last_seen_at = now() WHERE session_id = $1', [session.session_id]);

    req.auth = {
      userId: payload.sub,
      role: payload.role,
      institutionId: payload.institution_id,
      courseEnrollments: payload.course_enrollments || [],
      sessionId: payload.jti,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
};
