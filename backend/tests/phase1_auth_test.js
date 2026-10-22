const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 1 AUTHENTICATION & REGISTRATION VERIFICATION');
  console.log('====================================================\n');

  try {
    const testEmail = 'youssef.student@egsa.gov.eg';
    const testPassword = 'Password123!';

    // 1. Register a fresh university student
    console.log(`[TEST 1] Register new student (${testEmail})...`);
    const regPayload = {
      fullName: 'Youssef Mohamed',
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      division: 'UNIVERSITY',
      phone: '+201012345678',
      university: 'Cairo University',
      faculty: 'Faculty of Engineering',
      graduationYear: 2026,
    };

    const regRes = await req(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(regPayload),
    });

    console.log(`  -> Status code: ${regRes.status}`);
    console.log(`  -> Response message: ${regRes.data?.message}`);
    console.log(`  -> Token issued: ${Boolean(regRes.data?.token || regRes.data?.data?.token)}`);
    console.log(`  -> User Division: ${regRes.data?.data?.user?.division}`);

    if (regRes.status !== 201 && regRes.status !== 409) {
      throw new Error(`Expected 201 or 409, got ${regRes.status}: ${JSON.stringify(regRes.data)}`);
    }

    // 2. Attempt duplicate registration -> confirm clean 409 Conflict with "Email already registered"
    console.log('\n[TEST 2] Attempt duplicate registration with same email...');
    const dupRes = await req(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(regPayload),
    });

    console.log(`  -> Status code: ${dupRes.status}`);
    console.log(`  -> Response message: "${dupRes.data?.message}"`);

    if (dupRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate registration, got ${dupRes.status}`);
    }
    if (dupRes.data?.message !== 'Email already registered') {
      throw new Error(`Expected message 'Email already registered', got '${dupRes.data?.message}'`);
    }
    console.log('  -> Confirmed: Clean 409 Conflict with "Email already registered"');

    // 3. Test validation error (Password < 8 characters)
    console.log('\n[TEST 3] Test validation rejection for short password (< 8 chars)...');
    const invalidRes = await req(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Short Pass Test',
        email: 'shortpass@egsa.gov.eg',
        password: '123',
        confirmPassword: '123',
        division: 'UNIVERSITY',
      }),
    });

    console.log(`  -> Status code: ${invalidRes.status}`);
    console.log(`  -> Error details:`, invalidRes.data?.errors?.[0]?.message || invalidRes.data?.message);
    if (invalidRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for short password, got ${invalidRes.status}`);
    }

    // 4. Test pre-university cadet registration
    console.log('\n[TEST 4] Register pre-university cadet (nour.cadet@egsa.gov.eg)...');
    const cadetEmail = `nour.cadet.${Date.now()}@egsa.gov.eg`;
    const cadetRes = await req(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Nour Khaled',
        email: cadetEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        division: 'PRE_UNIVERSITY',
        phone: '+201098765432',
      }),
    });

    console.log(`  -> Status code: ${cadetRes.status}`);
    console.log(`  -> Registered Division: ${cadetRes.data?.data?.user?.division}`);
    if (cadetRes.status !== 201) {
      throw new Error(`Expected 201 Created for cadet, got ${cadetRes.status}: ${JSON.stringify(cadetRes.data)}`);
    }
    if (cadetRes.data?.data?.user?.division !== 'PRE_UNIVERSITY') {
      throw new Error(`Expected division PRE_UNIVERSITY, got ${cadetRes.data?.data?.user?.division}`);
    }

    // 5. Login with newly created student credentials
    console.log(`\n[TEST 5] Sign In with credentials (${testEmail})...`);
    const loginRes = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    console.log(`  -> Status code: ${loginRes.status}`);
    console.log(`  -> Access Token acquired: ${Boolean(loginRes.data?.data?.token)}`);
    console.log(`  -> User fullName: ${loginRes.data?.data?.user?.fullName}`);
    console.log(`  -> User division: ${loginRes.data?.data?.user?.division}`);
    if (loginRes.status !== 200) {
      throw new Error(`Expected 200 OK for login, got ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }

    // 6. Check /api/auth/me session stability
    console.log('\n[TEST 6] GET /api/auth/me to verify session persistence...');
    const token = loginRes.data?.data?.token;
    const meRes = await req(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`  -> Status code: ${meRes.status}`);
    console.log(`  -> Authenticated User ID: ${meRes.data?.data?.user?._id || meRes.data?.data?._id || meRes.data?.user?._id}`);
    if (meRes.status !== 200) {
      throw new Error(`Expected 200 OK for /api/auth/me, got ${meRes.status}`);
    }

    console.log('\n====================================================');
    console.log('>>> ALL PHASE 1 AUTHENTICATION TESTS PASSED! <<<');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n[TEST FAILURE]:', err.message);
    process.exit(1);
  }
}

runTests();
