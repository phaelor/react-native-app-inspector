package com.appinspector

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class AppInspectorModule(reactContext: ReactApplicationContext) :
  NativeAppInspectorSpec(reactContext) {

  private val impl = AppInspectorModuleImpl(reactContext)

  override fun getTypedExportedConstants(): Map<String, Any> = impl.getConstants()

  override fun invalidate() {
    impl.invalidate()
    super.invalidate()
  }

  override fun startMonitoring(intervalMs: Double) = impl.startMonitoring(intervalMs)

  override fun stopMonitoring() = impl.stopMonitoring()

  override fun getProcessStartTime(promise: Promise) = impl.getProcessStartTime(promise)

  override fun watchNextFrame(promise: Promise) = impl.watchNextFrame(promise)

  override fun startNetworkCapture(
    captureBodies: Boolean,
    maxBodyBytes: Double,
    captureHeaders: Boolean,
  ) = impl.startNetworkCapture(captureBodies, maxBodyBytes, captureHeaders)

  override fun stopNetworkCapture() = impl.stopNetworkCapture()

  override fun addListener(eventName: String) {}

  override fun removeListeners(count: Double) {}
}
