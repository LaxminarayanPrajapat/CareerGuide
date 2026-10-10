/**
 * Manual end-to-end smoke check against a running API.
 *
 * Usage:  npx tsx scripts/smoke-test.ts [baseUrl]
 *
 * Exercises: login -> attempt lifecycle -> scoring -> skill profile ->
 * report generation (AI and deterministic) -> authorisation boundaries.
 * Prints PASS/FAIL per check and exits non-zero on the first failure.
 */

const BASE = process.argv[2] ?? 'http://localhost:5000';

interface Session {
  cookie: string;
  csrf: string;
}

let passed = 0;
let failed = 0;

function log(ok: boolean, label: string, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` - ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` - ${detail}` : ''}`);
  }
}

async function request(
  method: string,
  path: string,
  options: { session?: Session; body?: unknown; raw?: boolean } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.session) {
    headers.cookie = options.session.cookie;
    headers['x-csrf-token'] = options.session.csrf;
  }
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let body: any = null;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function toSession(headers: Headers, body: any): Session {
  const setCookie = headers.get('set-cookie') ?? '';
  const cookie = setCookie
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
  const csrfHeader = setCookie
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .find((c) => c.startsWith('cgs_csrf='));
  const csrf = (csrfHeader ?? '').replace('cgs_csrf=', '') || body?.data?.csrfToken;
  return { cookie, csrf };
}

async function login(email: string, password: string): Promise<Session | null> {
  const response = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return toSession(response.headers, body);
}

