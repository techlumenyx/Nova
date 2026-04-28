/**
 * End-to-end flow test: signup → login → setupProfile → startSession → sendMessage
 * Run with: node tools/test-flow.mjs
 */

const AUTH    = 'http://localhost:4001/graphql';
const PROFILE = 'http://localhost:4002/graphql';
const CHAT    = 'http://localhost:4004/graphql';

const TEST_EMAIL = `test_${Date.now()}@nova.com`;
const USER_NAME  = 'Test Patient';

async function gql(url, query, variables = {}, headers = {}) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(' | '));
  return json.data;
}

async function step(label, fn) {
  process.stdout.write(`\n[${label}] `);
  try {
    const result = await fn();
    console.log('✅', JSON.stringify(result));
    return result;
  } catch (err) {
    console.log('❌', err.message);
    process.exit(1);
  }
}

// ── 1. Signup ────────────────────────────────────────────────────────────────
await step('signup', () =>
  gql(AUTH, `mutation {
    signup(input: { name: "${USER_NAME}", target: "${TEST_EMAIL}", targetType: EMAIL }) {
      success message
    }
  }`)
);

// ── 2. Verify OTP (master OTP 1234) ─────────────────────────────────────────
const { verifyOTP } = await step('verifyOTP', () =>
  gql(AUTH, `mutation {
    verifyOTP(target: "${TEST_EMAIL}", targetType: EMAIL, otp: "1234") {
      accessToken
      user { id name }
    }
  }`)
);

const TOKEN   = verifyOTP.accessToken;
const USER_ID = verifyOTP.user.id;
const authHeader = { Authorization: `Bearer ${TOKEN}`, 'x-user-id': USER_ID };

// ── 3. Setup profile ─────────────────────────────────────────────────────────
await step('setupProfile', () =>
  gql(PROFILE, `mutation {
    setupProfile(input: {
      dateOfBirth: "1995-06-15"
      gender: MALE
      heightValue: 175
      heightUnit: CM
      weightValue: 70
      weightUnit: KG
      city: "Mumbai"
      language: EN
    }) {
      id isComplete bmi
    }
  }`, {}, { 'x-user-id': USER_ID })
);

// ── 4. Build x-user-profile header (simulating coprocessor) ─────────────────
const profile = JSON.stringify({
  name: USER_NAME, age: 30, sex: 'MALE',
  language: 'EN', city: 'Mumbai',
  heightCm: 175, weightKg: 70, bmi: 22.9,
  conditions: [], medications: [], allergies: null,
});
const chatHeaders = { 'x-user-id': USER_ID, 'x-user-profile': profile };

// ── 5. Start chat session ────────────────────────────────────────────────────
const { startSession } = await step('startSession', () =>
  gql(CHAT, `mutation {
    startSession {
      ... on DiagnosisSession { id stage status questionCount }
      ... on ProfileIncompleteError { message missingFields }
    }
  }`, {}, chatHeaders)
);

const SESSION_ID = startSession.id;
console.log(`    → sessionId: ${SESSION_ID}, stage: ${startSession.stage}`);

// ── 6. Wait for background stages (2–4) ──────────────────────────────────────
console.log('\n[background] Waiting 3s for stages 2–4...');
await new Promise(r => setTimeout(r, 3000));

// ── 7. Send first message ────────────────────────────────────────────────────
await step('sendMessage #1', () =>
  gql(CHAT, `mutation {
    sendMessage(sessionId: "${SESSION_ID}", message: "I have a high fever and severe headache since 2 days") {
      accepted sessionId
    }
  }`, {}, chatHeaders)
);

// ── 8. Wait for async pipeline response via subscription (or just poll session) ─
console.log('\n[wait] Waiting 5s for pipeline to respond...');
await new Promise(r => setTimeout(r, 5000));

// ── 9. Check session state ───────────────────────────────────────────────────
const { session } = await step('session (check state)', () =>
  gql(CHAT, `query {
    session(id: "${SESSION_ID}") {
      stage status questionCount
    }
  }`, {}, chatHeaders)
);

console.log(`\n    Stage: ${session.stage} | Status: ${session.status} | Questions: ${session.questionCount}`);
