import SwiftUI

struct ContentView: View {
    @EnvironmentObject var m: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("FocusOn").font(.largeTitle).bold()

            if m.naam == nil {
                TextField("Server-adres", text: $m.server).textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Studentnummer", text: $m.nr).textFieldStyle(.roundedBorder).keyboardType(.numberPad)
                Button("Inloggen") { Task { await m.login() } }.buttonStyle(.borderedProminent)
                Text("Inloggen met schoolaccount (SSO via Canvas) volgt in een volgende versie.")
                    .font(.footnote).foregroundStyle(.secondary)
            } else {
                Text("Ingelogd als \(m.naam ?? "")")
                if !m.gemachtigd {
                    Text("Geef FocusOn toestemming om apps te blokkeren (Schermtijd).")
                    Button("Toestemming geven") { Task { await m.vraagToestemming() } }.buttonStyle(.borderedProminent)
                }
                if !m.ingecheckt {
                    if QRScannerView.beschikbaar {
                        Button("QR-code scannen") { m.scannen = true }
                            .buttonStyle(.borderedProminent).disabled(!m.gemachtigd)
                    }
                    TextField("Of typ de code van de docent", text: $m.code).textFieldStyle(.roundedBorder).keyboardType(.numberPad)
                    Button("Inchecken") { Task { await m.checkIn() } }
                        .buttonStyle(.bordered)
                        .disabled(!m.gemachtigd || m.code.count != 6)
                    Button("Uitloggen", role: .cancel) { m.logout() }.font(.footnote)
                } else {
                    Text("Ingecheckt\(m.klas.map { " bij \($0)" } ?? ""). Alle apps zijn geblokkeerd behalve bellen.")
                    Button("Uitchecken") { Task { await m.checkOut() } }.buttonStyle(.bordered)
                }
            }
            if !m.melding.isEmpty { Text(m.melding).foregroundStyle(.blue) }
            Spacer()
        }
        .padding(20)
        .sheet(isPresented: $m.scannen) {
            QRScannerView { m.scanResultaat($0) }.ignoresSafeArea()
        }
    }
}
