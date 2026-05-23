const axios = require('axios');

const API = axios.create({ baseURL: 'http://127.0.0.1:5000/api' });

// Test state
let token = '';
let userId = '';
let folderId = '';
let tagId = '';
let mapId = '';
let importedMapId = '';
const testEmail = `testuser_${Date.now()}@example.com`;
const testPassword = 'Password123!';

let passed = 0;
let failed = 0;
const failures = [];

function auth() {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    const detail = err.response
      ? `Status ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    failures.push({ name, detail });
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

async function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   MindMap AI — Comprehensive E2E API Tests    ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // ─────────────────────────────────────────────
  // 1. AUTHENTICATION
  // ─────────────────────────────────────────────
  console.log('📦 1. Authentication');

  await test('POST /auth/register — Register new user', async () => {
    const res = await API.post('/auth/register', {
      name: 'Test User',
      email: testEmail,
      password: testPassword
    });
    await assert(res.data.token, 'Expected token in response');
    token = res.data.token;
  });

  await test('POST /auth/login — Login with credentials', async () => {
    const res = await API.post('/auth/login', {
      email: testEmail,
      password: testPassword
    });
    await assert(res.data.token, 'Expected token in response');
    token = res.data.token; // Use fresh token
  });

  await test('GET /auth/me — Fetch authenticated profile', async () => {
    const res = await API.get('/auth/me', auth());
    await assert(res.data.id, 'Expected user ID');
    await assert(res.data.email === testEmail, 'Email should match');
    userId = res.data.id;
  });

  await test('GET /auth/me — Reject unauthenticated request', async () => {
    try {
      await API.get('/auth/me');
      throw new Error('Should have returned 401/403');
    } catch (err) {
      await assert(
        err.response && (err.response.status === 401 || err.response.status === 403),
        `Expected 401/403, got ${err.response?.status}`
      );
    }
  });

  // ─────────────────────────────────────────────
  // 2. FOLDERS
  // ─────────────────────────────────────────────
  console.log('\n📦 2. Folders');

  await test('POST /folders — Create a folder', async () => {
    const res = await API.post('/folders', { name: `TestFolder_${Date.now()}` }, auth());
    await assert(res.data.id, 'Expected folder ID');
    folderId = res.data.id;
  });

  await test('GET /folders — Retrieve all folders', async () => {
    const res = await API.get('/folders', auth());
    await assert(Array.isArray(res.data), 'Expected array of folders');
    const found = res.data.some(f => f.id === folderId);
    await assert(found, 'Created folder should appear in list');
  });

  await test('PATCH /folders/:id — Rename folder', async () => {
    const res = await API.patch(`/folders/${folderId}`, { name: `Renamed_${Date.now()}` }, auth());
    await assert(res.data.id === folderId, 'Returned folder ID should match');
  });

  // ─────────────────────────────────────────────
  // 3. TAGS
  // ─────────────────────────────────────────────
  console.log('\n📦 3. Tags');

  await test('POST /tags — Create a tag', async () => {
    const res = await API.post('/tags', { name: `TestTag_${Date.now()}`, color: '#00ff00' }, auth());
    await assert(res.data.id, 'Expected tag ID');
    tagId = res.data.id;
  });

  await test('GET /tags — Retrieve all tags', async () => {
    const res = await API.get('/tags', auth());
    await assert(Array.isArray(res.data), 'Expected array of tags');
    const found = res.data.some(t => t.id === tagId);
    await assert(found, 'Created tag should appear in list');
  });

  await test('PATCH /tags/:id — Update tag color', async () => {
    const res = await API.patch(`/tags/${tagId}`, { color: '#ff00ff' }, auth());
    await assert(res.data.color === '#ff00ff', 'Color should be updated');
  });

  // ─────────────────────────────────────────────
  // 4. MIND MAP CRUD
  // ─────────────────────────────────────────────
  console.log('\n📦 4. Mind Maps');

  await test('POST /maps — Create blank map', async () => {
    const res = await API.post('/maps', { title: 'E2E Test Map' }, auth());
    await assert(res.data.mapId, 'Expected mapId in response');
    mapId = res.data.mapId;
  });

  await test('PUT /maps/:id — Update map with nodes and edges', async () => {
    const res = await API.put(`/maps/${mapId}`, {
      title: 'Updated E2E Map',
      nodes: [
        { id: 'n1', type: 'concept', position: { x: 0, y: 0 }, data: { label: 'Root Node', content: '' } },
        { id: 'n2', type: 'subconcept', position: { x: 200, y: 100 }, data: { label: 'Branch A', content: '' } },
        { id: 'n3', type: 'detail', position: { x: 200, y: 200 }, data: { label: 'Detail 1', content: 'Some detail' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' }
      ]
    }, auth());
    await assert(res.data.message, 'Expected success message');
  });

  await test('GET /maps/:id — Retrieve map with nodes/edges', async () => {
    const res = await API.get(`/maps/${mapId}`, auth());
    await assert(res.data.title === 'Updated E2E Map', 'Title should be updated');
    await assert(res.data.nodes.length === 3, `Expected 3 nodes, got ${res.data.nodes.length}`);
    await assert(res.data.edges.length === 2, `Expected 2 edges, got ${res.data.edges.length}`);
  });

  await test('GET /maps — List all maps', async () => {
    const res = await API.get('/maps', auth());
    await assert(Array.isArray(res.data), 'Expected array');
    const found = res.data.some(m => m.id === mapId);
    await assert(found, 'Created map should appear in list');
  });

  await test('GET /maps?search=Updated — Search maps', async () => {
    const res = await API.get('/maps?search=Updated', auth());
    const found = res.data.some(m => m.id === mapId);
    await assert(found, 'Map should be found by search');
  });

  // ─────────────────────────────────────────────
  // 5. FOLDER ↔ MAP ASSOCIATION
  // ─────────────────────────────────────────────
  console.log('\n📦 5. Map-Folder Association');

  await test('POST /folders/:id/maps — Add map to folder', async () => {
    const res = await API.post(`/folders/${folderId}/maps`, { mapId }, auth());
    await assert(res.data.message, 'Expected success message');
  });

  await test('GET /maps?folderId=... — Filter maps by folder', async () => {
    const res = await API.get(`/maps?folderId=${folderId}`, auth());
    const found = res.data.some(m => m.id === mapId);
    await assert(found, 'Map should appear when filtering by folder');
  });

  await test('DELETE /folders/:id/maps/:mapId — Remove map from folder', async () => {
    const res = await API.delete(`/folders/${folderId}/maps/${mapId}`, auth());
    await assert(res.data.message, 'Expected success message');
  });

  // ─────────────────────────────────────────────
  // 6. TAG ↔ MAP ASSOCIATION
  // ─────────────────────────────────────────────
  console.log('\n📦 6. Map-Tag Association');

  await test('POST /maps/:id/tags — Add tag to map', async () => {
    const res = await API.post(`/maps/${mapId}/tags`, { tagId }, auth());
    await assert(res.data.message, 'Expected success message');
  });

  await test('GET /maps/:id — Verify tag appears on map', async () => {
    const res = await API.get(`/maps/${mapId}`, auth());
    await assert(res.data.tags && res.data.tags.length > 0, 'Map should have tags');
    await assert(res.data.tags[0].id === tagId, 'Tag ID should match');
  });

  await test('DELETE /maps/:id/tags/:tagId — Remove tag from map', async () => {
    const res = await API.delete(`/maps/${mapId}/tags/${tagId}`, auth());
    await assert(res.data.message, 'Expected success message');
  });

  // ─────────────────────────────────────────────
  // 7. IMPORT (Server-side)
  // ─────────────────────────────────────────────
  console.log('\n📦 7. Import');

  await test('POST /maps/import — Import a map from JSON', async () => {
    const importPayload = {
      version: '1.0',
      map: {
        title: 'Imported E2E Map',
        nodes: [
          { id: 'imp-n1', type: 'concept', position: { x: 0, y: 0 }, data: { label: 'Imported Root' } },
          { id: 'imp-n2', type: 'subconcept', position: { x: 150, y: 100 }, data: { label: 'Imported Branch' } }
        ],
        edges: [
          { id: 'imp-e1', source: 'imp-n1', target: 'imp-n2' }
        ],
        tags: [{ name: 'imported', color: '#f97316' }],
        folders: []
      }
    };
    const res = await API.post('/maps/import', importPayload, auth());
    await assert(res.data.mapId, 'Expected mapId from import');
    await assert(res.data.nodeCount === 2, `Expected 2 nodes, got ${res.data.nodeCount}`);
    await assert(res.data.edgeCount === 1, `Expected 1 edge, got ${res.data.edgeCount}`);
    importedMapId = res.data.mapId;
  });

  await test('GET /maps/:id — Verify imported map', async () => {
    const res = await API.get(`/maps/${importedMapId}`, auth());
    await assert(res.data.title.includes('Imported'), 'Imported map title should contain [Imported]');
    await assert(res.data.nodes.length === 2, 'Should have 2 nodes');
    await assert(res.data.edges.length === 1, 'Should have 1 edge');
  });

  // ─────────────────────────────────────────────
  // 8. DOCUMENTS
  // ─────────────────────────────────────────────
  console.log('\n📦 8. Documents');

  await test('GET /documents/all — List user documents', async () => {
    const res = await API.get('/documents/all', auth());
    await assert(Array.isArray(res.data), 'Expected array of documents');
  });

  // ─────────────────────────────────────────────
  // 9. EDGE CASES & ERROR HANDLING
  // ─────────────────────────────────────────────
  console.log('\n📦 9. Error Handling & Edge Cases');

  await test('GET /maps/non-existent-id — Should return 404', async () => {
    try {
      await API.get('/maps/00000000-0000-0000-0000-000000000000', auth());
      throw new Error('Should have returned 404');
    } catch (err) {
      await assert(err.response && err.response.status === 404, `Expected 404, got ${err.response?.status}`);
    }
  });

  await test('POST /folders — Should return 400 without name', async () => {
    try {
      await API.post('/folders', {}, auth());
      throw new Error('Should have returned 400');
    } catch (err) {
      await assert(err.response && err.response.status === 400, `Expected 400, got ${err.response?.status}`);
    }
  });

  await test('POST /tags — Should return 400 without name', async () => {
    try {
      await API.post('/tags', {}, auth());
      throw new Error('Should have returned 400');
    } catch (err) {
      await assert(err.response && err.response.status === 400, `Expected 400, got ${err.response?.status}`);
    }
  });

  await test('POST /auth/register — Reject duplicate email', async () => {
    try {
      await API.post('/auth/register', {
        name: 'Dupe',
        email: testEmail,
        password: testPassword
      });
      throw new Error('Should have been rejected');
    } catch (err) {
      await assert(
        err.response && (err.response.status === 400 || err.response.status === 409),
        `Expected 400/409, got ${err.response?.status}`
      );
    }
  });

  // ─────────────────────────────────────────────
  // 10. CLEANUP
  // ─────────────────────────────────────────────
  console.log('\n📦 10. Cleanup');

  await test('DELETE /maps/:id — Delete test map', async () => {
    const res = await API.delete(`/maps/${mapId}`, auth());
    await assert(res.data.message, 'Expected success message');
  });

  await test('DELETE /maps/:id — Delete imported map', async () => {
    const res = await API.delete(`/maps/${importedMapId}`, auth());
    await assert(res.data.message, 'Expected success message');
  });

  await test('DELETE /tags/:id — Delete test tag', async () => {
    const res = await API.delete(`/tags/${tagId}`, auth());
    await assert(res.data.message, 'Expected success message');
  });

  await test('DELETE /folders/:id — Delete test folder', async () => {
    const res = await API.delete(`/folders/${folderId}`, auth());
    await assert(res.data.message, 'Expected success message');
  });

  // ─────────────────────────────────────────────
  // RESULTS
  // ─────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log(`║   Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 22 - String(passed).length - String(failed).length))}║`);
  console.log('╚════════════════════════════════════════════════╝');

  if (failures.length > 0) {
    console.log('\n🔴 Failures:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}`);
      console.log(`     ${f.detail}`);
    });
    process.exit(1);
  } else {
    console.log('\n🟢 All tests passed!\n');
  }
}

runTests();
