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

  private var installed = false

  @Synchronized
  fun install() {
    if (installed) return
    installed = true
    val existing = existingFactory()
    OkHttpClientProvider.setOkHttpClientFactory {
      val base =
        existing?.createNewNetworkModuleClient()
          ?: OkHttpClientProvider.createClientBuilder().build()
      base.newBuilder().addInterceptor(CaptureInterceptor()).build()
    }
  }

  private fun existingFactory(): OkHttpClientFactory? =
    try {
      val field = OkHttpClientProvider::class.java.getDeclaredField("sFactory")
      field.isAccessible = true
      field.get(null) as? OkHttpClientFactory
    } catch (e: Exception) {
      null
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
