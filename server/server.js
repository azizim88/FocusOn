// FocusOn server (prototype). Geen externe afhankelijkheden. Gegevens staan alleen in het geheugen.
const http = require('http');
const fs = require('fs');
const nodePath = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROT_MS = 20000;            // roterende code: 20 seconden
const GRACE_MS = 3000;           // vorige code blijft 3 s geldig
const LATE_MS = 10 * 60 * 1000;  // na 10 min = te laat
const BEAT_TIMEOUT_MS = 45000;   // geen heartbeat = melding
const SECRET = crypto.randomBytes(16).toString('hex');

const state = {
  teachers: { 'docent@school.nl': 'focuson' },
  tokens: {},      // token -> { role, id }
  roster: [],      // { nr, naam, toestel, inLes }
  lesson: null,    // actieve of laatste les
  alerts: [],      // { t, tekst }
};

const now = () => Date.now();
const alert_ = (tekst) => state.alerts.unshift({ t: now(), tekst });

function codeFor(lesson, t) {
  const slot = Math.floor(t / ROT_MS);
  const h = crypto.createHmac('sha256', SECRET + lesson.id).update(String(slot)).digest('hex');
  return (parseInt(h.slice(0, 8), 16) % 1000000).toString().padStart(6, '0');
}
function validCode(lesson, code) {
  const t = now();
  if (code === codeFor(lesson, t)) return true;
  const prev = codeFor(lesson, t - ROT_MS);
  return code === prev && (t % ROT_MS) < GRACE_MS;
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}
function auth(req, role) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const s = state.tokens[tok];
  return s && s.role === role ? s : null;
}
function parseCsv(csv) {
  const out = [], seen = new Set();
  String(csv || '').split(/\r?\n/).forEach((line) => {
    line = line.trim(); if (!line) return;
    const p = line.split(/[;,\t]/).map((x) => x.trim());
    if (p.length < 2 || !p[0] || !p[1] || seen.has(p[0]) || /^(studentnummer|nr|id)$/i.test(p[0])) return;
    seen.add(p[0]);
    const old = state.roster.find((r) => r.nr === p[0]);
    out.push({ nr: p[0], naam: p.slice(1).join(' '), toestel: old ? old.toestel : null, inLes: old ? old.inLes : true });
  });
  return out;
}
function lessonActive() { return state.lesson && !state.lesson.end; }

function checkBeats() {
  if (!lessonActive()) return;
  const l = state.lesson;
  Object.values(l.rec).forEach((r) => {
    if (r.tijd && !r.uit && r.lastBeat && now() - r.lastBeat > BEAT_TIMEOUT_MS && !r.beatAlert) {
      r.beatAlert = true;
      alert_(`${r.naam}: geen signaal van de app (mogelijk afgesloten of buiten bereik)`);
    }
  });
}
setInterval(checkBeats, 5000).unref();

function endLesson() {
  const l = state.lesson; if (!l || l.end) return;
  l.end = now();
  Object.values(l.rec).forEach((r) => {
    if (r.tijd && !r.uit) { r.uit = now(); r.reden = 'Einde les'; }
    if (r.tijd && r.status !== 'Omzeild') r.status = 'Uitgecheckt';
  });
}
function lessonView() {
  const l = state.lesson; if (!l) return null;
  if (!l.end && now() - l.start >= l.duur * 60000) endLesson();
  const t = now();
  return {
    id: l.id, klas: l.klas, start: l.start, duur: l.duur, end: l.end, actief: !l.end,
    code: l.end ? null : codeFor(l, t),
    secondenTotWissel: l.end ? 0 : Math.ceil((ROT_MS - (t % ROT_MS)) / 1000),
    aanwezigheid: Object.values(l.rec).map((r) => {
      const ro = state.roster.find((x) => x.nr === r.nr);
      const niet = ro && !ro.inLes && !r.tijd;
      return { nr: r.nr, naam: r.naam, in: r.tijd, uit: r.uit, reden: r.reden, status: niet ? 'Niet in les' : r.status };
    }),
    meldingen: state.alerts.slice(0, 50),
  };
}

