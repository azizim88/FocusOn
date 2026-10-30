// Eenvoudige integratietest: node test.js
const { server } = require('./server');
const assert = require('assert');
async function call(port, method, path, body, token) {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
(async () => {
  await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const c = (...a) => call(port, ...a);
  let r = await c('POST', '/api/teacher/login', { email: 'docent@school.nl', password: 'focuson' }); assert.equal(r.status, 200); const T = r.body.token;
  r = await c('POST', '/api/roster/import', { csv: '1001;Anna de Vries\n1002;Bram Jansen\n1003;Chloë Bakker' }, T); assert.equal(r.body.aantal, 3);
  r = await c('POST', '/api/roster/present', { nr: '1003', inLes: false }, T); assert.equal(r.status, 200);
  r = await c('POST', '/api/lessons', { klas: 'Test', duur: 45 }, T); assert.equal(r.status, 200);
  const code = r.body.code;
  r = await c('POST', '/api/student/login', { nr: '1001', deviceId: 'A' }); assert.equal(r.status, 200); const S1 = r.body.token;
  r = await c('POST', '/api/student/login', { nr: '1001', deviceId: 'B' }); assert.equal(r.status, 403, 'tweede toestel moet geweigerd worden');
  r = await c('POST', '/api/student/checkin', { code: '000000' }, S1); assert.equal(r.status, 403, 'foute code');
  r = await c('POST', '/api/student/checkin', { code }, S1); assert.equal(r.status, 200); assert.equal(r.body.status, 'Aanwezig');
  r = await c('POST', '/api/student/login', { nr: '1003', deviceId: 'C' }); const S3 = r.body.token;
  r = await c('POST', '/api/student/checkin', { code }, S3); assert.equal(r.status, 403, 'niet in de les');
  r = await c('POST', '/api/student/bypass', { reden: 'test' }, S1); assert.equal(r.status, 200);
  r = await c('GET', '/api/lessons/current', null, T);
  const a = Object.fromEntries(r.body.les.aanwezigheid.map((x) => [x.nr, x.status]));
  assert.equal(a['1001'], 'Omzeild'); assert.equal(a['1002'], 'Afwezig'); assert.equal(a['1003'], 'Niet in les');
  r = await c('POST', '/api/lessons/end', {}, T); assert.equal(r.body.les.actief, false);
  r = await c('POST', '/api/roster/release', { nr: '1001' }, T); assert.equal(r.status, 200);
  r = await c('POST', '/api/student/login', { nr: '1001', deviceId: 'B' }); assert.equal(r.status, 200, 'na vrijgeven kan nieuw toestel');
  console.log('Alle tests geslaagd'); server.close();
})().catch((e) => { console.error('FOUT:', e.message); process.exit(1); });
