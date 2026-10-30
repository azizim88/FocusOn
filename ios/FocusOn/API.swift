import Foundation

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Eenvoudige client voor de FocusOn-server.
final class API {
    static let shared = API()
    var base = "http://localhost:3000"   // pas aan naar het adres van de server (https in productie)
    var token: String?

    func call(_ method: String, _ path: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let url = URL(string: base + path) else { throw APIError(message: "Ongeldig server-adres") }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 8
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if status >= 400 { throw APIError(message: json["error"] as? String ?? "Fout \(status)") }
        return json
    }
}
