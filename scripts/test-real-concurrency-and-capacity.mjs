import pg from 'pg';
import fs from 'fs';
import { randomUUID } from 'crypto';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const password = env.SUPABASE_DB_PASSWORD;
const projectRef = 'ctnzfssmhplsmoqhppsx';
const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runRealConcurrencyAndCapacityTests() {
  console.log('========================================================================');
  console.log('CROSSWIRE: Live PostgreSQL Concurrency, Dynamic Capacity & RLS Test');
  console.log('========================================================================\n');

  const mainClient = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await mainClient.connect();
  console.log('Connected to live Supabase PostgreSQL database.');

  const roomId = randomUUID();
  const hostUserId = randomUUID();
  const roomCode = 'conc-' + Math.floor(Math.random() * 900 + 100);

  async function setSessionAuthUser(client, uid) {
    const claims = JSON.stringify({ sub: uid, role: 'authenticated' });
    await client.query(`SELECT set_config('request.jwt.claims', $1, false);`, [claims]);
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [uid]);
  }

  try {
    // 1. Create Room with max_capacity = 3
    console.log('\n--- 1. Room Creation with Configured Capacity (3) ---');
    await mainClient.query(
      `INSERT INTO public.rooms (id, code, creator_id, max_capacity, admission_mode, is_active, participant_count)
       VALUES ($1, $2, $3, 3, 'auto_approve', TRUE, 0);`,
      [roomId, roomCode, hostUserId]
    );

    const roomCheck = await mainClient.query('SELECT * FROM public.rooms WHERE id = $1', [roomId]);
    assert(roomCheck.rows.length === 1, 'Room successfully inserted into live database');
    assert(roomCheck.rows[0].max_capacity === 3, 'Room capacity is 3');
    assert(roomCheck.rows[0].admission_mode === 'auto_approve', 'Admission mode is auto_approve');

    // 2. Host joins as Participant 1
    console.log('\n--- 2. Host Joins Room ---');
    await mainClient.query(
      `INSERT INTO public.participants (id, room_id, user_id, display_name, language_code, language_name, is_connected)
       VALUES ($1, $2, $3, 'Host User', 'en', 'English', TRUE);`,
      [randomUUID(), roomId, hostUserId]
    );

    const afterHost = await mainClient.query('SELECT participant_count FROM public.rooms WHERE id = $1', [roomId]);
    assert(afterHost.rows[0].participant_count === 1, 'Participant count updated to 1 via trigger');

    // 3. Test High-Concurrency Admission (5 simultaneous clients racing for 2 remaining slots)
    console.log('\n--- 3. Testing Real Simultaneous Concurrent Inserts (5 racing for 2 slots) ---');
    const clients = [];
    for (let i = 0; i < 5; i++) {
      const c = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
      await c.connect();
      clients.push({ client: c, userId: randomUUID(), name: `Racer ${i + 1}` });
    }

    // Launch 5 parallel concurrent inserts into participants table
    const raceResults = await Promise.allSettled(
      clients.map(({ client, userId, name }) =>
        client.query(
          `INSERT INTO public.participants (id, room_id, user_id, display_name, language_code, language_name, is_connected)
           VALUES ($1, $2, $3, $4, 'es', 'Spanish', TRUE);`,
          [randomUUID(), roomId, userId, name]
        )
      )
    );

    let successCount = 0;
    let capacityRejectedCount = 0;

    for (const r of raceResults) {
      if (r.status === 'fulfilled') {
        successCount++;
      } else {
        const errMsg = r.reason?.message || '';
        if (errMsg.includes('Room is full') || errMsg.includes('Maximum 3 participants allowed')) {
          capacityRejectedCount++;
        }
      }
    }

    // Clean up racing clients
    await Promise.all(clients.map(({ client }) => client.end()));

    console.log(`Concurrent results: ${successCount} successful inserts, ${capacityRejectedCount} rejected by trigger`);
    assert(successCount === 2, 'Exactly 2 concurrent clients admitted to reach configured limit of 3');
    assert(capacityRejectedCount === 3, 'Remaining 3 clients rejected with "Room is full. Maximum 3 participants allowed"');

    // Verify room table participant count
    const finalRoom = await mainClient.query('SELECT participant_count FROM public.rooms WHERE id = $1', [roomId]);
    assert(finalRoom.rows[0].participant_count === 3, 'Room participant_count strictly equals 3');

    // 4. Test Dynamic Capacity Expansion while Room is Active
    console.log('\n--- 4. Active Room Settings & Capacity Updates ---');
    
    // Set caller as host
    await setSessionAuthUser(mainClient, hostUserId);

    // Attempt to reduce capacity below current occupancy (try setting capacity to 2 when occupancy is 3)
    let shrinkBlocked = false;
    try {
      await mainClient.query(
        `SELECT public.update_room_settings($1, 2, 'auto_approve') AS result;`,
        [roomId]
      );
    } catch (err) {
      shrinkBlocked = err.message.includes('Capacity cannot be reduced below current participant count');
    }
    assert(shrinkBlocked, 'Cannot reduce capacity below current occupancy (3)');

    // Host expands capacity to 5 and changes mode to approval_required
    const rpcExpand = await mainClient.query(
      `SELECT public.update_room_settings($1, 5, 'approval_required') AS result;`,
      [roomId]
    );
    assert(rpcExpand.rows[0].result.success === true, 'Host successfully expanded capacity to 5 and mode to approval_required');

    // Non-creator user tries to update settings
    const randomUser = randomUUID();
    await setSessionAuthUser(mainClient, randomUser);
    let unauthBlocked = false;
    try {
      await mainClient.query(
        `SELECT public.update_room_settings($1, 10, 'auto_approve');`,
        [roomId]
      );
    } catch (err) {
      unauthBlocked = err.message.includes('Only the room creator');
    }
    assert(unauthBlocked, 'Non-host user rejected with "Only the room creator can update room settings"');

    // 5. Join Request Status Transitions & Resolution
    console.log('\n--- 5. Join Request Lifecycle (Pending -> Approved / Declined / Cancelled) ---');
    const guestUser = randomUUID();
    const reqId = randomUUID();

    // Insert pending join request
    await mainClient.query(
      `INSERT INTO public.join_requests (id, room_id, user_id, display_name, language_code, language_name, status)
       VALUES ($1, $2, $3, 'Guest Requester', 'fr', 'French', 'pending');`,
      [reqId, roomId, guestUser]
    );

    const pendingCheck = await mainClient.query('SELECT status FROM public.join_requests WHERE id = $1', [reqId]);
    assert(pendingCheck.rows[0].status === 'pending', 'Join request starts in pending state');

    // Non-host tries to approve request
    await setSessionAuthUser(mainClient, randomUser);
    let fakeApproveCaught = false;
    try {
      await mainClient.query(
        `SELECT public.resolve_join_request($1, 'approve');`,
        [reqId]
      );
    } catch (err) {
      fakeApproveCaught = err.message.includes('Only the room creator');
    }
    assert(fakeApproveCaught, 'Unauthorized user blocked from approving join request');

    // Host approves request
    await setSessionAuthUser(mainClient, hostUserId);
    const hostApprove = await mainClient.query(
      `SELECT public.resolve_join_request($1, 'approve') AS result;`,
      [reqId]
    );
    assert(hostApprove.rows[0].result.success === true, 'Host successfully approved join request');

    // Verify participant was added
    const afterApproveCheck = await mainClient.query(
      'SELECT * FROM public.participants WHERE room_id = $1 AND user_id = $2',
      [roomId, guestUser]
    );
    assert(afterApproveCheck.rows.length === 1, 'Approved guest is now an admitted participant');

    // Requester cancels request test
    const cancelGuestUser = randomUUID();
    const cancelReqId = randomUUID();
    await mainClient.query(
      `INSERT INTO public.join_requests (id, room_id, user_id, display_name, language_code, language_name, status)
       VALUES ($1, $2, $3, 'Cancelling User', 'de', 'German', 'pending');`,
      [cancelReqId, roomId, cancelGuestUser]
    );

    // Cancel by requester
    await setSessionAuthUser(mainClient, cancelGuestUser);
    const cancelRes = await mainClient.query(
      `SELECT public.cancel_join_request($1) AS result;`,
      [cancelReqId]
    );
    assert(cancelRes.rows[0].result.success === true, 'Requester successfully cancelled their own request');

    const cancelStatus = await mainClient.query('SELECT status FROM public.join_requests WHERE id = $1', [cancelReqId]);
    assert(cancelStatus.rows[0].status === 'cancelled', 'Request status transitioned to cancelled');

    // 6. Multi-Participant Translation Persistence & Integrity Test (4 Admitted Participants)
    console.log('\n--- 6. Multi-Participant Multilingual Messaging Integrity ---');
    const msgId = randomUUID();
    const msgText = 'Hello team, our deployment is ready for launch!';

    // Insert Message from Host
    await mainClient.query(
      `INSERT INTO public.messages (id, room_id, sender_id, sender_name, original_text, source_language, target_language, translated_text, translation_status)
       VALUES ($1, $2, $3, 'Host User', $4, 'en', 'es', '¡Hola equipo, nuestro despliegue está listo para el lanzamiento!', 'translated');`,
      [msgId, roomId, hostUserId, msgText]
    );

    // Insert Translations for each participant's target language
    const transSpanishId = randomUUID();
    const transFrenchId = randomUUID();

    await mainClient.query(
      `INSERT INTO public.message_translations (id, message_id, room_id, target_language, target_language_name, translated_text, translation_status)
       VALUES 
       ($1, $2, $3, 'es', 'Spanish', '¡Hola equipo, nuestro despliegue está listo para el lanzamiento!', 'translated'),
       ($4, $2, $3, 'fr', 'French', 'Bonjour l équipe, notre déploiement est prêt pour le lancement!', 'translated');`,
      [transSpanishId, msgId, roomId, transFrenchId]
    );

    const savedTranslations = await mainClient.query(
      'SELECT target_language, translated_text FROM public.message_translations WHERE message_id = $1 ORDER BY target_language ASC',
      [msgId]
    );

    assert(savedTranslations.rows.length === 2, 'Message translations stored for both target languages (es, fr)');
    assert(savedTranslations.rows[0].target_language === 'es', 'Spanish translation verified');
    assert(savedTranslations.rows[1].target_language === 'fr', 'French translation verified');

    console.log('\n========================================================================');
    console.log('✅ ALL LIVE POSTGRES CONCURRENCY & CAPACITY TESTS PASSED (100% SUCCESS)');
    console.log('========================================================================');
  } finally {
    // Cleanup test room and cascaded records
    await mainClient.query('DELETE FROM public.message_translations WHERE room_id = $1;', [roomId]);
    await mainClient.query('DELETE FROM public.messages WHERE room_id = $1;', [roomId]);
    await mainClient.query('DELETE FROM public.join_requests WHERE room_id = $1;', [roomId]);
    await mainClient.query('DELETE FROM public.participants WHERE room_id = $1;', [roomId]);
    await mainClient.query('DELETE FROM public.rooms WHERE id = $1;', [roomId]);
    await mainClient.end();
  }
}

runRealConcurrencyAndCapacityTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
