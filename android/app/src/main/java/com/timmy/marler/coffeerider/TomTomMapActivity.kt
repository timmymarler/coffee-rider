package com.timmy.marler.coffeerider

import android.os.Bundle
import android.graphics.Color
import android.speech.tts.TextToSpeech
import android.view.Gravity
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import com.tomtom.sdk.init.TomTomSdk
import com.tomtom.sdk.init.createRoutePlanner
import com.tomtom.sdk.location.GeoLocation
import com.tomtom.sdk.location.GeoPoint
import com.tomtom.sdk.location.LocationProvider
import com.tomtom.sdk.map.display.MapOptions
import com.tomtom.sdk.map.display.camera.InitialCameraOptions
import com.tomtom.sdk.map.display.route.RouteOptions
import com.tomtom.sdk.map.display.ui.MapFragment
import com.tomtom.sdk.navigation.GuidanceUpdatedListener
import com.tomtom.sdk.navigation.NavigationOptions
import com.tomtom.sdk.navigation.ProgressUpdatedListener
import com.tomtom.sdk.navigation.RoutePlan
import com.tomtom.sdk.navigation.TomTomNavigation
import com.tomtom.sdk.navigation.guidance.GuidanceAnnouncement
import com.tomtom.sdk.navigation.guidance.InstructionPhase
import com.tomtom.sdk.navigation.guidance.instruction.GuidanceInstruction
import com.tomtom.sdk.routing.RoutePlanningCallback
import com.tomtom.sdk.routing.RoutePlanner
import com.tomtom.sdk.routing.RoutePlanningResponse
import com.tomtom.sdk.routing.RoutingFailure
import com.tomtom.sdk.routing.buildRoutePlanningOptions
import com.tomtom.sdk.routing.options.Itinerary
import com.tomtom.sdk.routing.route.Route
import com.tomtom.sdk.location.simulation.SimulationLocationProvider
import com.tomtom.sdk.location.simulation.strategy.InterpolationStrategy
import com.tomtom.quantity.Distance
import java.util.Locale

class TomTomMapActivity : FragmentActivity() {
  private var routePlanner: RoutePlanner? = null
  private var tomTomMap: com.tomtom.sdk.map.display.TomTomMap? = null
  private var plannedRoute: Route? = null
  private var plannedOptions: com.tomtom.sdk.routing.options.RoutePlanningOptions? = null
  private var simulatedLocationProvider: LocationProvider? = null
  private var originalLocationProvider: LocationProvider? = null
  private var progressListener: ProgressUpdatedListener? = null
  private var guidanceListener: GuidanceUpdatedListener? = null
  private var textToSpeech: TextToSpeech? = null
  private lateinit var mapStatus: TextView
  private lateinit var announcementStatus: TextView
  private lateinit var guidanceButton: Button

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (!TomTomSdk.isInitialized || BuildConfig.TOMTOM_NAVIGATION_SDK_KEY.isBlank()) {
      finish()
      return
    }

    textToSpeech = TextToSpeech(this) { result ->
      if (result == TextToSpeech.SUCCESS) {
        textToSpeech?.language = Locale.UK
      }
    }

    val mapContainer = FrameLayout(this).apply { id = MAP_CONTAINER_ID }
    mapStatus = TextView(this).apply {
      text = "Loading TomTom map..."
      textSize = 15f
      setTextColor(android.graphics.Color.WHITE)
      setBackgroundColor(0xCC17191A.toInt())
      setPadding(24, 16, 24, 16)
    }
    announcementStatus = TextView(this).apply {
      text = ""
      textSize = 15f
      setTextColor(android.graphics.Color.WHITE)
      setBackgroundColor(0xCC17191A.toInt())
      setPadding(24, 16, 24, 16)
      visibility = android.view.View.GONE
    }
    guidanceButton = Button(this).apply {
      text = "Plan a route first"
      isEnabled = false
      setOnClickListener {
        if (simulatedLocationProvider == null) startSimulatedGuidance() else stopSimulatedGuidance()
      }
    }
    val root = FrameLayout(this).apply {
      addView(mapContainer, FrameLayout.LayoutParams(-1, -1))
      addView(
        mapStatus,
        FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply {
          topMargin = 48
        },
      )
      addView(
        announcementStatus,
        FrameLayout.LayoutParams(-1, -2, Gravity.TOP).apply {
          topMargin = 132
        },
      )
      addView(
        guidanceButton,
        FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM).apply {
          leftMargin = 24
          rightMargin = 24
          bottomMargin = 112
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
      tomTomMap = it
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
    plannedOptions = options
    routePlanner?.planRoute(options, object : RoutePlanningCallback {
      override fun onSuccess(result: RoutePlanningResponse) {
        val route: Route? = result.routes.firstOrNull()
        if (route == null) {
          runOnUiThread { mapStatus.text = "Route planning returned no route" }
          return
        }

        plannedRoute = route
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
          guidanceButton.text = "Simulate route guidance"
          guidanceButton.isEnabled = true
        }
      }

      override fun onFailure(failure: RoutingFailure) {
        runOnUiThread { mapStatus.text = "Route failed · ${failure.message}" }
      }
    })
  }

