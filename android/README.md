# FocusOn voor Android / Samsung (Kotlin, Jetpack Compose)

## Bouwen
1. Open de map `android/` in Android Studio (Koala of nieuwer, JDK 17).
2. Laat Gradle synchroniseren.
3. Start de server (`server/`) en pas het server-adres aan in de app (emulator: `http://10.0.2.2:3000`, echt toestel: het IP van de computer).
4. Run op een Samsung-toestel (USB-foutopsporing aan) of bouw een APK: Build > Build APK(s).

## Toestemmingen op het toestel
De app vraagt de student om twee instellingen:
1. Weergeven over andere apps (blokkeerscherm).
2. Toegang tot app-gebruik (om te zien welke app open is).

## Hoe het blokkeren werkt
`BlockerService` draait na inchecken als voorgrondservice, kijkt elke 0,7 s welke app open is en toont een volledig scherm over alles behalve de belapp, het belscherm en systeem-UI. Het blokkeerscherm heeft knoppen voor Telefoon en Noodoproep 112. Een heartbeat gaat elke 15 s naar de server. Trekt de student een toestemming in, dan wordt een melding naar de docent gestuurd.

## Beperkingen
- Een student kan de app geforceerd stoppen of de toestemmingen intrekken. Dat wordt gemeld maar niet voorkomen. Echt afdwingen kan alleen met MDM/Device Owner op schooltoestellen.
- Samsung-pakketnamen van de belapp kunnen verschillen per versie; de app gebruikt ook de standaard-belapp van het systeem.
- Niet gecompileerd of getest. Verwacht kleine aanpassingen bij de eerste build.
- QR-scannen werkt via de Google code scanner (Play Services, geen cameratoestemming nodig); de QR moet `focuson:123456` of `123456` bevatten. De code typen blijft mogelijk. SSO (Canvas) ontbreekt nog.
- De sessie wordt onthouden; na herstart van de app of het proces start de blokkade automatisch opnieuw als de student nog is ingecheckt.
