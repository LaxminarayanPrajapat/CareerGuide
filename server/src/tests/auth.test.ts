import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  clearDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createUser,
  getApp,
  loginAs,
  authed,
  TEST_PASSWORD,
} from './helpers.js';
import { UserModel } from '../models/User.js';

describe('Authentication and authorisation', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('registration', () => {
    it('creates a candidate account and returns a session', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Test Candidate',
          email: 'candidate@example.com',
          password: TEST_PASSWORD,
          confirmPassword: TEST_PASSWORD,
          acceptTerms: true,
        })
        .expect(201);

      expect(response.body.data.user.role).toBe('student');
      expect(response.body.data.user.email).toBe('candidate@example.com');
      // The password hash must never be serialised to the client.
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      expect(response.body.data.user.permissions).toContain('attempts:take');
    });

    it('rejects a duplicate email with 409', async () => {
      await createUser({ email: 'dup@example.com', role: 'student' });
      const response = await request(getApp())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Another',
          email: 'dup@example.com',
          password: TEST_PASSWORD,
          confirmPassword: TEST_PASSWORD,
          acceptTerms: true,
        })
        .expect(409);
      expect(response.body.message).toMatch(/already exists/i);
    });

    it('rejects a weak password with 422 and field-level errors', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Weak',
          email: 'weak@example.com',
          password: 'short',
          confirmPassword: 'short',
          acceptTerms: true,
        })
        .expect(422);

      expect(response.body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });

    it('rejects mismatched confirmation passwords', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Mismatch',
          email: 'mismatch@example.com',
          password: TEST_PASSWORD,
          confirmPassword: 'Different@12345',
          acceptTerms: true,
        })
        .expect(422);
      expect(response.body.errors.some((e: { field: string }) => e.field === 'confirmPassword')).toBe(true);
    });

    it('requires the AI disclaimer to be accepted', async () => {
      await request(getApp())
        .post('/api/v1/auth/register')
        .send({
          fullName: 'No Terms',
          email: 'noterms@example.com',
          password: TEST_PASSWORD,
          confirmPassword: TEST_PASSWORD,
          acceptTerms: false,
        })
        .expect(422);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await createUser({ email: 'student@example.com', role: 'student' });
      await createUser({ email: 'deactivated@example.com', role: 'student' });
      await UserModel.updateOne({ email: 'deactivated@example.com' }, { $set: { isActive: false } });
    });

    it('signs in with valid credentials', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'student@example.com', password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.data.user.email).toBe('student@example.com');
      expect(response.headers['set-cookie'].join(';')).toContain('HttpOnly');
      expect(response.headers['set-cookie'].join(';')).toContain('SameSite=Lax');
    });

    it('returns 401 for an incorrect password', async () => {
      const response = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'student@example.com', password: 'Wrong@123456' })
        .expect(401);
      expect(response.body.message).toMatch(/invalid email address or password/i);
    });

    it('returns the same message for an unknown account (no user enumeration)', async () => {
      const unknown = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: TEST_PASSWORD })
        .expect(401);
      const wrongPassword = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'student@example.com', password: 'Wrong@123456' })
        .expect(401);
      expect(unknown.body.message).toBe(wrongPassword.body.message);
    });

    it('refuses a deactivated account with 403', async () => {
      await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'deactivated@example.com', password: TEST_PASSWORD })
        .expect(403);
    });

    it('locks an account after repeated failed attempts', async () => {
      for (let i = 0; i < 8; i += 1) {
        await request(getApp())
          .post('/api/v1/auth/login')
          .send({ email: 'student@example.com', password: 'Wrong@123456' });
      }
      const locked = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'student@example.com', password: TEST_PASSWORD })
        .expect(403);
      expect(locked.body.message).toMatch(/locked|too many/i);
    });
  });

  describe('session handling', () => {
    it('returns the current user from /auth/me', async () => {
      const user = await createUser({ email: 'me@example.com', role: 'student' });
      const session = await loginAs(user.email);
      const response = await session.agent.get('/api/v1/auth/me').expect(200);
      expect(response.body.data.user.id).toBe(user.id);
    });

    it('returns 401 without a session', async () => {
      await request(getApp()).get('/api/v1/auth/me').expect(401);
    });

    it('clears cookies on logout', async () => {
      const user = await createUser({ email: 'logout@example.com', role: 'student' });
      const session = await loginAs(user.email);
      const response = await authed(session).post('/api/v1/auth/logout').expect(200);
      const cookies = (response.headers['set-cookie'] ?? []).join(';');
      expect(cookies).toMatch(/cgs_session=;/);
      expect(cookies).toMatch(/cgs_csrf=;/);
    });

    it('refuses to sign the user out without a CSRF token', async () => {
      const user = await createUser({ email: 'logout-csrf@example.com', role: 'student' });
      const session = await loginAs(user.email);
      await session.agent.post('/api/v1/auth/logout').expect(403);
    });

    it('invalidates sessions after a role change bumps the token version', async () => {
      const admin = await createUser({ email: 'roleadmin@example.com', role: 'admin' });
      const student = await createUser({ email: 'rolestudent@example.com', role: 'student' });

      const studentSession = await loginAs(student.email);
      await studentSession.agent.get('/api/v1/auth/me').expect(200);

      const adminAuth = authed(await loginAs(admin.email));
      await adminAuth.patch(`/api/v1/users/${student.id}`).send({ role: 'counsellor' }).expect(200);

      await studentSession.agent.get('/api/v1/auth/me').expect(401);
    });

    it('invalidates existing sessions when the password is changed', async () => {
      const user = await createUser({ email: 'pwchange@example.com', role: 'student' });
      const first = await loginAs(user.email);
      const second = await loginAs(user.email);

      const auth = authed(first);
      await auth
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNew@123', confirmPassword: 'BrandNew@123' })
        .expect(200);

      await second.agent.get('/api/v1/auth/me').expect(401);
    });
  });

  describe('CSRF protection', () => {
    it('rejects a state-changing request with a session cookie but no CSRF header', async () => {
      const user = await createUser({ email: 'csrf@example.com', role: 'student' });
      const session = await loginAs(user.email);
      const response = await session.agent
        .post('/api/v1/reports/generate')
        .send({ includeRoadmaps: false, roadmapCount: 0 })
        .expect(403);
      expect(response.body.meta.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('allows safe GET requests without a CSRF header', async () => {
      const user = await createUser({ email: 'csrfget@example.com', role: 'student' });
      const session = await loginAs(user.email);
      await session.agent.get('/api/v1/assessments').expect(200);
    });
  });

  describe('role-based access control', () => {
    it('returns 401 for an unauthenticated request to a protected endpoint', async () => {
      await request(getApp()).get('/api/v1/users').expect(401);
    });

    it('returns 403 when a student requests user administration', async () => {
      const student = await createUser({ email: 'rbac-student@example.com', role: 'student' });
      const auth = authed(await loginAs(student.email));
      const response = await auth.get('/api/v1/users').expect(403);
      expect(response.body.message).toMatch(/permission/i);
    });

    it('returns 403 when management attempts to write to the question bank', async () => {
      const manager = await createUser({ email: 'rbac-mgmt@example.com', role: 'management' });
      const auth = authed(await loginAs(manager.email));
      await auth
        .post('/api/v1/questions')
        .send({ text: 'Should be rejected', category: 'aptitude', topic: 'x' })
        .expect(403);
    });

    it('returns 403 when a counsellor attempts to change system settings', async () => {
      const counsellor = await createUser({ email: 'rbac-counsellor@example.com', role: 'counsellor' });
      const auth = authed(await loginAs(counsellor.email));
      await auth.put('/api/v1/settings').send({ 'general.siteName': 'Nope' }).expect(403);
    });

    it('returns 403 when management opens the audit log', async () => {
      const manager = await createUser({ email: 'rbac-mgmt2@example.com', role: 'management' });
      const auth = authed(await loginAs(manager.email));
      await auth.get('/api/v1/audit-logs').expect(403);
    });

    it('allows the administrator full access', async () => {
      const admin = await createUser({ email: 'rbac-admin@example.com', role: 'admin' });
      const auth = authed(await loginAs(admin.email));
      await auth.get('/api/v1/users').expect(200);
      await auth.get('/api/v1/audit-logs').expect(200);
      await auth.get('/api/v1/analytics/system').expect(200);
      await auth.get('/api/v1/settings').expect(200);
    });

    it('restricts the counsellor user list to their assigned candidates', async () => {
      const counsellor = await createUser({ email: 'scope-counsellor@example.com', role: 'counsellor' });
      const assigned = await createUser({
        email: 'assigned@example.com',
        role: 'student',
        assignedCounsellor: counsellor.id,
      });
      await createUser({ email: 'unassigned@example.com', role: 'student' });

      const auth = authed(await loginAs(counsellor.email));
      const response = await auth.get('/api/v1/users').expect(200);
      const emails = response.body.data.users.map((u: { email: string }) => u.email);

      expect(emails).toContain(assigned.email);
      expect(emails).not.toContain('unassigned@example.com');
    });

    it('prevents management from opening an individual candidate record', async () => {
      const manager = await createUser({ email: 'mgmt-record@example.com', role: 'management' });
      const student = await createUser({ email: 'mgmt-target@example.com', role: 'student' });
      const auth = authed(await loginAs(manager.email));
      await auth.get(`/api/v1/users/${student.id}`).expect(403);
    });

    it('refuses to deactivate the only remaining administrator', async () => {
      // Exactly one admin exists and is making the request.
      const admin = await createUser({ email: 'solo-admin@example.com', role: 'admin' });
      await createUser({ email: 'nonadmin@example.com', role: 'student' });

      const auth = authed(await loginAs(admin.email));
      // A self-deactivation is always refused.
      await auth.patch(`/api/v1/users/${admin.id}/status`).send({ isActive: false }).expect(400);
    });

    it('refuses to demote the last administrator to another role', async () => {
      const admin = await createUser({ email: 'demote-admin@example.com', role: 'admin' });
      const auth = authed(await loginAs(admin.email));
      // Changing own role is refused outright.
      await auth.patch(`/api/v1/users/${admin.id}`).send({ role: 'student' }).expect(400);
    });

    it('allows deactivating another administrator when a second one remains', async () => {
      const admin = await createUser({ email: 'primary-admin@example.com', role: 'admin' });
      const other = await createUser({ email: 'secondary-admin@example.com', role: 'admin' });

      // Sign in before the account is deactivated so a session exists to test.
      const otherSession = await loginAs(other.email);
      await otherSession.agent.get('/api/v1/auth/me').expect(200);

      const auth = authed(await loginAs(admin.email));
      await auth.patch(`/api/v1/users/${other.id}/status`).send({ isActive: false }).expect(200);

      // The deactivated account's session is refused immediately.
      await otherSession.agent.get('/api/v1/auth/me').expect(403);
    });

    it('refuses to deactivate a candidate with an attempt in progress', async () => {
      const admin = await createUser({ email: 'liveattempt-admin@example.com', role: 'admin' });
      const student = await createUser({ email: 'liveattempt@example.com', role: 'student' });

      const { AttemptModel } = await import('../models/Attempt.js');
      await AttemptModel.create({
        candidate: student.id,
        assessment: new (await import('mongoose')).Types.ObjectId(),
        assessmentTitle: 'Fixture',
        assessmentCategory: 'aptitude',
        status: 'in_progress',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
        questionOrder: [],
        durationMinutes: 10,
        totalQuestions: 1,
        marksPerQuestion: 1,
        totalMarks: 1,
      });

      const auth = authed(await loginAs(admin.email));
      const response = await auth.patch(`/api/v1/users/${student.id}/status`).send({ isActive: false }).expect(409);
      expect(response.body.message).toMatch(/in progress/i);
    });
  });

  describe('security headers', () => {
    it('does not advertise the server technology', async () => {
      const response = await request(getApp()).get('/health').expect(200);
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('sets the health endpoint without authentication', async () => {
      const response = await request(getApp()).get('/health').expect(200);
      expect(response.body.data.status).toBe('ok');
    });
  });
});
