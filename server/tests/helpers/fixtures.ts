export const USER_ID = '00000000-0000-4000-8000-000000000001';
export const OTHER_USER_ID = '00000000-0000-4000-8000-000000000099';
export const FACULTY_ID = '00000000-0000-4000-8000-000000000002';
export const ADMIN_ID = '00000000-0000-4000-8000-000000000003';
export const INSTITUTION_ID = '00000000-0000-4000-8000-000000000010';
export const COURSE_ID = '00000000-0000-4000-8000-000000000020';
export const QUESTION_ID = '00000000-0000-4000-8000-000000000030';
export const ANSWER_ID = '00000000-0000-4000-8000-000000000040';
export const FLAG_TARGET_ID = '00000000-0000-4000-8000-000000000050';
export const NOTIFICATION_ID = '00000000-0000-4000-8000-000000000060';
export const MARKER_ID = '00000000-0000-4000-8000-000000000070';
export const ENROLLMENT_ID = '00000000-0000-4000-8000-000000000080';

export const studentAuth = {
  userId: USER_ID,
  role: 'STUDENT',
  institutionId: INSTITUTION_ID,
  courseEnrollments: [COURSE_ID],
  sessionId: 'session-student',
};

export const facultyAuth = {
  userId: FACULTY_ID,
  role: 'FACULTY',
  institutionId: INSTITUTION_ID,
  courseEnrollments: [COURSE_ID],
  sessionId: 'session-faculty',
};

export const adminAuth = {
  userId: ADMIN_ID,
  role: 'ADMIN',
  institutionId: INSTITUTION_ID,
  courseEnrollments: [],
  sessionId: 'session-admin',
};
