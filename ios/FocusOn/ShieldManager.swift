import FamilyControls
import ManagedSettings

/// Blokkeert alle apps via Screen Time (Family Controls). De Telefoon-app kan door iOS
/// niet worden afgeschermd en blijft dus altijd bereikbaar. Dat past bij de afspraak dat bellen altijd mag.
final class ShieldManager {
    private let store = ManagedSettingsStore()

    var isAuthorized: Bool { AuthorizationCenter.shared.authorizationStatus == .approved }

    func requestAuthorization() async throws {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
    }

    func lock() {
        store.shield.applicationCategories = .all()
        store.shield.webDomainCategories = .all()
    }

    func unlock() {
        store.clearAllSettings()
    }
}
