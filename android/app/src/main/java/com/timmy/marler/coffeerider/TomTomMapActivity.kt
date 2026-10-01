package com.timmy.marler.coffeerider

import android.os.Bundle
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import com.tomtom.sdk.init.TomTomSdk
import com.tomtom.sdk.location.GeoPoint
import com.tomtom.sdk.map.display.MapOptions
import com.tomtom.sdk.map.display.camera.InitialCameraOptions
import com.tomtom.sdk.map.display.ui.MapFragment

class TomTomMapActivity : FragmentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (!TomTomSdk.isInitialized || BuildConfig.TOMTOM_NAVIGATION_SDK_KEY.isBlank()) {
      finish()
      return
    }

    val mapContainer = FrameLayout(this).apply { id = MAP_CONTAINER_ID }
    val mapStatus = TextView(this).apply {
      text = "Loading TomTom map..."
      textSize = 15f
      setTextColor(android.graphics.Color.WHITE)
      setBackgroundColor(0xCC17191A.toInt())
      setPadding(24, 16, 24, 16)
    }
    val root = FrameLayout(this).apply {
      addView(mapContainer, FrameLayout.LayoutParams(-1, -1))
      addView(
        mapStatus,
        FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply {
          topMargin = 48
        },
      )
    }
    setContentView(root)

    val mapFragment = MapFragment.newInstance(
      MapOptions(
        mapKey = BuildConfig.TOMTOM_NAVIGATION_SDK_KEY,
        initialCameraOptions = InitialCameraOptions.LocationBased(
          position = GeoPoint(latitude = 51.5072, longitude = -0.1276),
          zoom = 12.0,
        ),
      ),
    )

    supportFragmentManager.beginTransaction()
      .replace(MAP_CONTAINER_ID, mapFragment)
      .commit()

    mapFragment.getMapAsync {
      runOnUiThread { mapStatus.text = "TomTom map ready" }
    }
  }

  companion object {
    private const val MAP_CONTAINER_ID = 0x43520001
  }
}