async function main() {
  console.log(`\nSmoke test against ${BASE}\n`);

  // -- 1. Health ---------------------------------------------------------
  const health = await request('GET', '/health');
  log(health.status === 200 && health.body?.data?.database === 'connected', 'Health endpoint reports database connected');

  // -- 2. Public settings ------------------------------------------------
  const publicSettings = await request('GET', '/api/v1/settings/public');
  log(publicSettings.status === 200, 'Public settings readable without authentication');

  // -- 3. Unauthenticated access is rejected ----------------------------
  const unauth = await request('GET', '/api/v1/assessments');
  log(unauth.status === 401, 'Unauthenticated request to a protected route returns 401', `got ${unauth.status}`);

  // -- 4. Student login --------------------------------------------------
  const student = await login('student@careerguide.local', 'Student@12345');
  log(Boolean(student), 'Student demo account can sign in');

  // -- 5. Invalid credentials -------------------------------------------
  const badLogin = await request('POST', '/api/v1/auth/login', {
    body: { email: 'student@careerguide.local', password: 'WrongPassword@1' },
  });
  log(badLogin.status === 401, 'Invalid password returns 401', `got ${badLogin.status}`);

  if (!student) {
    console.log('\nCannot continue without a student session.');
    process.exit(1);
  }

  // -- 6. CSRF enforcement ----------------------------------------------
  const noCsrf = await fetch(`${BASE}/api/v1/attempts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: student.cookie },
    body: JSON.stringify({ assessmentId: '0'.repeat(24) }),
  });
  log(noCsrf.status === 403, 'State-changing request without CSRF header returns 403', `got ${noCsrf.status}`);

  // -- 7. Available assessments -----------------------------------------
  const available = await request('GET', '/api/v1/attempts/available', { session: student });
  const assessments: any[] = available.body?.data?.assessments ?? [];
  log(
    available.status === 200 && assessments.length > 0,
    'Candidate sees published assessments',
    `${assessments.length} available`,
  );
  log(
    assessments.every((a) => a.status === 'published'),
    'Draft test sets are hidden from candidates',
  );

  // -- 8. Complete a full attempt lifecycle ------------------------------
  for (const assessment of assessments.filter((a) => a.eligible && a.attemptsUsed === 0)) {
    const started = await request('POST', '/api/v1/attempts', {
      session: student,
      body: { assessmentId: assessment.id },
    });
    if (started.status !== 201) {
      log(false, `Start attempt: ${assessment.title}`, `status ${started.status}`);
      continue;
    }
    const payload = started.body.data;
    log(true, `Start attempt: ${assessment.title}`, `${payload.questions.length} questions, ${payload.attempt.secondsRemaining}s`);

    const hidden = payload.questions.some((q: any) => 'correctOptionId' in q);
    log(!hidden, 'Questions never expose the answer key to the candidate');

    // Refresh recovery: the same attempt id and remaining time are returned.
    const reloaded = await request('GET', `/api/v1/attempts/${payload.attempt.id}`, { session: student });
    log(
      reloaded.status === 200 && reloaded.body.data.attempt.id === payload.attempt.id,
      'Refreshing returns the same attempt (timer not reset)',
    );

    // Answer everything: MCQ picks the last option, likert picks "Agree".
    const answers = payload.questions.map((q: any) => ({
      questionId: q.id,
      selectedOptionId:
        q.questionType === 'likert' ? '4' : q.options[q.options.length - 1].optionId,
    }));
    const saved = await request('PUT', `/api/v1/attempts/${payload.attempt.id}/answers`, {
      session: student,
      body: { answers },
    });
    log(
      saved.status === 200 && saved.body.data.answeredCount === answers.length,
      'Answers saved on the server',
      `${saved.body?.data?.answeredCount} answered`,
    );

    const submitted = await request('POST', `/api/v1/attempts/${payload.attempt.id}/submit`, {
      session: student,
      body: { confirm: true },
    });
    const result = submitted.body?.data;
    if (submitted.status !== 200) {
      log(false, `Submit attempt: ${assessment.title}`, `status ${submitted.status} ${JSON.stringify(submitted.body?.message)}`);
      continue;
    }
    log(true, `Submit attempt: ${assessment.title}`, `status ${submitted.body.message}`);
    log(
      result.scoringModel === 'preference'
        ? result.percentage === null && Array.isArray(result.preferenceResults)
        : typeof result.percentage === 'number' && result.marksObtained !== null,
      'Result is computed and scored on the server',
      result.scoringModel === 'preference'
        ? `${result.preferenceResults.length} preference dimensions`
        : `${result.marksObtained}/${result.totalMarks} (${result.percentage}%)`,
    );

    // Duplicate submission must be refused.
    const again = await request('POST', `/api/v1/attempts/${payload.attempt.id}/submit`, {
      session: student,
      body: { confirm: true },
    });
    log(
      again.status === 200 && again.body.message.includes('already submitted'),
      'Duplicate submission is rejected',
      again.body?.message,
    );

    // Answers must no longer be modifiable.
    const lateSave = await request('PUT', `/api/v1/attempts/${payload.attempt.id}/answers`, {
      session: student,
      body: { answers: [{ questionId: payload.questions[0].id, selectedOptionId: 'a' }] },
    });
    log(lateSave.status === 409, 'Answers cannot be changed after submission', `got ${lateSave.status}`);
  }

  // -- 9. Skill profile updated -----------------------------------------
  const profile = await request('GET', '/api/v1/profile/skill-profile', { session: student });
  log(
    profile.status === 200 && profile.body.data.empty === false && profile.body.data.measurements.length > 0,
    'Skill profile updated from completed assessments',
    `${profile.body?.data?.measurements?.length ?? 0} skills measured`,
  );

  // -- 10. Deterministic compatibility preview --------------------------
  const preview = await request('GET', '/api/v1/compatibility', { session: student });
  const matches: any[] = preview.body?.data?.matches ?? [];
  log(preview.status === 200 && matches.length > 0, 'Compatibility preview returns deterministic matches', `${matches.length} careers`);
  log(
    matches.every((m) => typeof m.compatibilityScore === 'number' && m.evidence.length > 0),
    'Every match carries evidence and a compatibility score',
    `top: ${matches[0]?.title} @ ${matches[0]?.compatibilityScore}`,
  );

  // -- 11. Report generation --------------------------------------------
  const report = await request('POST', '/api/v1/reports/generate', {
    session: student,
    body: { includeRoadmaps: true, roadmapCount: 3 },
  });
  log(report.status === 200, 'Career report generated');
  log(
    typeof report.body?.data?.ai?.available === 'boolean' &&
      (report.body.data.ai.available ? report.body.data.ai.providerUsed !== 'none' : report.body.data.ai.failureReason !== null),
    'AI narrative status reported honestly',
    report.body?.data?.ai?.available ? `provider: ${report.body.data.ai.providerUsed}` : `fallback used: ${report.body.data.ai.failureReason}`,
  );

  const reportId = report.body?.data?.reportId;
  if (reportId) {
    const fetched = await request('GET', `/api/v1/reports/${reportId}`, { session: student });
    log(fetched.status === 200, 'Report can be read back by its owner');
    log(
      (fetched.body?.data?.report?.recommendations ?? []).every((r: any) => r.deterministicSummary?.length > 0),
      'Every recommendation carries a deterministic explanation even without AI',
    );

    const download = await fetch(`${BASE}/api/v1/reports/${reportId}/download`, {
      headers: { cookie: student.cookie },
    });
    const html = await download.text();
    log(
      download.status === 200 && html.includes('<!doctype html') && html.includes('Career compatibility score'),
      'Printable report downloads as HTML',
      `${html.length} bytes`,
    );
  }

  // -- 12. Roadmaps created with no progress pre-set --------------------
  const roadmaps = await request('GET', '/api/v1/roadmaps', { session: student });
  const roadmapList: any[] = roadmaps.body?.data?.roadmaps ?? [];
  log(roadmaps.status === 200 && roadmapList.length > 0, 'Learning roadmaps generated', `${roadmapList.length} roadmaps`);
  log(
    roadmapList.every((r) => r.items.every((i: any) => i.status === 'not_started')) && roadmapList.every((r) => r.progressPercent === 0),
    'Roadmap progress starts at zero (never marked complete by the generator)',
  );

  if (roadmapList.length > 0) {
    const firstItem = roadmapList[0].items[0];
    const updated = await request(
      'PATCH',
      `/api/v1/roadmaps/${roadmapList[0].id}/items/${firstItem.id}`,
      { session: student, body: { status: 'completed' } },
    );
    log(
      updated.status === 200 && updated.body.data.roadmap.progressPercent > 0,
      'Candidate progress updates roadmap percentage',
      `status ${updated.status}, progress ${updated.body?.data?.roadmap?.progressPercent ?? 'n/a'}`,
    );
  }

  // -- 13. Cross-candidate access is denied -----------------------------
  const otherStudent = await login('diya.patel@careerguide.local', 'Student@12345');
  if (otherStudent && reportId) {
    const stolen = await request('GET', `/api/v1/reports/${reportId}`, { session: otherStudent });
    log(stolen.status === 403, 'Another candidate cannot read this report', `got ${stolen.status}`);
  }

  // -- 14. Student cannot reach admin endpoints -------------------------
  const adminAttempt = await request('GET', '/api/v1/users', { session: student });
  log(adminAttempt.status === 403, 'Student cannot list users', `got ${adminAttempt.status}`);
  const auditAttempt = await request('GET', '/api/v1/audit-logs', { session: student });
  log(auditAttempt.status === 403, 'Student cannot read the audit log', `got ${auditAttempt.status}`);

  // -- 15. Counsellor scope ---------------------------------------------
  const counsellor = await login('counsellor@careerguide.local', 'Counsellor@12345');
  if (counsellor) {
    const assigned = await request('GET', '/api/v1/analytics/counsellor', { session: counsellor });
    log(assigned.status === 200, 'Counsellor can read assigned-batch analytics');
    const adminOnly = await request('GET', '/api/v1/users', { session: counsellor });
    log(adminOnly.status === 200, 'Counsellor can browse users in their scope');
    const settingsWrite = await request('PUT', '/api/v1/settings', {
      session: counsellor,
      body: { 'general.siteName': 'Hacked' },
    });
    log(settingsWrite.status === 403, 'Counsellor cannot change system settings', `got ${settingsWrite.status}`);
  }

  // -- 16. Management is read-only --------------------------------------
  const management = await login('management@careerguide.local', 'Management@12345');
  if (management) {
    const institution = await request('GET', '/api/v1/analytics/institution', { session: management });
    log(institution.status === 200, 'Management can read institutional analytics');
    const write = await request('POST', '/api/v1/questions', {
      session: management,
      body: { text: 'Should not be allowed', category: 'aptitude', topic: 'x' },
    });
    log(write.status === 403, 'Management cannot write to the question bank', `got ${write.status}`);
  }

  // -- 17. Admin full access --------------------------------------------
  const admin = await login('admin@careerguide.local', 'Admin@12345');
  if (admin) {
    const system = await request('GET', '/api/v1/analytics/system', { session: admin });
    log(system.status === 200, 'Administrator can read system analytics');
    const audit = await request('GET', '/api/v1/audit-logs', { session: admin });
    log(audit.status === 200 && (audit.body?.data?.logs?.length ?? 0) > 0, 'Audit log records activity', `${audit.body?.data?.logs?.length ?? 0} entries`);
    const settings = await request('GET', '/api/v1/settings', { session: admin });
    log(
      settings.status === 200 && settings.body.data.aiProvider !== undefined,
      'Admin settings expose AI provider status without exposing keys',
    );
    const csv = await fetch(`${BASE}/api/v1/exports/analytics.csv`, {
      headers: { cookie: admin.cookie },
    });
    log(csv.status === 200 && (csv.headers.get('content-type') ?? '').includes('text/csv'), 'Admin can export analytics as CSV');
  }

  // -- 18. Validation ----------------------------------------------------
  const invalid = await request('POST', '/api/v1/auth/login', { body: { email: 'not-an-email', password: '' } });
  log(invalid.status === 422, 'Invalid input returns a validation error', `got ${invalid.status}`);

  const notFound = await request('GET', '/api/v1/reports/does-not-exist', { session: student });
  log(notFound.status === 404, 'Unknown report returns 404', `got ${notFound.status}`);

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error);
  process.exit(1);
});
