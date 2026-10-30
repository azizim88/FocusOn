package nl.focuson.app

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Api.init(this)
        setContent { MaterialTheme { Surface(Modifier.fillMaxSize()) { App() } } }
    }
}

/** Haalt de 6-cijferige code uit een QR ("focuson:123456" of "123456"). */
fun parseCode(raw: String?): String? {
    val d = raw.orEmpty().filter(Char::isDigit)
    return if (d.length == 6) d else null
}

@Composable
fun App() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var server by remember { mutableStateOf(Api.base) }
    var nr by remember { mutableStateOf("") }
    var naam by remember { mutableStateOf(Api.naam) }
    var code by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf("") }
    var ingecheckt by remember { mutableStateOf(false) }
    var klas by remember { mutableStateOf<String?>(null) }
    var perms by remember { mutableStateOf(false) }

    fun doCheckin(c: String) {
        scope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching { Api.call("POST", "/api/student/checkin", JSONObject().put("code", c)) }.getOrNull()
            }
            if (r == null) msg = "Geen verbinding met de server"
            else if (r.optInt("_status") == 200) {
                ingecheckt = true; msg = "Ingecheckt (${r.optString("status")})"; code = ""
                ctx.startForegroundService(Intent(ctx, BlockerService::class.java))
            } else msg = r.optString("error", "Inchecken mislukt")
        }
    }

    // Controleer rechten en lesstatus elke 5 seconden
    LaunchedEffect(naam) {
        while (naam != null) {
            perms = Permissions.hasOverlay(ctx) && Permissions.hasUsageAccess(ctx)
            val r = withContext(Dispatchers.IO) { runCatching { Api.call("GET", "/api/student/state") }.getOrNull() }
            if (r != null && r.optInt("_status") == 401) {
                // Sessie verlopen (bijv. toestel vrijgegeven of server herstart)
                Api.clearSession(); naam = null; ingecheckt = false
                ctx.stopService(Intent(ctx, BlockerService::class.java))
                msg = "Sessie verlopen, log opnieuw in"
                break
            }
            if (r != null && r.optInt("_status") == 200) {
                ingecheckt = r.optBoolean("ingecheckt")
                klas = r.optString("klas").takeIf { it.isNotEmpty() && it != "null" }
                val actief = r.optBoolean("lesActief")
                if (!actief || !ingecheckt) ctx.stopService(Intent(ctx, BlockerService::class.java))
                else if (perms && !BlockerService.running) ctx.startForegroundService(Intent(ctx, BlockerService::class.java))
            }
            delay(5000)
        }
    }

    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("FocusOn", style = MaterialTheme.typography.headlineMedium)

        if (naam == null) {
            OutlinedTextField(server, { server = it }, label = { Text("Server-adres") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(nr, { nr = it }, label = { Text("Studentnummer") }, modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                val base = server.trim()
                Api.base = base
                val deviceId = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID)
                scope.launch {
                    val r = withContext(Dispatchers.IO) {
                        runCatching { Api.call("POST", "/api/student/login", JSONObject().put("nr", nr.trim()).put("deviceId", deviceId)) }.getOrNull()
                    }
                    if (r == null) msg = "Geen verbinding met de server"
                    else if (r.optInt("_status") == 200) {
                        Api.saveSession(base, r.getString("token"), r.getString("naam"))
                        naam = r.getString("naam"); msg = ""
                    } else msg = r.optString("error", "Inloggen mislukt")
                }
            }) { Text("Inloggen") }
            Text("Inloggen met schoolaccount (SSO via Canvas) volgt in een volgende versie.", style = MaterialTheme.typography.bodySmall)
        } else {
            Text("Ingelogd als $naam")
            if (!perms) {
                Text("Geef FocusOn twee toestemmingen, anders kan de app niet blokkeren:")
                Button(onClick = { ctx.startActivity(Permissions.overlaySettings(ctx)) }) { Text("1. Weergeven over andere apps") }
                Button(onClick = { ctx.startActivity(Permissions.usageSettings(ctx)) }) { Text("2. Toegang tot app-gebruik") }
            }
            if (!ingecheckt) {
                Button(enabled = perms, onClick = {
                    val opts = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
                    GmsBarcodeScanning.getClient(ctx, opts).startScan()
                        .addOnSuccessListener { b ->
                            val c = parseCode(b.rawValue)
                            if (c != null) doCheckin(c) else msg = "Ongeldige QR-code"
                        }
                        .addOnFailureListener { msg = "Scannen mislukt of geannuleerd" }
                }) { Text("QR-code scannen") }
                OutlinedTextField(code, { code = it.filter(Char::isDigit).take(6) }, label = { Text("Of typ de code van de docent") }, modifier = Modifier.fillMaxWidth())
                Button(enabled = perms && code.length == 6, onClick = { doCheckin(code) }) { Text("Inchecken") }
            } else {
                Text("Ingecheckt${klas?.let { " bij $it" } ?: ""}. Alle apps zijn geblokkeerd behalve bellen.")
                Button(onClick = {
                    scope.launch {
                        withContext(Dispatchers.IO) { runCatching { Api.call("POST", "/api/student/checkout") } }
                        ctx.stopService(Intent(ctx, BlockerService::class.java))
                        ingecheckt = false; msg = "Uitgecheckt"
                    }
                }) { Text("Uitchecken") }
            }
            if (!ingecheckt) TextButton(onClick = { Api.clearSession(); naam = null }) { Text("Uitloggen") }
        }
        if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.primary)
    }
}
