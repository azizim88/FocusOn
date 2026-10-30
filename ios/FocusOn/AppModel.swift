import Foundation
import UIKit

@MainActor
final class AppModel: ObservableObject {
    @Published var server: String
    @Published var nr = ""
    @Published var naam: String?
    @Published var code = ""
    @Published var melding = ""
    @Published var ingecheckt = false
    @Published var klas: String?
    @Published var gemachtigd = false
    @Published var scannen = false

    private let shield = ShieldManager()
    private let defaults = UserDefaults.standard
    private var timer: Task<Void, Never>?

    var deviceId: String { UIDevice.current.identifierForVendor?.uuidString ?? "onbekend" }

    init() {
        server = defaults.string(forKey: "base") ?? API.shared.base
        API.shared.base = server
        if let t = defaults.string(forKey: "token"), let n = defaults.string(forKey: "naam") {
            API.shared.token = t
            naam = n
            gemachtigd = shield.isAuthorized
            startPolling()
        }
    }

    /// Haalt de 6 cijfers uit een QR ("focuson:123456" of "123456").
    static func parseCode(_ raw: String) -> String? {
        let d = raw.filter(\.isNumber)
        return d.count == 6 ? d : nil
    }

    func login() async {
        let base = server.trimmingCharacters(in: .whitespaces)
        API.shared.base = base
        do {
            let r = try await API.shared.call("POST", "/api/student/login",
                body: ["nr": nr.trimmingCharacters(in: .whitespaces), "deviceId": deviceId])
            guard let token = r["token"] as? String, let n = r["naam"] as? String else { melding = "Onverwacht antwoord van de server"; return }
            API.shared.token = token
            naam = n
            defaults.set(base, forKey: "base"); defaults.set(token, forKey: "token"); defaults.set(n, forKey: "naam")
            melding = ""
            gemachtigd = shield.isAuthorized
            startPolling()
        } catch { melding = error.localizedDescription }
    }

    func logout() {
        timer?.cancel()
        shield.unlock()
        API.shared.token = nil
        ["token", "naam"].forEach { defaults.removeObject(forKey: $0) }
        naam = nil; ingecheckt = false
    }

    func vraagToestemming() async {
        do { try await shield.requestAuthorization(); gemachtigd = shield.isAuthorized }
        catch { melding = "Toestemming geweigerd: \(error.localizedDescription)" }
    }

    func checkIn(_ c: String? = nil) async {
        do {
            let r = try await API.shared.call("POST", "/api/student/checkin", body: ["code": c ?? code])
            ingecheckt = true
            code = ""
            melding = "Ingecheckt (\(r["status"] as? String ?? ""))"
            shield.lock()
        } catch { melding = error.localizedDescription }
    }

    func scanResultaat(_ raw: String) {
        scannen = false
        guard let c = AppModel.parseCode(raw) else { melding = "Ongeldige QR-code"; return }
        Task { await checkIn(c) }
    }

    func checkOut() async {
        _ = try? await API.shared.call("POST", "/api/student/checkout")
        shield.unlock()
        ingecheckt = false
        melding = "Uitgecheckt"
    }

    private func startPolling() {
        timer?.cancel()
        timer = Task {
            while !Task.isCancelled {
                await poll()
                try? await Task.sleep(nanoseconds: 5_000_000_000)
            }
        }
    }

    private func poll() async {
        gemachtigd = shield.isAuthorized
        // Toestemming ingetrokken tijdens de les: melden aan de docent
        if ingecheckt && !gemachtigd {
            _ = try? await API.shared.call("POST", "/api/student/bypass", body: ["reden": "toestemming ingetrokken"])
            ingecheckt = false
            melding = "Toestemming ingetrokken, de docent is gewaarschuwd"
            return
        }
        do {
            let r = try await API.shared.call("GET", "/api/student/state")
            let actief = r["lesActief"] as? Bool ?? false
            let binnen = r["ingecheckt"] as? Bool ?? false
            klas = r["klas"] as? String
            // Synchroniseer met de server (ook na herstart van de app)
            if actief && binnen {
                if !ingecheckt { ingecheckt = true; shield.lock() }
                _ = try? await API.shared.call("POST", "/api/student/heartbeat")
            } else if ingecheckt || !binnen {
                if ingecheckt { ingecheckt = false }
                shield.unlock()
            }
        } catch let e as APIError where e.message == "Niet ingelogd" {
            logout()
            melding = "Sessie verlopen, log opnieuw in"
        } catch { /* geen netwerk: de server meldt "geen signaal" */ }
    }
}
