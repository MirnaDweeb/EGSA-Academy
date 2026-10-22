const http = require('http');
const assert = require('assert');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runPhase11CertificateIntegrationTest() {
  console.log('========================================================================');
  console.log(' EgSA Academy — Phase 11: 4-Gate Verification, QR Credential & Public Verification Test');
  console.log(' Target Document Alignment: EgSA Specification Sections 4, 10.1, 12, 17 & 18');
  console.log('========================================================================\n');

  const studentEmail = 'youssef.student@egsa.gov.eg';
  const studentPassword = 'Password123!';

  // Step 1: Login as Student
  console.log(`1. Authenticating as Student (${studentEmail})...`);
  const loginRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({ email: studentEmail, password: studentPassword })
  );

  assert.strictEqual(loginRes.status, 200, `Login failed: ${loginRes.raw}`);
  const studentToken = loginRes.data?.data?.token || loginRes.data?.token;
  assert(studentToken, 'Missing student JWT token');
  console.log('   ✓ Student authenticated successfully.\n');

  // Step 2: Retrieve target enrollment for CubeSat Telemetry
  console.log('2. Fetching student enrollments to identify target cohort...');
  const enrRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/enrollments/my',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.strictEqual(enrRes.status, 200, `Enrollments fetch failed: ${enrRes.raw}`);
  const enrollments = enrRes.data?.data || enrRes.data || [];
  assert(enrollments.length > 0, `No active enrollment found for ${studentEmail}`);

  const targetEnrollment = enrollments[0];
  const targetCohortId = targetEnrollment.cohort?._id || targetEnrollment.cohort;
  const targetCourseTitle = targetEnrollment.course?.title || 'CubeSat Telemetry & Ground Stations';
  assert(targetCohortId, 'Missing enrollment cohort ID');
  console.log(`   ✓ Located target enrollment: "${targetCourseTitle}" (Cohort: ${targetCohortId})\n`);

  // Step 3: Check 4-Gate Eligibility Status
  console.log(`3. Evaluating 4 Strict Eligibility Gates via GET /api/certificates/eligibility/${targetCohortId}...`);
  const eligRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/certificates/eligibility/${targetCohortId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  assert.strictEqual(eligRes.status, 200, `Eligibility check failed: ${eligRes.raw}`);
  const eligData = eligRes.data?.data || eligRes.data;
  assert(eligData, 'Missing eligibility data in response');

  console.log('   Evaluating Gate 1 (Attendance Health >= 85%)...');
  assert.strictEqual(eligData.gates?.attendance?.passed, true, `Gate 1 failed: ${eligData.gates?.attendance?.reason}`);
  console.log(`     ✓ Gate 1 Passed: Current attendance ${eligData.gates?.attendance?.current}% >= 85% requirement.`);

  console.log('   Evaluating Gate 2 (Mandatory Technical Assessments Passed)...');
  assert.strictEqual(eligData.gates?.assessments?.passed, true, `Gate 2 failed: ${JSON.stringify(eligData.gates?.assessments?.reasons)}`);
  console.log(`     ✓ Gate 2 Passed: ${eligData.gates?.assessments?.mandatoryCount} mandatory assessments completed & graded.`);

  console.log('   Evaluating Gate 3 (Tuition Settlement Paid)...');
  assert.strictEqual(eligData.gates?.payment?.passed, true, `Gate 3 failed: ${eligData.gates?.payment?.reason}`);
  console.log(`     ✓ Gate 3 Passed: Payment status "${eligData.gates?.payment?.status}".`);

  console.log('   Evaluating Gate 4 (Phase 10 Quality Survey Submitted)...');
  assert.strictEqual(eligData.gates?.evaluation?.passed, true, `Gate 4 failed: ${eligData.gates?.evaluation?.reason}`);
  console.log('     ✓ Gate 4 Passed: Course & Instructor Evaluation completed.');

  assert.strictEqual(eligData.allGatesPassed, true, 'allGatesPassed must be true');
  console.log('   ✓ All 4 Strict Eligibility Gates Satisfied.\n');

  // Step 4: Issue Official Tamper-Proof Certificate
  console.log(`4. Issuing official certificate via POST /api/certificates/issue/${targetCohortId}...`);
  const recipientName = 'Youssef Mohamed Ahmed';
  const issueRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/certificates/issue/${targetCohortId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ recipientName })
  );

  assert(
    issueRes.status === 200 || issueRes.status === 201,
    `Certificate issuance failed (${issueRes.status}): ${issueRes.raw}`
  );

  const certData = issueRes.data?.certificate || issueRes.data?.data || issueRes.data;
  assert(certData, 'Missing certificate object in issuance response');

  const serial = certData.certificateNumber || certData.certificateId;
  console.log(`   ✓ Certificate issued with Serial: ${serial}`);
  assert(serial, 'Missing certificate serial number');
  assert(
    serial.startsWith('EGSA-CERT-2026-'),
    `Serial "${serial}" does not conform to EGSA-CERT-2026-[HEX] specification`
  );

  // Validate QR Code Data URL
  assert(certData.qrCodeDataUrl, 'Missing QR code data URL');
  assert(
    certData.qrCodeDataUrl.startsWith('data:image/png;base64,'),
    'qrCodeDataUrl must be a base64 PNG data URL'
  );
  console.log('   ✓ Dynamic QR Code base64 data URL generated.');

  // Validate Verification URL
  assert(certData.verificationUrl, 'Missing verification URL');
  assert(
    certData.verificationUrl.includes(`/verify-certificate/${serial}`),
    `Verification URL (${certData.verificationUrl}) must point to /verify-certificate/${serial}`
  );
  console.log(`   ✓ Verification URL: ${certData.verificationUrl}`);

  // Validate Cryptographic Signature
  assert(certData.cryptographicSignature, 'Missing cryptographic SHA-256 signature');
  assert.strictEqual(
    certData.cryptographicSignature.length,
    64,
    'Cryptographic signature must be a 64-character SHA-256 hex string'
  );
  console.log(`   ✓ Cryptographic Signature: ${certData.cryptographicSignature.slice(0, 24)}...`);
  console.log('   ✓ Official Certificate Issuance verified.\n');

  // Step 5: Duplicate Issuance Idempotency Test
  console.log('5. Testing duplicate certificate issuance (idempotency)...');
  const duplicateRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/certificates/issue/${targetCohortId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
    },
    JSON.stringify({ recipientName: 'Different Name Attempt' })
  );

  assert.strictEqual(duplicateRes.status, 200, `Duplicate call failed: ${duplicateRes.raw}`);
  assert.strictEqual(duplicateRes.data?.alreadyIssued, true, 'alreadyIssued must be true on duplicate request');

  const dupCert = duplicateRes.data?.certificate || duplicateRes.data?.data;
  const dupSerial = dupCert?.certificateNumber || dupCert?.certificateId;
  assert.strictEqual(dupSerial, serial, 'Duplicate call must return existing certificate without creating duplicate');
  console.log(`   ✓ Idempotency verified: Returned existing certificate ${dupSerial} without duplication.\n`);

  // Step 6: Public Verification Endpoint Without Auth Headers
  console.log(`6. Querying Public Verification endpoint WITHOUT auth headers: GET /api/certificates/verify/${serial}...`);
  const publicVerifyRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/certificates/verify/${encodeURIComponent(serial)}`,
    method: 'GET',
    // NO Authorization header sent!
  });

  assert.strictEqual(
    publicVerifyRes.status,
    200,
    `Public verification endpoint failed without auth headers (${publicVerifyRes.status}): ${publicVerifyRes.raw}`
  );

  const pubPayload = publicVerifyRes.data?.data || publicVerifyRes.data;
  assert(pubPayload, 'Missing public verification payload');
  assert.strictEqual(pubPayload.isValid, true, 'Public verification payload isValid must be true');
  assert.strictEqual(pubPayload.status, 'Valid', 'Public verification status must be "Valid"');
  assert.strictEqual(pubPayload.certificateNumber, serial, 'Public verification certificateNumber mismatch');
  assert.strictEqual(pubPayload.recipientName, recipientName, 'Public verification recipientName mismatch');
  assert(pubPayload.courseTitle, 'Public verification courseTitle missing');
  assert.strictEqual(
    pubPayload.issuingAuthority,
    'Egyptian Space Agency',
    'issuingAuthority must be "Egyptian Space Agency"'
  );
  assert(pubPayload.cryptographicSignature, 'Public verification cryptographicSignature missing');
  console.log('   ✓ Public verification returned 200 OK without JWT auth.');
  console.log(`     - Credential Status: ${pubPayload.status}`);
  console.log(`     - Recipient: ${pubPayload.recipientName}`);
  console.log(`     - Course: ${pubPayload.courseTitle}`);
  console.log(`     - Authority: ${pubPayload.issuingAuthority}`);
  console.log(`     - Signature Digest: ${pubPayload.cryptographicSignature.slice(0, 24)}...\n`);

  // Step 7: Public Shortcut Route Alias
  console.log(`7. Querying Public Shortcut Route alias: GET /api/verify-certificate/${serial}...`);
  const shortcutRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/verify-certificate/${encodeURIComponent(serial)}`,
    method: 'GET',
  });

  assert.strictEqual(shortcutRes.status, 200, `Public shortcut route failed: ${shortcutRes.raw}`);
  const shortcutData = shortcutRes.data?.data || shortcutRes.data;
  assert.strictEqual(shortcutData.isValid, true);
  console.log('   ✓ Public shortcut route verified.\n');

  // Step 8: Invalid Serial Public Verification (Negative Test)
  console.log('8. Testing invalid serial code public verification (Negative Test)...');
  const invalidRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/certificates/verify/EGSA-CERT-2026-NONEXISTENT',
    method: 'GET',
  });

  assert.strictEqual(invalidRes.status, 404, `Expected 404 for nonexistent certificate, got: ${invalidRes.status}`);
  console.log('   ✓ Non-existent certificate returned 404 Not Found as expected.\n');

  console.log('========================================================================');
  console.log(' 🎉 Phase 11 Integration Tests PASSED 100%!');
  console.log('    - 4 Strict Eligibility Gates evaluated');
  console.log('    - Tamper-proof serial EGSA-CERT-2026-[HEX] generated');
  console.log('    - Base64 QR code & cryptographic hash embedded');
  console.log('    - Duplicate issuance idempotency verified');
  console.log('    - Public unauthenticated verification portal verified');
  console.log('========================================================================\n');
}

runPhase11CertificateIntegrationTest().catch((err) => {
  console.error('\n❌ Phase 11 Integration Test FAILED:');
  console.error(err);
  process.exit(1);
});
