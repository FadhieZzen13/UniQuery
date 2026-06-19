import {
  authApi,
  usersApi,
  questionsApi,
  answersApi,
  votesApi,
  notificationsApi,
  coursesApi,
  moderationApi,
  adminApi,
} from '@/lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe('api client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  it('attaches bearer token when present', async () => {
    localStorage.setItem('token', 'test-token');
    mockFetch.mockResolvedValueOnce(jsonResponse({ user: { id: '1' } }));

    await authApi.verify();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('throws a friendly message on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    await expect(authApi.login('student@test.edu', 'password')).rejects.toThrow(
      'Unable to connect to the server'
    );
  });

  it('formats field validation errors from the API', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          error: 'Invalid request',
          details: { fieldErrors: { institutionalEmail: ['Email must be a valid university address'] } },
        },
        false,
        400
      )
    );

    await expect(authApi.register('bad@test.com', 'password')).rejects.toThrow(
      'Email must be a valid university address'
    );
  });

  it('uses form-level API errors when field errors are absent', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          error: 'Invalid request',
          details: { formErrors: ['Password is too weak'] },
        },
        false,
        400
      )
    );

    await expect(authApi.login('student@test.edu', 'password')).rejects.toThrow('Password is too weak');
  });

  it('falls back to a generic API error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(authApi.login('student@test.edu', 'password')).rejects.toThrow('An error occurred');
  });

  it('calls auth and user endpoints', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ token: 'abc' }))
      .mockResolvedValueOnce(jsonResponse({ token: 'abc' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'user-1' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ id: 'user-1', name: 'Student' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'user-2' }));

    await authApi.register('student@test.edu', 'password123');
    await authApi.login('student@test.edu', 'password123');
    await usersApi.getCurrentUser();
    await usersApi.completeOnboarding('Student', 'CS', '2026', 'course-1');
    await usersApi.updateProfile({ name: 'Updated' });
    const profile = await usersApi.getUserById('user-2');

    expect(profile.id).toBe('user-2');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/register', expect.objectContaining({ method: 'POST' }));
    expect(mockFetch).toHaveBeenCalledWith('/api/users/me', expect.any(Object));
  });

  it('calls question, answer, vote, and notification endpoints', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await questionsApi.getAll({ category: 'Academic', sort: 'newest', limit: 10, offset: 0 });
    await questionsApi.getById('q1');
    await questionsApi.create({
      title: 'Title',
      description: 'Body',
      category: 'Academic',
      tags: ['cs'],
      isAnonymous: true,
    });
    await questionsApi.delete('q1');
    await questionsApi.resolve('q1');
    await questionsApi.addBookmark('q1');
    await questionsApi.removeBookmark('q1');

    await answersApi.getForQuestion('q1');
    await answersApi.create('q1', 'answer');
    await answersApi.verify('a1');
    await answersApi.accept('q1', 'a1');
    await answersApi.delete('a1');

    await votesApi.voteQuestion('q1', 1);
    await votesApi.voteAnswer('a1', -1);
    await votesApi.removeQuestionVote('q1');
    await votesApi.removeAnswerVote('a1');
    await votesApi.getQuestionVoteStatus('q1');
    await votesApi.getAnswerVoteStatus('a1');

    await notificationsApi.getAll({ limit: 5, offset: 0 });
    await notificationsApi.markRead('n1');

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/votes', expect.objectContaining({ method: 'POST' }));
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/notifications/n1/read', expect.objectContaining({ method: 'PATCH' }));
  });

  it('calls course, moderation, and admin endpoints', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await coursesApi.getAvailable();
    await coursesApi.getMine();

    await moderationApi.createFlag('QUESTION', 'q1');
    await moderationApi.getFlags('course-1');
    await moderationApi.act({
      targetType: 'QUESTION',
      targetId: 'q1',
      action: 'HIDE',
      justification: 'Policy violation here',
    });
    await moderationApi.decrypt('marker-1');

    await adminApi.listInstitutions();
    await adminApi.createInstitution({ name: 'Test U', domain: 'test.edu' });
    await adminApi.listCourses('inst-1');
    await adminApi.createCourse({ institutionId: 'inst-1', code: 'CS101', title: 'Intro' });
    await adminApi.listEnrollments('course-1');
    await adminApi.createEnrollment({ courseId: 'course-1', userEmail: 's@test.edu', role: 'STUDENT' });
    await adminApi.deleteEnrollment('enroll-1');

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/admin/institutions', expect.objectContaining({ method: 'POST' }));
  });
});
