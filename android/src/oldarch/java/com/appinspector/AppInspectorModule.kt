package com.appinspector

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppInspectorModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val impl = AppInspectorModuleImpl(reactContext)

  override fun getName(): String = AppInspectorModuleImpl.NAME

  override fun getConstants(): Map<String, Any> = impl.getConstants()

  override fun invalidate() {
    impl.invalidate()
    super.invalidate()
  }

  @ReactMethod
  fun startMonitoring(intervalMs: Double) = impl.startMonitoring(intervalMs)

  @ReactMethod
  fun stopMonitoring() = impl.stopMonitoring()

  @ReactMethod
  fun getProcessStartTime(promise: Promise) = impl.getProcessStartTime(promise)

  @ReactMethod
  fun watchNextFrame(promise: Promise) = impl.watchNextFrame(promise)

  @ReactMethod
  fun startNetworkCapture(captureBodies: Boolean, maxBodyBytes: Double, captureHeaders: Boolean) =
    impl.startNetworkCapture(captureBodies, maxBodyBytes, captureHeaders)

  @ReactMethod
  fun stopNetworkCapture() = impl.stopNetworkCapture()

  // Required so NativeEventEmitter does not warn on Android.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Double) {}
}
