package nl.focuson.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Eenvoudige client voor de FocusOn-server. Roep aan vanaf een achtergrondthread. */
object Api {
    var base: String = "http://10.0.2.2:3000" // 10.0.2.2 = de computer vanuit de Android-emulator
    var token: String? = null
    var naam: String? = null
    private var prefs: SharedPreferences? = null

    /** Laadt een eerder opgeslagen sessie (nodig als Android het proces beëindigt). */
    fun init(ctx: Context) {
        if (prefs != null) return
        val p = ctx.applicationContext.getSharedPreferences("focuson", Context.MODE_PRIVATE)
        prefs = p
        base = p.getString("base", base) ?: base
        token = p.getString("token", null)
        naam = p.getString("naam", null)
    }

    fun saveSession(base: String, token: String, naam: String) {
        this.base = base; this.token = token; this.naam = naam
        prefs?.edit()?.putString("base", base)?.putString("token", token)?.putString("naam", naam)?.apply()
    }

    fun clearSession() {
        token = null; naam = null
        prefs?.edit()?.remove("token")?.remove("naam")?.apply()
    }

    fun call(method: String, path: String, body: JSONObject? = null): JSONObject {
        val c = URL(base + path).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.connectTimeout = 8000
        c.readTimeout = 8000
        token?.let { c.setRequestProperty("Authorization", "Bearer $it") }
        if (body != null) {
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        val code = c.responseCode
        val stream = if (code < 400) c.inputStream else c.errorStream
        val text = stream?.bufferedReader()?.readText().orEmpty()
        val json = try { JSONObject(if (text.isBlank()) "{}" else text) } catch (e: Exception) { JSONObject() }
        json.put("_status", code)
        return json
    }
}
