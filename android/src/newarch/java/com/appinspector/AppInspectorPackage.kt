package com.appinspector

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AppInspectorPackage : BaseReactPackage() {
  init {
    AppInspectorNetwork.install()
  }

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == AppInspectorModuleImpl.NAME) AppInspectorModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      AppInspectorModuleImpl.NAME to ReactModuleInfo(
        AppInspectorModuleImpl.NAME,
        AppInspectorModule::class.java.name,
        false, // canOverrideExistingModule
        false, // needsEagerInit
        false, // isCxxModule
        true, // isTurboModule
      ),
    )
  }
}
