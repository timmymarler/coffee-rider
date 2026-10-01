package com.timmy.marler.coffeerider

import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import com.tomtom.sdk.init.TomTomSdk
import com.tomtom.sdk.init.createRoutePlanner
import com.tomtom.sdk.location.GeoPoint
import com.tomtom.sdk.map.display.MapOptions
import com.tomtom.sdk.map.display.camera.InitialCameraOptions
import com.tomtom.sdk.map.display.route.RouteOptions
import com.tomtom.sdk.map.display.ui.MapFragment
import com.tomtom.sdk.routing.RoutePlanningCallback
import com.tomtom.sdk.routing.RoutePlanner
import com.tomtom.sdk.routing.RoutePlanningResponse
import com.tomtom.sdk.routing.RoutingFailure
import com.tomtom.sdk.routing.buildRoutePlanningOptions
import com.tomtom.sdk.routing.options.Itinerary
import com.tomtom.sdk.routing.route.Route

class TomTomMapActivity : FragmentActivity() {
  private var routePlanner: RoutePlanner? = null

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
      runOnUiThread { mapStatus.text = "Map ready · planning sample route..." }
      planSampleRoute(it, mapStatus)
    }
  }

  private fun planSampleRoute(
    tomTomMap: com.tomtom.sdk.map.display.TomTomMap,
    mapStatus: TextView,
  ) {
    val origin = GeoPoint(latitude = 51.5007, longitude = -0.1246)
    val destination = GeoPoint(latitude = 51.4826, longitude = -0.0077)
    routePlanner = TomTomSdk.createRoutePlanner()

    val options = buildRoutePlanningOptions(
      itinerary = Itinerary(origin = origin, destination = destination),
    )
    routePlanner?.planRoute(options, object : RoutePlanningCallback {
      override fun onSuccess(result: RoutePlanningResponse) {
        val route: Route? = result.routes.firstOrNull()
        if (route == null) {
          runOnUiThread { mapStatus.text = "Route planning returned no route" }
          return
        }

        runOnUiThread {
          tomTomMap.addRoute(
            RouteOptions(
              geometry = route.geometry,
              color = Color.rgb(37, 125, 186),
              departureMarkerVisible = true,
              destinationMarkerVisible = true,
            ),
          )
          tomTomMap.zoomToRoutes(72)
          mapStatus.text = "TomTom route ready · ${route.geometry.size} points"
        }
      }

      override fun onFailure(failure: RoutingFailure) {
        runOnUiThread { mapStatus.text = "Route failed · ${failure.message}" }
      }
    })
  }

  override fun onDestroy() {
    routePlanner?.close()
    routePlanner = null
    super.onDestroy()
  }

  companion object {
    private const val MAP_CONTAINER_ID = 0x43520001
  }
}