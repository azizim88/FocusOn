# FocusOn

App voor scholen: studenten checken in bij de les, afleidende apps worden geblokkeerd, de docent krijgt een presentielijst met in- en uitchecktijden.

## Status
- Werkend **webprototype** (docentdashboard + simulatie van de student-telefoon): `prototype/index.html`. Open het bestand in een browser.
- Server (`server/`), Android-broncode (`android/`) en iOS-broncode (`ios/`). De apps zijn niet gecompileerd of getest en niet installeerbaar zonder Android Studio of Xcode.
- **Lees `CONTEXT.md` voor alle beslissingen en afspraken.**

## Wat het prototype doet
- Docent: inloggen/registreren, klas importeren (CSV `studentnummer;naam`), aanvinken wie in de les is, les starten en beëindigen.
- Roterende inchecktcode (elke 20 s, in de app later een QR-code).
- Presentielijst met inchecktijd, uitchecktijd en reden (einde les, zelf, blokkade omzeild), CSV-export.
- Tijdens de les zijn alle apps geblokkeerd behalve bellen. Bellen en het alarmnummer zijn altijd mogelijk.
- Student: inloggen met SSO (gesimuleerd) of studentnummer, één toestel per account, docent kan een toestel vrijgeven.
- Meldingen aan de docent bij omzeilen van de blokkade of een mislukte check-in.

## Mappen
- `prototype/`  webprototype
- `server/`  Node-server met API en test
- `android/`  Kotlin/Compose-app (Samsung)
- `ios/`  SwiftUI-app + XcodeGen-spec (`xcodegen` maakt het Xcode-project)
- `docs/PLAN.md`  ontwerp, beperkingen en stappen naar echte apps
- `CONTEXT.md`  samenvatting van het gesprek en beslissingen

## Bouwen via GitHub (zonder Android Studio of Mac)
1. Maak een GitHub-repository en push deze map (de map `.github/` moet in de root staan).
2. Tab **Actions**: "Android APK" levert na een run de debug-APK onder *Artifacts* (`FocusOn-debug-apk`). Installeer die op een Samsung (onbekende bronnen toestaan).
3. "iOS build" controleert alleen of de app compileert. Een installeerbare iPhone-app vereist Apple-certificaten en het Family Controls-entitlement.
