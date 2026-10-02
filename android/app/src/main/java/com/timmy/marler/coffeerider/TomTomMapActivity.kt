package com.timmy.marler.coffeerider

import android.os.Bundle
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
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
import com.tomtom.sdk.map.display.image.ImageFactory
import com.tomtom.sdk.map.display.marker.Label
import com.tomtom.sdk.map.display.marker.MarkerOptions
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
import org.json.JSONArray

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
  private var coffeeShopMarkerCount = 0
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
      coffeeShopMarkerCount = addCoffeeShopMarkers(it)
      runOnUiThread { mapStatus.text = "Map ready · $coffeeShopMarkerCount Coffee Rider cafés · planning route..." }
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
          mapStatus.text = "TomTom route ready · ${route.geometry.size} points · " +
            "$coffeeShopMarkerCount Coffee Rider cafés"
          guidanceButton.text = "Simulate route guidance"
          guidanceButton.isEnabled = true
        }
      }

      override fun onFailure(failure: RoutingFailure) {
        runOnUiThread { mapStatus.text = "Route failed · ${failure.message}" }
      }
    })
  }

  private fun addCoffeeShopMarkers(map: com.tomtom.sdk.map.display.TomTomMap): Int {
    val coffeeShops = try {
      JSONArray(intent.getStringExtra(EXTRA_COFFEE_SHOPS) ?: "[]")
    } catch (_: Exception) {
      JSONArray()
    }
    val pinImage = ImageFactory.fromBitmap(createCoffeeShopPin())

    for (index in 0 until coffeeShops.length()) {
      val shop = coffeeShops.optJSONObject(index) ?: continue
      val name = shop.optString("name").trim().ifEmpty { "Coffee shop" }
      val latitude = shop.optDouble("latitude", Double.NaN)
      val longitude = shop.optDouble("longitude", Double.NaN)
      if (!latitude.isFinite() || !longitude.isFinite() || latitude !in -90.0..90.0 || longitude !in -180.0..180.0) {
        continue
      }

      val marker = map.addMarker(
        MarkerOptions(
          coordinate = GeoPoint(latitude = latitude, longitude = longitude),
          pinImage = pinImage,
          label = Label(text = name, textColor = Color.rgb(38, 45, 41), textSize = 12.0),
        ),
      )
      marker.tag = name
    }

    map.addMarkerClickListener { marker ->
      val name = marker.tag as? String
      if (name != null) runOnUiThread { mapStatus.text = name }
    }
    return (0 until coffeeShops.length()).count { index ->
      val shop = coffeeShops.optJSONObject(index) ?: return@count false
      shop.optDouble("latitude", Double.NaN).isFinite() && shop.optDouble("longitude", Double.NaN).isFinite()
    }
  }

  private fun createCoffeeShopPin(): Bitmap {
    val bitmap = Bitmap.createBitmap(72, 88, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val pin = Path().apply {
      moveTo(36f, 86f)
      cubicTo(29f, 72f, 7f, 51f, 7f, 31f)
      cubicTo(7f, 14f, 20f, 4f, 36f, 4f)
      cubicTo(52f, 4f, 65f, 14f, 65f, 31f)
      cubicTo(65f, 51f, 43f, 72f, 36f, 86f)
      close()
    }
    paint.color = Color.rgb(29, 91, 75)
    canvas.drawPath(pin, paint)
    paint.color = Color.WHITE
    canvas.drawCircle(36f, 31f, 18f, paint)
    paint.color = Color.rgb(29, 91, 75)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 3f
    canvas.drawRoundRect(27f, 27f, 42f, 39f, 2f, 2f, paint)
    canvas.drawLine(29f, 41f, 41f, 41f, paint)
    canvas.drawArc(34f, 16f, 41f, 28f, 190f, 150f, false, paint)
    return bitmap
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
    const val EXTRA_COFFEE_SHOPS = "tomtom_poc_coffee_shops"
  }
}