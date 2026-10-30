package nl.focuson.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.telecom.TelecomManager
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ServiceCompat
import org.json.JSONObject

/**
 * Draait tijdens de les. Toont een scherm over alle apps behalve bellen (en 112),
 * stuurt elke 15 seconden een heartbeat en meldt het als de rechten worden ingetrokken.
 */
class BlockerService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var overlay: View? = null
    private var lastPkg: String? = null
    private var lastBeat = 0L
    private var finishedNormally = false
    private lateinit var allowed: Set<String>

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Api.init(this)
        val ch = NotificationChannel("focuson", "FocusOn", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        val n = Notification.Builder(this, "focuson")
            .setContentTitle("FocusOn actief")
            .setContentText("Apps zijn geblokkeerd tot het einde van de les")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
        ServiceCompat.startForeground(this, 1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        allowed = computeAllowed()
        running = true
        handler.removeCallbacksAndMessages(null)
        handler.post(loop)
        return START_STICKY
    }

    private fun computeAllowed(): Set<String> {
        val s = mutableSetOf(
            packageName, "com.android.systemui", "com.android.server.telecom",
            "com.android.incallui", "com.samsung.android.incallui",
            "com.android.dialer", "com.google.android.dialer", "com.samsung.android.dialer",
            "com.android.emergency",
        )
        getSystemService(TelecomManager::class.java)?.defaultDialerPackage?.let { s.add(it) }
        return s
    }

    private val loop = object : Runnable {
        override fun run() {
            tick()
            handler.postDelayed(this, 700)
        }
    }

    private fun tick() {
        // Rechten ingetrokken = omzeiling melden
        if (!Permissions.hasOverlay(this) || !Permissions.hasUsageAccess(this)) {
            reportBypass("toestemming ingetrokken")
            return
        }
        val pkg = foregroundPackage() ?: lastPkg
        lastPkg = pkg
        if (pkg != null && pkg !in allowed) showOverlay() else hideOverlay()

        val now = System.currentTimeMillis()
        if (now - lastBeat > 15000) {
            lastBeat = now
            Thread {
                try {
                    val r = Api.call("POST", "/api/student/heartbeat")
                    if (r.optInt("_status") == 200 && !r.optBoolean("lesActief", true)) {
                        handler.post { finishLesson() }
                    }
                } catch (_: Exception) { /* geen netwerk: server meldt "geen signaal" */ }
            }.start()
        }
    }

    private fun foregroundPackage(): String? {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 10_000, now)
        val e = UsageEvents.Event()
        var pkg: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.eventType == UsageEvents.Event.ACTIVITY_RESUMED) pkg = e.packageName
        }
        return pkg
    }

    private fun showOverlay() {
        if (overlay != null) return
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#10141B"))
            setPadding(48, 48, 48, 48)
        }
        fun label(text: String, size: Float) = TextView(this).apply {
            this.text = text; textSize = size; setTextColor(Color.WHITE); gravity = Gravity.CENTER
        }
        root.addView(label("FocusOn", 30f))
        root.addView(label("Les bezig. Alle apps zijn geblokkeerd.", 16f))
        root.addView(Button(this).apply {
            text = "Telefoon (bellen)"
            setOnClickListener { startActivity(Intent(Intent.ACTION_DIAL).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        })
        root.addView(Button(this).apply {
            text = "Noodoproep 112"
            setOnClickListener {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:112")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        })
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.OPAQUE,
        )
        wm.addView(root, lp)
        overlay = root
    }

    private fun hideOverlay() {
        overlay?.let {
            (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(it)
            overlay = null
        }
    }

    private fun reportBypass(reason: String) {
        if (finishedNormally) return
        finishedNormally = true
        Thread {
            try { Api.call("POST", "/api/student/bypass", JSONObject().put("reden", reason)) } catch (_: Exception) {}
        }.start()
        finishLesson()
    }

    fun finishLesson() {
        finishedNormally = true
        hideOverlay()
        stopSelf()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        hideOverlay()
        running = false
        super.onDestroy()
    }

    companion object {
        @Volatile var running = false
    }
}