const routes = {
  'POST /api/teacher/register': async (req, res, b) => {
    const e = String(b.email || '').toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e) || String(b.password || '').length < 4) return send(res, 400, { error: 'Ongeldig e-mailadres of wachtwoord' });
    if (state.teachers[e]) return send(res, 409, { error: 'Account bestaat al' });
    state.teachers[e] = b.password; send(res, 200, { ok: true });
  },
  'POST /api/teacher/login': async (req, res, b) => {
    const e = String(b.email || '').toLowerCase();
    if (state.teachers[e] === undefined || state.teachers[e] !== b.password) return send(res, 401, { error: 'Onjuiste e-mail of wachtwoord' });
    const token = crypto.randomBytes(24).toString('hex'); state.tokens[token] = { role: 'teacher', id: e };
    send(res, 200, { token });
  },
  'POST /api/roster/import': async (req, res, b) => {
    if (!auth(req, 'teacher')) return send(res, 401, { error: 'Niet ingelogd' });
    if (lessonActive()) return send(res, 409, { error: 'Importeren kan niet tijdens een les' });
    state.roster = parseCsv(b.csv); send(res, 200, { aantal: state.roster.length });
  },
  'GET /api/roster': async (req, res) => {
    if (!auth(req, 'teacher')) return send(res, 401, { error: 'Niet ingelogd' });
    send(res, 200, { roster: state.roster });
  },
  'POST /api/roster/release': async (req, res, b) => {
    if (!auth(req, 'teacher')) return send(res, 401, { error: 'Niet ingelogd' });
    const r = state.roster.find((x) => x.nr === String(b.nr)); if (!r) return send(res, 404, { error: 'Onbekend studentnummer' });
    r.toestel = null;
    Object.keys(state.tokens).forEach((k) => { if (state.tokens[k].role === 'student' && state.tokens[k].id === r.nr) delete state.tokens[k]; });
    alert_(`Toestel vrijgegeven voor ${r.naam}`); send(res, 200, { ok: true });
  },
  'POST /api/roster/present': async (req, res, b) => {
    if (!auth(req, 'teacher')) return send(res, 401, { error: 'Niet ingelogd' });
    const r = state.roster.find((x) => x.nr === String(b.nr)); if (!r) return send(res, 404, { error: 'Onbekend studentnummer' });
    const rec = lessonActive() && state.lesson.rec[r.nr];
    if (rec && rec.tijd && !rec.uit) return send(res, 409, { error: 'Student is al ingecheckt' });
    r.inLes = !!b.inLes; send(res, 200, { ok: true });
  },
  'POST /api/lessons': async (req, res, b) => {
    if (!auth(req, 'teacher')) return send(res, 401, { error: 'Niet ingelogd' });
    if (lessonActive()) return send(res, 409, { error: 'Er is al een actieve les' });
    if (!state.roster.some((r) => r.inLes)) return send(res, 400, { error: 'Vink minstens één student aan' });
    const l = { id: crypto.randomBytes(6).toString('hex'), klas: String(b.klas || 'Les'), start: now(), duur: Math.max(1, +b.duur || 90), end: null, rec: {} };
    state.roster.forEach((r) => { l.rec[r.nr] = { nr: r.nr, naam: r.naam, tijd: null, uit: null, reden: null, status: 'Afwezig', lastBeat: null }; });
    state.lesson = l; alert_(`Les gestart: ${l.klas}`); send(res, 200, lessonView());
  },
  'GET /api/lessons/current': async (req, res) => {
    if (!auth(req, 'teacher')) return send(res, 401, { error: 'Niet ingelogd' });
    send(res, 200, { les: lessonView() });
  },
  'POST /api/lessons/end': async (req, res) => {
    if (!auth(req, 'teacher')) return send(res, 401, { error: 'Niet ingelogd' });
    endLesson(); alert_('Les beëindigd'); send(res, 200, { les: lessonView() });
  },

  // ---- student ----
  'POST /api/student/login': async (req, res, b) => {
    const r = state.roster.find((x) => x.nr === String(b.nr || '').trim());
    if (!r) return send(res, 404, { error: 'Studentnummer staat niet in de klas' });
    const dev = String(b.deviceId || '');
    if (!dev) return send(res, 400, { error: 'deviceId ontbreekt' });
    if (r.toestel && r.toestel !== dev) {
      alert_(`${r.naam}: inloggen geweigerd, account is al gekoppeld aan een ander toestel`);
      return send(res, 403, { error: 'Dit account is al in gebruik op een ander toestel. Vraag de docent het toestel vrij te geven.' });
    }
    r.toestel = dev;
    const token = crypto.randomBytes(24).toString('hex'); state.tokens[token] = { role: 'student', id: r.nr };
    send(res, 200, { token, naam: r.naam });
  },
  'GET /api/student/state': async (req, res) => {
    const s = auth(req, 'student'); if (!s) return send(res, 401, { error: 'Niet ingelogd' });
    if (state.lesson && !state.lesson.end) lessonView(); // sluit les automatisch bij tijd
    const l = state.lesson; const rec = l && l.rec[s.id];
    send(res, 200, {
      lesActief: !!(l && !l.end), klas: l ? l.klas : null,
      ingecheckt: !!(rec && rec.tijd && !rec.uit), status: rec ? rec.status : null,
    });
  },
  'POST /api/student/checkin': async (req, res, b) => {
    const s = auth(req, 'student'); if (!s) return send(res, 401, { error: 'Niet ingelogd' });
    const ro = state.roster.find((x) => x.nr === s.id);
    if (!lessonActive()) return send(res, 409, { error: 'Er is geen actieve les' });
    const l = state.lesson; const r = l.rec[s.id];
    if (!ro.inLes) { alert_(`${ro.naam} probeerde in te checken maar staat niet in de les`); return send(res, 403, { error: 'Je staat niet op de lijst voor deze les. Vraag de docent.' }); }
    if (r.tijd && !r.uit) return send(res, 409, { error: 'Je bent al ingecheckt' });
    if (!validCode(l, String(b.code || '').trim())) { alert_(`Ongeldige of verlopen code gebruikt door ${ro.naam}`); return send(res, 403, { error: 'Code ongeldig of verlopen' }); }
    r.tijd = r.tijd || now(); r.uit = null; r.reden = null; r.beatAlert = false; r.lastBeat = now();
    r.status = now() - l.start > LATE_MS ? 'Te laat' : 'Aanwezig';
    send(res, 200, { ok: true, status: r.status, klas: l.klas });
  },
  'POST /api/student/heartbeat': async (req, res) => {
    const s = auth(req, 'student'); if (!s) return send(res, 401, { error: 'Niet ingelogd' });
    const l = state.lesson, r = l && l.rec[s.id];
    if (r && r.tijd && !r.uit) { r.lastBeat = now(); r.beatAlert = false; }
    send(res, 200, { lesActief: !!(l && !l.end) });
  },
  'POST /api/student/checkout': async (req, res) => {
    const s = auth(req, 'student'); if (!s) return send(res, 401, { error: 'Niet ingelogd' });
    const l = state.lesson, r = l && l.rec[s.id];
    if (!r || !r.tijd || r.uit) return send(res, 409, { error: 'Niet ingecheckt' });
    r.uit = now(); r.reden = 'Zelf uitgecheckt'; r.status = 'Uitgecheckt'; send(res, 200, { ok: true });
  },
  'POST /api/student/bypass': async (req, res, b) => {
    const s = auth(req, 'student'); if (!s) return send(res, 401, { error: 'Niet ingelogd' });
    const l = state.lesson, r = l && l.rec[s.id];
    if (!r || !r.tijd || r.uit) return send(res, 409, { error: 'Niet ingecheckt' });
    r.uit = now(); r.reden = 'Blokkade omzeild'; r.status = 'Omzeild';
    alert_(`ALERT: ${r.naam} heeft de blokkade omzeild (${String(b.reden || 'onbekend')})`); send(res, 200, { ok: true });
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); return res.end(); }
  const path = req.url.split('?')[0];
  if (req.method === 'GET' && !path.startsWith('/api/')) {
    const file = path === '/' || path === '/docent' ? 'docent.html' : nodePath.basename(path);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    try {
      const data = fs.readFileSync(nodePath.join(__dirname, 'public', file));
      res.writeHead(200, { 'Content-Type': types[nodePath.extname(file)] || 'application/octet-stream' });
      return res.end(data);
    } catch { /* val door naar 404 */ }
  }
  const fn = routes[`${req.method} ${path}`];
  if (!fn) return send(res, 404, { error: 'Niet gevonden' });
  const body = req.method === 'POST' ? await readBody(req) : {};
  try { await fn(req, res, body); } catch (e) { send(res, 500, { error: 'Serverfout' }); }
});
if (require.main === module) server.listen(PORT, () => console.log(`FocusOn server op poort ${PORT}`));
module.exports = { server };
