# FocusOn: plan voor echte apps

## Beslissingen tot nu toe
- Naam: FocusOn.
- Alle apps blokkeren tijdens de les; bellen blijft altijd mogelijk (geen schakelaar voor de docent). Noodoproep (112) is altijd mogelijk.
- Roterende code elke 20 seconden tegen doorsturen van de code.
- Alleen aangevinkte studenten kunnen inchecken.
- Uitchecktijden worden altijd geregistreerd (einde les, zelf, omzeild).
- Inloggen: SSO via Canvas (LTI 1.3 voor de docent, OAuth2 voor de student-app). Zonder SSO: inloggen met studentnummer. Elk account werkt op één toestel; de docent kan een toestel vrijgeven.

## Architectuur (voorstel)
- **Server**: database (lessen, klassen, aanwezigheid, toestellen), API, roterende codes, meldingen bij omzeilen.
- **Docentweb**: dashboard (uit het prototype), later als LTI-tool in Canvas.
- **Android-app** (Kotlin): QR scannen, apps blokkeren, heartbeat naar server.
- **iOS-app** (Swift): QR scannen, apps blokkeren met Screen Time-API's.

## Beperkingen per platform
- **Android (Samsung):** blokkeren via een scherm-overlay en UsageStats (toestemmingen "Weergeven over andere apps" en "Toegang tot app-gebruik"). Student kan de toestemming zelf intrekken; de app meldt dat aan de docent. Echt afdwingen kan alleen met MDM/Device Owner op schooltoestellen.
- **iPhone:** blokkeren via Family Controls / ManagedSettings. Vereist een door Apple goedgekeurd entitlement. De Telefoon-app blijft altijd bereikbaar, wat past bij de keuze dat bellen altijd mogelijk is.
- Een app kan vliegtuigmodus niet aanzetten op Android of iOS.

## Wat nodig is om de apps te downloaden
**Samsung (Android)**
1. App bouwen in Android Studio (Kotlin).
2. Testen: APK installeren op een toestel (sideloaden).
3. Verspreiden: Google Play Console-account (eenmalige kosten, ongeveer 25 dollar), daarna interne test of gesloten test en publicatie. Voor schooltoestellen kan de IT-afdeling de app ook via MDM uitrollen.

**iPhone**
1. App bouwen in Xcode (Mac nodig).
2. Apple Developer Program (ongeveer 99 dollar per jaar).
3. Family Controls-entitlement aanvragen bij Apple (goedkeuring kan tijd kosten).
4. Testen via TestFlight, verspreiden via de App Store of via Apple Business/School Manager.

## Volgende stappen
1. Serverarchitectuur uitwerken (database, API, LTI 1.3 en OAuth2 met Canvas).
2. Android-app bouwen en testen op een Samsung.
3. Apple-entitlement aanvragen en iOS-app bouwen.
4. Privacy (AVG): gegevens, bewaartermijn, verwerkersovereenkomst met de school.
