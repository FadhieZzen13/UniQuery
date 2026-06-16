const API_BASE_URL = 'http://localhost:4000/api';

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

const formatApiError = (payload: {
  error?: string;
  details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
}) => {
  const fieldErrors = payload.details?.fieldErrors;
  if (fieldErrors) {
    for (const messages of Object.values(fieldErrors)) {
      if (messages?.[0]) return messages[0];
    }
  }
  if (payload.details?.formErrors?.[0]) {
    return payload.details.formErrors[0];
  }
  return payload.error || 'An error occurred';
};

// Generic fetch wrapper with auth headers
const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(formatApiError(error));
  }

  return response.json();
};

// Auth API
export const authApi = {
  register: async (email: string, password: string) => {
    return fetchWithAuth('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        institutionalEmail: email,
        password,
        institutionId: 'a1ef33a4-8de7-4cd8-a7af-693939ed5171',
      }),
    });
  },

  login: async (email: string, password: string) => {
    return fetchWithAuth('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        institutionalEmail: email,
        password,
      }),
    });
  },

  verify: async () => {
    return fetchWithAuth('/v1/me');
  },
};

// Users API
export const usersApi = {
  getCurrentUser: async () => {
    return fetchWithAuth('/users/me');
  },

  completeOnboarding: async (name: string, major: string, year: string, courseId: string) => {
    return fetchWithAuth('/users/onboarding', {
      method: 'POST',
      body: JSON.stringify({ name, major, year, courseId }),
    });
  },

  updateProfile: async (data: { name?: string; major?: string; year?: string }) => {
    return fetchWithAuth('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getUserById: async (id: string) => {
    return fetchWithAuth(`/users/${id}`);
  },
};

// Questions API
export const questionsApi = {
  getAll: async (params?: { category?: string; sort?: string; search?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.sort) searchParams.append('sort', params.sort);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) searchParams.append('offset', params.offset.toString());
    const queryString = searchParams.toString();
    return fetchWithAuth(`/v1/questions${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id: string) => {
    return fetchWithAuth(`/v1/questions/${id}`);
  },

  create: async (data: { title: string; description: string; category: string; tags: string[]; isAnonymous?: boolean }) => {
    return fetchWithAuth('/v1/questions', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title.trim(),
        body: data.description.trim(),
        category: data.category,
        tags: data.tags,
        isAnonymous: data.isAnonymous ?? false,
      }),
    });
  },

  delete: async (id: string) => {
    return fetchWithAuth(`/v1/questions/${id}`, {
      method: 'DELETE',
    });
  },

  resolve: async (id: string) => {
    return fetchWithAuth(`/v1/questions/${id}/resolve`, {
      method: 'PATCH',
    });
  },
};

// Answers API
export const answersApi = {
  getForQuestion: async (questionId: string) => {
    return fetchWithAuth(`/v1/questions/${questionId}/answers`);
  },

  create: async (questionId: string, content: string) => {
    return fetchWithAuth('/v1/answers', {
      method: 'POST',
      body: JSON.stringify({ questionId, body: content }),
    });
  },

  verify: async (answerId: string) => {
    return fetchWithAuth(`/v1/answers/${answerId}/verify`, {
      method: 'PUT',
    });
  },

  accept: async (questionId: string, answerId: string) => {
    return fetchWithAuth(`/v1/questions/${questionId}/accept-answer/${answerId}`, {
      method: 'PATCH',
    });
  },

  delete: async (answerId: string) => {
    return fetchWithAuth(`/v1/answers/${answerId}`, {
      method: 'DELETE',
    });
  },
};

// Votes API
export const votesApi = {
  voteQuestion: async (questionId: string, value: 1 | -1) => {
    return fetchWithAuth(`/v1/votes`, {
      method: 'POST',
      body: JSON.stringify({ targetType: 'QUESTION', targetId: questionId, value }),
    });
  },

  voteAnswer: async (answerId: string, value: 1 | -1) => {
    return fetchWithAuth(`/v1/votes`, {
      method: 'POST',
      body: JSON.stringify({ targetType: 'ANSWER', targetId: answerId, value }),
    });
  },

  removeQuestionVote: async (questionId: string) => {
    return fetchWithAuth(`/v1/votes/QUESTION/${questionId}`, {
      method: 'DELETE',
    });
  },

  removeAnswerVote: async (answerId: string) => {
    return fetchWithAuth(`/v1/votes/ANSWER/${answerId}`, {
      method: 'DELETE',
    });
  },

  getQuestionVoteStatus: async (questionId: string) => {
    return fetchWithAuth(`/v1/votes/question/${questionId}/status`);
  },

  getAnswerVoteStatus: async (answerId: string) => {
    return fetchWithAuth(`/v1/votes/answer/${answerId}/status`);
  },
};

// Notifications API (v1)
export const notificationsApi = {
  getAll: async (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.offset !== undefined) searchParams.append('offset', params.offset.toString());
    const queryString = searchParams.toString();
    return fetchWithAuth(`/v1/notifications${queryString ? `?${queryString}` : ''}`);
  },

  markRead: async (id: string) => {
    return fetchWithAuth(`/v1/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },
};

// Courses API
export const coursesApi = {
  getAvailable: async () => {
    return fetchWithAuth('/v1/courses/available');
  },

  getMine: async () => {
    return fetchWithAuth('/v1/courses/my');
  },
};

// Moderation API
export const moderationApi = {
  getFlags: async (courseId: string) => {
    return fetchWithAuth(`/v1/moderation/flags?course_id=${courseId}`);
  },

  act: async (data: { targetType: 'QUESTION' | 'ANSWER'; targetId: string; action: 'HIDE' | 'LOCK' | 'DELETE' | 'UNHIDE'; justification: string }) => {
    return fetchWithAuth('/v1/moderation/actions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  decrypt: async (markerId: string) => {
    return fetchWithAuth('/v1/moderation/decrypt', {
      method: 'POST',
      body: JSON.stringify({ markerId }),
    });
  },
};

// Admin API
export const adminApi = {
  listInstitutions: async () => {
    return fetchWithAuth('/v1/admin/institutions');
  },

  createInstitution: async (data: { name: string; domain: string }) => {
    return fetchWithAuth('/v1/admin/institutions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listCourses: async (institutionId: string) => {
    return fetchWithAuth(`/v1/admin/courses?institution_id=${institutionId}`);
  },

  createCourse: async (data: { institutionId: string; code: string; title: string; facultyId?: string }) => {
    return fetchWithAuth('/v1/admin/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listEnrollments: async (courseId: string) => {
    return fetchWithAuth(`/v1/admin/enrollments?course_id=${courseId}`);
  },

  createEnrollment: async (data: { courseId: string; userEmail: string; role: 'STUDENT' | 'TA' | 'FACULTY' }) => {
    return fetchWithAuth('/v1/admin/enrollments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteEnrollment: async (enrollmentId: string) => {
    return fetchWithAuth(`/v1/admin/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  },
};
