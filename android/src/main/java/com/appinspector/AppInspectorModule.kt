package com.appinspector

import android.os.Build
import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import android.view.Choreographer
import android.view.FrameMetrics
import android.view.Window
import java.util.concurrent.atomic.AtomicBoolean
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

/**
 * Native metrics for react-native-app-inspector:
 *  - UI-thread FPS via [Choreographer]
 *  - resident memory (total PSS) via [Debug]
 *  - process start time for true startup timing
 *
 * Streams an `AppInspectorMetrics` event every `intervalMs` while monitoring.
 */
class AppInspectorModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), Choreographer.FrameCallback {

  private var frameCount = 0
  private var windowStartNanos = 0L
  private var uiFps = 0.0
  private var monitoring = false
  private val handler = Handler(Looper.getMainLooper())
  private var emitRunnable: Runnable? = null
  private var lastCpuTicks = -1L
  private var lastCpuAt = 0L

  private companion object {
    const val WATCH_FRAME_TIMEOUT_MS = 3000L
  }

  override fun getName(): String = "AppInspector"

  @ReactMethod
  fun startMonitoring(intervalMs: Double) {
    handler.post {
      if (monitoring) stopInternal()
      monitoring = true
      frameCount = 0
      uiFps = 0.0
      lastCpuTicks = -1L
      windowStartNanos = System.nanoTime()
      Choreographer.getInstance().postFrameCallback(this)

      val runnable = object : Runnable {
        override fun run() {
          if (!monitoring) return
          emit()
          handler.postDelayed(this, intervalMs.toLong())
        }
      }
      emitRunnable = runnable
      handler.postDelayed(runnable, intervalMs.toLong())
    }
  }

  @ReactMethod
  fun stopMonitoring() {
    handler.post { stopInternal() }
  }

  private fun stopInternal() {
    monitoring = false
    Choreographer.getInstance().removeFrameCallback(this)
    emitRunnable?.let { handler.removeCallbacks(it) }
    emitRunnable = null
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (!monitoring) return
    frameCount++
    val elapsed = (frameTimeNanos - windowStartNanos) / 1_000_000_000.0
    if (elapsed >= 1.0) {
      uiFps = frameCount / elapsed
      frameCount = 0
      windowStartNanos = frameTimeNanos
    }
    Choreographer.getInstance().postFrameCallback(this)
  }

  private fun emit() {
    val map = Arguments.createMap()
    map.putDouble("uiFps", Math.round(uiFps).toDouble())
    map.putDouble("usedMemoryMb", usedMemoryMb())
    map.putDouble("cpuPercent", cpuPercent())
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("AppInspectorMetrics", map)
  }

  private fun usedMemoryMb(): Double {
    val info = Debug.MemoryInfo()
    Debug.getMemoryInfo(info)
    // totalPss is reported in KB; round to 1 decimal MB.
    return Math.round(info.totalPss / 1024.0 * 10) / 10.0
  }

  // Process CPU usage as a percentage of one core (may exceed 100% across
  // cores). Derived from the delta of utime+stime in /proc/self/stat over the
  // wall-clock interval between emits.
  private fun cpuPercent(): Double {
    return try {
      val raw = File("/proc/self/stat").readText()
      // `comm` (field 2) is parenthesised and may contain spaces — skip past it.
      val after = raw.substring(raw.lastIndexOf(')') + 2).trim()
      val tokens = after.split(Regex("\\s+"))
      // After the ')': state is index 0, so utime (field 14) is index 11,
      // stime (field 15) is index 12.
      val ticks = tokens[11].toLong() + tokens[12].toLong()
      val nowMs = SystemClock.elapsedRealtime()
      var percent = 0.0
      if (lastCpuTicks >= 0 && nowMs > lastCpuAt) {
        // Android's clock tick (CLK_TCK) is 100 Hz.
        val cpuSeconds = (ticks - lastCpuTicks) / 100.0
        val wallSeconds = (nowMs - lastCpuAt) / 1000.0
        percent = cpuSeconds / wallSeconds * 100.0
      }
      lastCpuTicks = ticks
      lastCpuAt = nowMs
      Math.round(percent * 10) / 10.0
    } catch (e: Exception) {
      0.0
    }
  }

  // Presentation time (ms, uptime clock — same clock as MotionEvent.getEventTime)
  // of the next frame the app draws; -1.0 when nothing is drawn in time.
  @ReactMethod
  fun watchNextFrame(promise: Promise) {
    handler.post {
      val window = currentActivity?.window
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && window != null) {
        watchViaFrameMetrics(window, promise)
      } else {
        Choreographer.getInstance().postFrameCallback { frameTimeNanos ->
          promise.resolve(frameTimeNanos / 1_000_000.0)
        }
      }
    }
  }

  private fun watchViaFrameMetrics(window: Window, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val resolved = AtomicBoolean(false)
    val listener = object : Window.OnFrameMetricsAvailableListener {
      override fun onFrameMetricsAvailable(
        w: Window,
        metrics: FrameMetrics,
        dropCountSinceLastInvocation: Int,
      ) {
        if (!resolved.compareAndSet(false, true)) return
        handler.post {
          try {
            window.removeOnFrameMetricsAvailableListener(this)
          } catch (e: Exception) {
          }
        }
        val presentedNanos =
          metrics.getMetric(FrameMetrics.VSYNC_TIMESTAMP) +
            metrics.getMetric(FrameMetrics.TOTAL_DURATION)
        promise.resolve(presentedNanos / 1_000_000.0)
      }
    }
    try {
      window.addOnFrameMetricsAvailableListener(listener, handler)
    } catch (e: Exception) {
      Choreographer.getInstance().postFrameCallback { frameTimeNanos ->
        promise.resolve(frameTimeNanos / 1_000_000.0)
      }
      return
    }
    // A commit with no visual change draws no frame — don't hang the promise.
    handler.postDelayed({
      if (resolved.compareAndSet(false, true)) {
        try {
          window.removeOnFrameMetricsAvailableListener(listener)
        } catch (e: Exception) {
        }
        promise.resolve(-1.0)
      }
    }, WATCH_FRAME_TIMEOUT_MS)
  }

  @ReactMethod
  fun getProcessStartTime(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      val sinceStart = SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime()
      promise.resolve((System.currentTimeMillis() - sinceStart).toDouble())
    } else {
      promise.resolve(0.0)
    }
  }

  // Required so NativeEventEmitter does not warn on Android.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Double) {}
}
