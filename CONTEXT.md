# Context en beslissingen (voor toekomstige aanpassingen)

Dit bestand vat het gesprek samen waarin FocusOn is ontworpen. Geef dit bestand mee aan een nieuwe sessie om verder te werken.

## Doel
Telefoon-app "FocusOn": studenten checken in bij de les, tijdens de les zijn alle apps geblokkeerd behalve bellen, de docent heeft een presentielijst met in- en uitchecktijden. Voorbeeld/inspiratie: schoolmode.app (QR-check-in, vergrendeling, alert bij omzeilen).

## Eisen en beslissingen
- Naam: **FocusOn**.
- Alle apps geblokkeerd tijdens de les. **Bellen altijd mogelijk**, geen schakelaar voor de docent (eerder was er een "bellen toestaan door docent"-optie; die is bewust verwijderd). 112 altijd bereikbaar.
- Vliegtuigmodus is **geen** optie: een app kan hem niet aanzetten en 112 werkt er niet in.
- Inchecken met een **roterende code van 20 seconden** (later QR), tegen doorsturen buiten de klas.
- De **docent vinkt aan wie in de les is**; alleen die studenten kunnen inchecken.
- **Uitchecktijden** worden altijd geregistreerd (einde les, zelf uitchecken, blokkade omzeild).
- **Inloggen**: met SSO (school gebruikt **Canvas**: LTI 1.3 voor de docent, OAuth2 voor de student-app) is geen koppelcode nodig. Zonder SSO logt de student in met het **studentnummer**. In beide gevallen **één toestel per account**; de docent kan een toestel vrijgeven.
- Klas importeren via **CSV** (`studentnummer;naam`). Teststudenten: 1001 Anna de Vries tot 1010 Thijs Vos.
- Docentaccount zonder Canvas: eigen account (e-mail + wachtwoord). Testaccount `docent@school.nl` / `focuson`.
- Doelplatforms: **Samsung (Android)** en **iPhone**.

## Beperkingen (afgesproken, niet te omzeilen met een gewone app)
- Op eigen telefoons kan een student toestemmingen intrekken of de app stoppen. De app meldt dit aan de docent (heartbeat, bypass-melding), maar voorkomt het niet. Echt afdwingen kan alleen met MDM/Device Owner op schooltoestellen.
- iPhone: apps blokkeren via Family Controls (Apple-entitlement nodig). De Telefoon-app is niet af te schermen, dus bellen blijft altijd mogelijk (past bij de keuze).
- Een student die op een eigen telefoon eerst inlogt met het nummer van een klasgenoot kan dat account bezetten. SSO lost dit op.

## Status
- `prototype/index.html`: werkend webprototype (docent + studentsimulatie), getest door gebruiker niet bevestigd.
- `server/`: werkende Node-server met integratietest (geslaagd).
- `android/`: Kotlin/Compose-broncode, **niet gecompileerd of getest**.
- `ios/`: SwiftUI-broncode, **niet gecompileerd of getest**; geen Xcode-project, zie `ios/README.md`.
- Er zijn **geen** installeerbare apps; die vereisen Android Studio (Samsung) en Xcode + Apple Developer-account (iPhone). Zie `docs/PLAN.md`.

## Volgende stappen
1. Android bouwen in Android Studio en testen op een Samsung; fouten verhelpen.
2. Docentdashboard (prototype) koppelen aan de server-API.
3. QR-code genereren (docent) en scannen (student-app).
4. Canvas-koppeling (LTI 1.3 + OAuth2), daarna koppelcode/studentnummer-login als reserve.
5. Apple Family Controls-entitlement aanvragen, iOS-app bouwen.
6. Database, https, wachtwoord-hashing, AVG.

## Overige context uit hetzelfde gesprek (niet FocusOn)
Eerdere taak: XSLT verwijderen uit het webportal. Het portal verwijst naar klassiek RDWeb op `https://keying-t.x4d.upss.unisys.com/rdweb/pages/` (gebruikt `Site.xsl`). Chromium/Edge schakelt XSLT standaard uit rond 17 november 2026 (Chrome/Edge 158); met het beleid `XSLTEnabled` kan het tijdelijk terug tot Chrome 176 (17 augustus 2027). Aanpak: de HTML5-webclient (`/RDWeb/webclient/`) is geïnstalleerd en de root is al omgeleid in IIS naar `/RDWeb/webclient/index.html`. Nog te doen: de link in het webportal naar de webclient laten wijzen en testen in Edge (F12 > Network > filter `xsl`). Geen exceptie aanvragen bij KBC tenzij nodig.
