package com.appinspector

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor installed into RN's client factory at package
 * construction (before NetworkingModule builds its client). Inert until
 * enabled from JS.
 */
object AppInspectorNetwork {
  @Volatile var enabled = false
  @Volatile
  var listener:
    ((method: String, url: String, status: Int, startedAt: Long, durationMs: Long) -> Unit)? =
    null

  /** True once the interceptor is wired into RN's client; JS falls back to the XHR patch otherwise. */
  @Volatile var installed = false
    private set

  private var attempted = false

  /**
   * Chains onto any factory the host already registered. RN exposes no getter
   * for it, so it is read reflectively; if that read fails on some RN version
   * we do NOT install (replacing an unknown host factory silently would break
   * e.g. certificate pinning) and JS captures via XHR instead.
   */
  @Synchronized
  fun install() {
    if (attempted) return
    attempted = true
    val existing = try {
      val field = OkHttpClientProvider::class.java.getDeclaredField("sFactory")
      field.isAccessible = true
      field.get(null) as? OkHttpClientFactory
    } catch (e: Throwable) {
      android.util.Log.w(
        "AppInspector",
        "Cannot read OkHttpClientProvider factory; native network capture disabled",
      )
      return
    }
    OkHttpClientProvider.setOkHttpClientFactory {
      val base =
        existing?.createNewNetworkModuleClient()
          ?: OkHttpClientProvider.createClientBuilder().build()
      base.newBuilder().addInterceptor(CaptureInterceptor()).build()
    }
    installed = true
  }

  private class CaptureInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
      val request = chain.request()
      if (!enabled) return chain.proceed(request)
      val startedAt = System.currentTimeMillis()
      try {
        val response = chain.proceed(request)
        report(request.method, request.url.toString(), response.code, startedAt)
        return response
      } catch (e: java.io.IOException) {
        report(request.method, request.url.toString(), 0, startedAt)
        throw e
      }
    }

    private fun report(method: String, url: String, status: Int, startedAt: Long) {
      listener?.invoke(
        method,
        url,
        status,
        startedAt,
        System.currentTimeMillis() - startedAt,
      )
    }
  }
}
