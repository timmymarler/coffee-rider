package com.timmy.marler.coffeerider

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tomtom.sdk.common.configuration.buildSdkConfiguration
import com.tomtom.sdk.init.TomTomSdk
import com.tomtom.sdk.telemetry.UserConsent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class TomTomNavigationModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun getName(): String = NAME

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(statusMap())
  }

  @ReactMethod
  fun initialize(telemetryEnabled: Boolean, promise: Promise) {
    if (BuildConfig.TOMTOM_API_KEY.isBlank()) {
      promise.reject("E_TOMTOM_KEY_MISSING", "TomTom Navigation SDK API key is not configured")
      return
    }

    scope.launch {
      try {
        if (!TomTomSdk.isInitialized) {
          val consent = if (telemetryEnabled) UserConsent.TelemetryOn else UserConsent.TelemetryOff
          val configuration = buildSdkConfiguration(
            context = reactApplicationContext.applicationContext,
            apiKey = BuildConfig.TOMTOM_API_KEY,
            telemetryUserConsent = suspend { consent },
          )
          TomTomSdk.initialize(
            context = reactApplicationContext.applicationContext,
            sdkConfiguration = configuration,
          )
        }
        promise.resolve(statusMap())
      } catch (error: Throwable) {
        promise.reject("E_TOMTOM_INITIALIZATION", error.message, error)
      }
    }
  }

  private fun statusMap() = Arguments.createMap().apply {
    putBoolean("available", true)
    putBoolean("configured", BuildConfig.TOMTOM_API_KEY.isNotBlank())
    putBoolean("initialized", TomTomSdk.isInitialized)
    putString("platform", "android")
    putString("sdkVersion", SDK_VERSION)
  }

  companion object {
    const val NAME = "TomTomNavigation"
    const val SDK_VERSION = "2.6.1"
  }
}