  private fun startSimulatedGuidance() {
    val route = plannedRoute ?: return
    val routeOptions = plannedOptions ?: return
    val map = tomTomMap ?: return
    val navigation = TomTomSdk.navigation
    val simulatedLocations = route.geometry.map { point -> GeoLocation(position = point) }
    val provider = SimulationLocationProvider.create(InterpolationStrategy(simulatedLocations))
    val progressUpdatedListener = ProgressUpdatedListener { progress ->
      runOnUiThread {
        mapStatus.text = "Guidance · ${progress.distanceAlongRoute.inWholeMeters()} m traveled · " +
          "${progress.remainingDistance.inWholeMeters()} m remaining"
      }
    }
    val guidanceUpdatedListener = object : GuidanceUpdatedListener {
      override fun onInstructionsChanged(instructions: List<GuidanceInstruction>) = Unit

      override fun onAnnouncementGenerated(announcement: GuidanceAnnouncement, shouldPlay: Boolean) {
        if (shouldPlay) {
          val message = announcement.plainTextMessage
          runOnUiThread {
            announcementStatus.text = "Voice · $message"
            announcementStatus.visibility = android.view.View.VISIBLE
            textToSpeech?.speak(
              message,
              TextToSpeech.QUEUE_FLUSH,
              null,
              "tomtom-guidance-${announcement.id}",
            )
          }
        }
      }

      override fun onDistanceToNextInstructionChanged(
        distance: Distance,
        instructions: List<GuidanceInstruction>,
        currentPhase: InstructionPhase,
      ) {
        runOnUiThread {
          mapStatus.text = "${distance.inWholeMeters()} m to next maneuver · $currentPhase"
        }
      }
    }

    try {
      originalLocationProvider = navigation.locationProvider
      navigation.locationProvider = provider
      map.setLocationProvider(provider)
      provider.enable()
      navigation.configuration.update { guidanceAnnouncementsEnabled = true }
      navigation.addProgressUpdatedListener(progressUpdatedListener)
      navigation.addGuidanceUpdatedListener(guidanceUpdatedListener)
      navigation.start(NavigationOptions(RoutePlan(route, routeOptions)))
      simulatedLocationProvider = provider
      this.progressListener = progressUpdatedListener
      this.guidanceListener = guidanceUpdatedListener
      guidanceButton.text = "Stop simulated guidance"
      mapStatus.text = "Starting simulated route guidance..."
    } catch (error: Throwable) {
      provider.close()
      mapStatus.text = "Guidance failed · ${error.message ?: "unknown error"}"
    }
  }

  private fun stopSimulatedGuidance() {
    val navigation = TomTomSdk.navigation
    progressListener?.let(navigation::removeProgressUpdatedListener)
    guidanceListener?.let(navigation::removeGuidanceUpdatedListener)
    progressListener = null
    guidanceListener = null
    navigation.stop()
    simulatedLocationProvider?.disable()
    simulatedLocationProvider?.close()
    simulatedLocationProvider = null
    originalLocationProvider?.let { provider ->
      navigation.locationProvider = provider
      tomTomMap?.setLocationProvider(provider)
    }
    originalLocationProvider = null
    guidanceButton.text = "Simulate route guidance"
    mapStatus.text = "TomTom route ready · ${plannedRoute?.geometry?.size ?: 0} points"
  }

  override fun onDestroy() {
    if (simulatedLocationProvider != null) stopSimulatedGuidance()
    routePlanner?.close()
    routePlanner = null
    textToSpeech?.stop()
    textToSpeech?.shutdown()
    textToSpeech = null
    super.onDestroy()
  }

  companion object {
    private const val MAP_CONTAINER_ID = 0x43520001
  }
}