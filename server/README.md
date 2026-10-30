# FocusOn server (prototype)

Node.js zonder externe afhankelijkheden. Gegevens staan alleen in het geheugen en zijn weg na herstart.

    node server.js      # start op poort 3000
    node test.js        # integratietest

Standaard docent-account: `docent@school.nl` / `focuson`.

## API
Docent (Bearer-token na `POST /api/teacher/login`):
`POST /api/teacher/register`, `POST /api/roster/import` ({csv}), `GET /api/roster`, `POST /api/roster/release` ({nr}), `POST /api/roster/present` ({nr, inLes}), `POST /api/lessons` ({klas, duur}), `GET /api/lessons/current`, `POST /api/lessons/end`.

Student (Bearer-token na `POST /api/student/login` met {nr, deviceId}):
`GET /api/student/state`, `POST /api/student/checkin` ({code}), `POST /api/student/heartbeat`, `POST /api/student/checkout`, `POST /api/student/bypass` ({reden}).

## Regels
- Roterende code elke 20 s (HMAC), de vorige code blijft 3 s geldig.
- Alleen studenten met `inLes = true` kunnen inchecken.
- Elk account is gebonden aan één toestel; de docent kan het vrijgeven.
- Geen heartbeat gedurende 45 s na inchecken geeft een melding.
- Bij einde les worden alle ingecheckte studenten uitgecheckt met reden "Einde les".

## Nog te doen voor productie
Database, https, wachtwoord-hashing, rate limiting, SSO via Canvas (LTI 1.3 / OAuth2), AVG (bewaartermijn, logging).
