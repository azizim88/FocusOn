# FocusOn voor iPhone (SwiftUI)

## Project maken (Mac met Xcode 15+ nodig)
1. `brew install xcodegen`
2. In deze map (`ios/`): `xcodegen`. Dit maakt `FocusOn.xcodeproj` uit `project.yml`.
3. Open `FocusOn.xcodeproj`, kies bij Signing & Capabilities je Team (Apple Developer-account). De Family Controls-capability staat al in `Config/FocusOn.entitlements`.
4. Zet het server-adres in de app (of `API.base`). `http` werkt alleen voor testen (ATS-uitzondering in `project.yml`); gebruik https in productie.
5. Run op een echt toestel (Family Controls werkt niet in de simulator).

## Apple-goedkeuring
Testen op eigen toestel kan met het Development-entitlement. Voor TestFlight/App Store moet Apple Family Controls (Distribution) goedkeuren: https://developer.apple.com/contact/request/family-controls-distribution

## Functies
Inloggen met studentnummer (sessie wordt onthouden), QR-code scannen (VisionKit) of code typen, blokkeren via Schermtijd, heartbeat, melding bij ingetrokken toestemming.

## Beperkingen
- De Telefoon-app kan niet worden afgeschermd en blijft altijd bereikbaar.
- Student kan de Schermtijd-toestemming zelf intrekken; de app meldt dat zolang hij actief is.
- Niet gecompileerd of getest (geen Mac beschikbaar tijdens het schrijven). Verwacht kleine compilerfixes.
