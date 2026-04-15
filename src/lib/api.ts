const API_BASE_URL = 'http://localhost:4000/api';

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
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
    throw new Error(error.error || 'An error occurred');
  }

  return response.json();
};

// Auth API
export const authApi = {
  register: async (email: string, password: string) => {
    return fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  login: async (email: string, password: string) => {
    return fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  verify: async () => {
    return fetchWithAuth('/auth/verify');
  },
};

// Users API
export const usersApi = {
  getCurrentUser: async () => {
    return fetchWithAuth('/users/me');
  },

  completeOnboarding: async (name: string, major: string, year: string) => {
    return fetchWithAuth('/users/onboarding', {
      method: 'POST',
      body: JSON.stringify({ name, major, year }),
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
    return fetchWithAuth(`/questions${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id: string) => {
    return fetchWithAuth(`/questions/${id}`);
  },

  create: async (data: { title: string; description: string; category: string; tags: string[] }) => {
    return fetchWithAuth('/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return fetchWithAuth(`/questions/${id}`, {
      method: 'DELETE',
    });
  },

  resolve: async (id: string) => {
    return fetchWithAuth(`/questions/${id}/resolve`, {
      method: 'PUT',
    });
  },
};

// Answers API
export const answersApi = {
  getForQuestion: async (questionId: string) => {
    return fetchWithAuth(`/answers/question/${questionId}`);
  },

  create: async (questionId: string, content: string) => {
    return fetchWithAuth('/answers', {
      method: 'POST',
      body: JSON.stringify({ questionId, content }),
    });
  },

  verify: async (answerId: string) => {
    return fetchWithAuth(`/answers/${answerId}/verify`, {
      method: 'PUT',
    });
  },

  delete: async (answerId: string) => {
    return fetchWithAuth(`/answers/${answerId}`, {
      method: 'DELETE',
    });
  },
};

// Votes API
export const votesApi = {
  voteQuestion: async (questionId: string, value: 1 | -1) => {
    return fetchWithAuth(`/votes/question/${questionId}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  },

  voteAnswer: async (answerId: string, value: 1 | -1) => {
    return fetchWithAuth(`/votes/answer/${answerId}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  },

  getQuestionVoteStatus: async (questionId: string) => {
    return fetchWithAuth(`/votes/question/${questionId}/status`);
  },

  getAnswerVoteStatus: async (answerId: string) => {
    return fetchWithAuth(`/votes/answer/${answerId}/status`);
  },
};
