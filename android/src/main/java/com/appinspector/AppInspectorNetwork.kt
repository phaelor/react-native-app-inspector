package com.appinspector

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okio.Buffer

data class CapturedCall(
  val method: String,
  val url: String,
  val status: Int,
  val startedAt: Long,
  val durationMs: Long,
  val requestBody: String?,
  val responseBody: String?,
  val requestHeaders: Map<String, String>?,
  val responseHeaders: Map<String, String>?,
)

/**
 * OkHttp interceptor installed into RN's client factory at package
 * construction (before NetworkingModule builds its client). Inert until
 * enabled from JS.
 */
object AppInspectorNetwork {

  @Volatile var enabled = false
  @Volatile var captureBodies = true
  @Volatile var maxBodyBytes = 32L * 1024L
  @Volatile var captureHeaders = true
  @Volatile var listener: ((CapturedCall) -> Unit)? = null

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
      val requestBody = if (captureBodies) readRequestBody(request) else null
      try {
        val response = chain.proceed(request)
        report(
          request,
          response.code,
          startedAt,
          requestBody,
          if (captureBodies) readResponseBody(response) else null,
          if (captureHeaders) response.headers.toFlatMap() else null,
        )
        return response
      } catch (e: java.io.IOException) {
        report(request, 0, startedAt, requestBody, null, null)
        throw e
      }
    }

    private fun readRequestBody(request: Request): String? {
      val body = request.body ?: return null
      if (body.isOneShot() || body.isDuplex()) return null
      return try {
        val buffer = Buffer()
        body.writeTo(buffer)
        if (!buffer.isProbablyUtf8()) return "[binary]"
        buffer.readUtf8(minOf(buffer.size, maxBodyBytes))
      } catch (e: Exception) {
        null
      }
    }

    private fun readResponseBody(response: Response): String? =
      try {
        val peeked = response.peekBody(maxBodyBytes)
        val buffer = Buffer().apply { write(peeked.bytes()) }
        if (!buffer.isProbablyUtf8()) "[binary]" else buffer.readUtf8()
      } catch (e: Exception) {
        null
      }

    private fun report(
      request: Request,
      status: Int,
      startedAt: Long,
      requestBody: String?,
      responseBody: String?,
      responseHeaders: Map<String, String>?,
    ) {
      listener?.invoke(
        CapturedCall(
          method = request.method,
          url = request.url.toString(),
          status = status,
          startedAt = startedAt,
          durationMs = System.currentTimeMillis() - startedAt,
          requestBody = requestBody,
          responseBody = responseBody,
          requestHeaders = if (captureHeaders) request.headers.toFlatMap() else null,
          responseHeaders = responseHeaders,
        ),
      )
    }
  }

  /** Repeated names (Set-Cookie) are comma-joined, like XHR's getAllResponseHeaders. */
  private fun okhttp3.Headers.toFlatMap(): Map<String, String> =
    toMultimap().mapValues { (_, values) -> values.joinToString(", ") }

  private fun Buffer.isProbablyUtf8(): Boolean {
    return try {
      val prefix = Buffer()
      copyTo(prefix, 0, minOf(size, 64))
      var checked = 0
      while (checked < 16 && !prefix.exhausted()) {
        val codePoint = prefix.readUtf8CodePoint()
        if (Character.isISOControl(codePoint) && !Character.isWhitespace(codePoint)) {
          return false
        }
        checked++
      }
      true
    } catch (e: Exception) {
      false
    }
  }
}
