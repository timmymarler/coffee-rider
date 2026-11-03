package com.timmy.marler.coffeerider

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.tomtom.sdk.location.GeoLocation
import com.tomtom.sdk.location.LocationProvider
import com.tomtom.sdk.location.OnLocationUpdateListener
import com.tomtom.sdk.location.simulation.SimulationLocationProvider
import com.tomtom.sdk.location.simulation.strategy.InterpolationStrategy
import com.tomtom.sdk.navigation.NavigationOptions
import com.tomtom.sdk.navigation.RoutePlan
import com.tomtom.sdk.navigation.ProgressUpdatedListener
import com.tomtom.sdk.navigation.GuidanceUpdatedListener
import com.tomtom.sdk.navigation.DestinationArrivalListener
import com.tomtom.sdk.navigation.ActiveRouteChangedListener
import com.tomtom.sdk.navigation.RouteAddedListener
import com.tomtom.sdk.navigation.RouteTrackingStateUpdatedListener
import com.tomtom.sdk.navigation.WaypointArrivalListener
import com.tomtom.sdk.routing.route.RouteStop
import com.tomtom.sdk.navigation.replanning.DeviationReplanningMode
import com.tomtom.sdk.navigation.guidance.GuidanceAnnouncement
import android.media.AudioAttributes
import com.tomtom.sdk.navigation.guidance.InstructionPhase
import com.tomtom.sdk.navigation.guidance.instruction.GuidanceInstruction
import com.tomtom.sdk.navigation.guidance.instruction.ExitRoundaboutGuidanceInstruction
import com.tomtom.sdk.navigation.guidance.instruction.RoundaboutGuidanceInstruction
import com.tomtom.quantity.Distance
import java.util.UUID
import com.tomtom.sdk.common.configuration.buildSdkConfiguration
import com.tomtom.sdk.init.TomTomSdk
import com.tomtom.sdk.init.createRoutePlanner
import com.tomtom.sdk.location.GeoPoint
import com.tomtom.sdk.routing.RoutePlanningCallback
import com.tomtom.sdk.routing.RoutePlanningResponse
import com.tomtom.sdk.routing.RoutingFailure
import com.tomtom.sdk.routing.common.BetaRoutePlanningOptionsBuilderApi
import com.tomtom.sdk.routing.options.Itinerary
import com.tomtom.sdk.routing.options.buildRoutePlanningOptions
import com.tomtom.sdk.routing.options.calculation.AvoidType
import com.tomtom.sdk.routing.options.calculation.Hilliness
import com.tomtom.sdk.routing.options.calculation.RouteType
import com.tomtom.sdk.routing.options.calculation.Windingness
import com.tomtom.sdk.routing.route.Route
import com.tomtom.sdk.routing.route.instruction.Instruction
import com.tomtom.sdk.routing.route.instruction.arrival.ArrivalInstruction
import com.tomtom.sdk.routing.route.instruction.departure.DepartureInstruction
import com.tomtom.sdk.routing.route.instruction.roundabout.ExitRoundaboutInstruction
import com.tomtom.sdk.routing.route.instruction.roundabout.RoundaboutInstruction
import com.tomtom.sdk.routing.route.instruction.turn.TurnInstruction
import com.tomtom.sdk.telemetry.UserConsent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.Locale

class TomTomNavigationModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val plannedRoutes = java.util.concurrent.ConcurrentHashMap<String, RoutePlan>()
  private var activeRouteId: String? = null
  private var simulationProvider: LocationProvider? = null
  private var originalLocationProvider: LocationProvider? = null
  private var progressListener: ProgressUpdatedListener? = null
  private var guidanceListener: GuidanceUpdatedListener? = null
  private var locationListener: OnLocationUpdateListener? = null
  private var arrivalListener: DestinationArrivalListener? = null
  private var activeRouteListener: ActiveRouteChangedListener? = null
  private var routeAddedListener: RouteAddedListener? = null
  private var currentRoutePlan: RoutePlan? = null
  private var pendingActiveRoute: Route? = null
  private var trackingListener: RouteTrackingStateUpdatedListener? = null
  private var previousDeviationMode = DeviationReplanningMode.None
  private var hasDeviated = false
  private var waypointListener: WaypointArrivalListener? = null
  @Volatile private var currentGuidanceInstructions: List<GuidanceInstruction> = emptyList()
  @Volatile private var pendingRoundaboutExitText: String? = null
  private var roundaboutExitNumber: Int? = null
  private var roundaboutTurnAngle: Double? = null
  private val sessionRoutePlans = mutableMapOf<String, RoutePlan>()
  private var androidTts: android.speech.tts.TextToSpeech? = null
  @Volatile private var ttsReady = false
  @Volatile private var guidanceVoiceEnabled = true
  private var pendingAnnouncement: String? = null

  override fun getName(): String = NAME

  override fun getConstants(): Map<String, Any> = mapOf(
    "testerBuild" to BuildConfig.TOMTOM_TESTER_BUILD,
  )

  @ReactMethod
  fun isTesterBuild(promise: Promise) {
    promise.resolve(BuildConfig.TOMTOM_TESTER_BUILD)
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(statusMap())
  }

  @ReactMethod
  fun initialize(telemetryEnabled: Boolean, promise: Promise) {
    if (BuildConfig.TOMTOM_NAVIGATION_SDK_KEY.isBlank()) {
      promise.reject("E_TOMTOM_KEY_MISSING", "TomTom Navigation SDK API key is not configured")
      return
    }

    scope.launch {
      try {
        if (!TomTomSdk.isInitialized) {
          val consent = if (telemetryEnabled) UserConsent.TelemetryOn else UserConsent.TelemetryOff
          val configuration = buildSdkConfiguration(
            context = reactApplicationContext.applicationContext,
            apiKey = BuildConfig.TOMTOM_NAVIGATION_SDK_KEY,
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

  @ReactMethod
  @OptIn(BetaRoutePlanningOptionsBuilderApi::class)
  fun planRoute(
    origin: ReadableMap,
    destination: ReadableMap,
    waypoints: ReadableArray,
    travelMode: String,
    routeType: String,
    hilliness: String,
    windingness: String,
    avoidTypes: ReadableArray,
    promise: Promise,
  ) {
    if (!TomTomSdk.isInitialized) {
      promise.reject("E_TOMTOM_NOT_INITIALIZED", "Initialize the TomTom SDK before planning a route")
      return
    }

    val originPoint = origin.toGeoPoint()
    val destinationPoint = destination.toGeoPoint()
    if (originPoint == null || destinationPoint == null) {
      promise.reject("E_TOMTOM_INVALID_COORDINATES", "Route origin and destination must contain valid coordinates")
      return
    }

    val waypointPoints = (0 until waypoints.size()).mapNotNull { index ->
      waypoints.getMap(index)?.toGeoPoint()
    }
    val itinerary = Itinerary(
      origin = originPoint,
      destination = destinationPoint,
      waypoints = waypointPoints,
    )
    val sdkRouteType = createRouteType(routeType, hilliness, windingness)
    val avoidTypeMap = mapOf(
      "motorways" to AvoidType.Motorways,
      "tollRoads" to AvoidType.TollRoads,
      "unpavedRoads" to AvoidType.UnpavedRoads,
      "ferries" to AvoidType.Ferries,
    )
    val selectedAvoids = (0 until avoidTypes.size())
      .mapNotNull { index -> avoidTypes.getString(index)?.let(avoidTypeMap::get) }
      .toSet()
    val planner = TomTomSdk.createRoutePlanner()
    val baseOptions = buildRoutePlanningOptions(itinerary) {
      this.routeType = sdkRouteType
      maxAlternatives = MAX_ROUTE_ALTERNATIVES
      avoids = selectedAvoids
    }
    val options = baseOptions

    try {
      planner.planRoute(options, object : RoutePlanningCallback {
        override fun onSuccess(result: RoutePlanningResponse) {
          val routes = result.routes.take(MAX_ROUTE_ALTERNATIVES + 1)
          val route = routes.firstOrNull()
          if (route == null) {
            planner.close()
            promise.reject("E_TOMTOM_NO_ROUTE", "TomTom SDK returned no route")
            return
          }
          val routeIds = routes.map { UUID.randomUUID().toString() }
          if (plannedRoutes.size >= 8) {
            plannedRoutes.keys.filter { it != activeRouteId }.forEach(plannedRoutes::remove)
          }
          routes.forEachIndexed { index, plannedRoute ->
            plannedRoutes[routeIds[index]] = RoutePlan(plannedRoute, options)
          }
          val alternatives = Arguments.createArray()
          routes.drop(1).forEachIndexed { index, alternative ->
            alternatives.pushMap(alternative.toWritableSummaryMap(routeIds[index + 1], index + 2))
          }
          promise.resolve(route.toWritableMap(routeIds.first()).apply {
            putArray("alternatives", alternatives)
          })
          planner.close()
        }

        override fun onFailure(failure: RoutingFailure) {
          planner.close()
          promise.reject("E_TOMTOM_ROUTE_PLANNING", failure.message ?: "TomTom SDK route planning failed")
        }
      })
    } catch (error: Throwable) {
      planner.close()
      promise.reject("E_TOMTOM_ROUTE_PLANNING", error.message, error)
    }
  }

  @ReactMethod
  fun hasPlannedRoute(routeId: String, promise: Promise) {
    promise.resolve(plannedRoutes.containsKey(routeId))
  }

  @ReactMethod
  fun getPlannedRoute(routeId: String, promise: Promise) {
    val plan = plannedRoutes[routeId]
    if (plan == null) {
      promise.reject("E_TOMTOM_ROUTE_EXPIRED", "This route choice is no longer available; plan the route again")
      return
    }
    promise.resolve(plan.route.toWritableMap(routeId))
  }

  @ReactMethod
  fun startNavigation(routeId: String, simulate: Boolean, promise: Promise) {
    val plan = plannedRoutes[routeId]
    if (!TomTomSdk.isInitialized || plan == null) {
      promise.reject("E_TOMTOM_ROUTE_EXPIRED", "Plan this route again before starting SDK navigation")
      return
    }
    reactApplicationContext.runOnUiQueueThread {
      try {
        stopNavigationSession()
        val navigation = TomTomSdk.navigation
        activeRouteId = routeId
        currentRoutePlan = plan
        sessionRoutePlans[plan.route.id.toString()] = plan
        routeAddedListener = RouteAddedListener { route, options, reason ->
          if (activeRouteId != routeId) return@RouteAddedListener
          sessionRoutePlans[route.id.toString()] = RoutePlan(route, options)
          if (pendingActiveRoute?.id == route.id) applyActiveRoute(route)
        }.also(navigation::addRouteAddedListener)
        activeRouteListener = ActiveRouteChangedListener { route ->
          if (activeRouteId == routeId) applyActiveRoute(route)
        }.also(navigation::addActiveRouteChangedListener)
        trackingListener = RouteTrackingStateUpdatedListener { state ->
          if (activeRouteId != routeId || hasDeviated == state.hasDeviated) return@RouteTrackingStateUpdatedListener
          hasDeviated = state.hasDeviated
          emitNavigationEvent("deviation", Arguments.createMap().apply {
            putBoolean("hasDeviated", hasDeviated)
          })
        }.also(navigation::addRouteTrackingStateUpdatedListener)
        previousDeviationMode = navigation.deviationReplanningMode
        navigation.deviationReplanningMode = DeviationReplanningMode.Automatic
        waypointListener = object : WaypointArrivalListener {
          override fun onWaypointArrived(waypoint: RouteStop, route: Route) {
            if (activeRouteId != routeId) return
            val coordinate = waypoint.navigableCoordinates.firstOrNull() ?: return
            emitNavigationEvent("waypointArrived", coordinate.toWritableMap())
          }

          override fun onWaypointDeparted(waypoint: RouteStop, route: Route) = Unit
        }.also(navigation::addWaypointArrivalListener)
        if (simulate) {
          val provider = SimulationLocationProvider.create(
            InterpolationStrategy(plan.route.geometry.map { GeoLocation(position = it) }),
          )
          originalLocationProvider = navigation.locationProvider
          simulationProvider = provider
          navigation.locationProvider = provider
        }
        locationListener = OnLocationUpdateListener { location ->
          emitNavigationEvent("location", Arguments.createMap().apply {
            putDouble("latitude", location.position.latitude)
            putDouble("longitude", location.position.longitude)
          })
        }.also(navigation.locationProvider::addOnLocationUpdateListener)
        navigation.locationProvider.enable()
        updateMapProviders()
        progressListener = ProgressUpdatedListener { progress ->
          emitNavigationEvent("progress", Arguments.createMap().apply {
            putDouble("distanceAlongRoute", progress.distanceAlongRoute.inWholeMeters().toDouble())
            putDouble("remainingDistance", progress.remainingDistance.inWholeMeters().toDouble())
            putDouble("remainingTime", progress.remainingTime.inWholeSeconds.toDouble())
          })
        }.also(navigation::addProgressUpdatedListener)
        guidanceListener = object : GuidanceUpdatedListener {
          override fun onInstructionsChanged(instructions: List<GuidanceInstruction>) {
            currentGuidanceInstructions = instructions
            emitSdkGuidanceInstruction(instructions)
          }

          override fun onAnnouncementGenerated(announcement: GuidanceAnnouncement, shouldPlay: Boolean) {
            if (!shouldPlay) return
            val message = announcement.plainTextMessage
            if (
              message.contains("exit", ignoreCase = true) &&
              currentGuidanceInstructions.any { it is ExitRoundaboutGuidanceInstruction }
            ) {
              pendingRoundaboutExitText = message
            }
            val playedNatively = guidanceVoiceEnabled
            if (playedNatively) speakGuidanceAnnouncement(message)
            emitNavigationEvent("announcement", Arguments.createMap().apply {
              putString("message", message)
              putBoolean("playedNatively", playedNatively)
            })
          }

          override fun onDistanceToNextInstructionChanged(
            distance: Distance,
            instructions: List<GuidanceInstruction>,
            currentPhase: InstructionPhase,
          ) {
            currentGuidanceInstructions = instructions
            emitSdkGuidanceInstruction(instructions)
            emitNavigationEvent("guidance", Arguments.createMap().apply {
              putDouble("distanceToNextInstruction", distance.inWholeMeters().toDouble())
              putString("phase", currentPhase.toString())
            })
          }
        }.also(navigation::addGuidanceUpdatedListener)
        arrivalListener = DestinationArrivalListener {
          emitNavigationEvent("arrived", Arguments.createMap())
          reactApplicationContext.runOnUiQueueThread { stopNavigationSession() }
        }.also(navigation::addDestinationArrivalListener)
        ensureAnnouncementTts()
        requestNotificationPermissionIfNeeded()
        NavigationForegroundService.start(reactApplicationContext.applicationContext)
        navigation.configuration.update { guidanceAnnouncementsEnabled = true }
        navigation.start(NavigationOptions(plan))
        emitNavigationEvent("started", Arguments.createMap().apply { putBoolean("simulated", simulate) })
        promise.resolve(null)
      } catch (error: Throwable) {
        stopNavigationSession()
        promise.reject("E_TOMTOM_NAVIGATION_START", error.message, error)
      }
    }
  }

  @ReactMethod
  fun simulateOffRoute(promise: Promise) {
    if ((!BuildConfig.DEBUG && !BuildConfig.TOMTOM_TESTER_BUILD) || simulationProvider == null || activeRouteId == null) {
      promise.reject("E_TOMTOM_SIMULATION_REQUIRED", "Start simulated SDK guidance before testing a detour")
      return
    }
    reactApplicationContext.runOnUiQueueThread {
      try {
        val route = currentRoutePlan?.route ?: error("No active SDK route")
        val position = simulationProvider?.lastKnownLocation?.position ?: route.geometry.first()
        val nearestIndex = route.geometry.indices.minByOrNull { index ->
          val point = route.geometry[index]
          val latitudeDifference = point.latitude - position.latitude
          val longitudeDifference = point.longitude - position.longitude
          latitudeDifference * latitudeDifference + longitudeDifference * longitudeDifference
        } ?: 0
        val remaining = route.geometry.drop(nearestIndex)
        val detour = remaining.take(20).map { point ->
          GeoLocation(position = GeoPoint(point.latitude, (point.longitude + 0.004).coerceIn(-180.0, 180.0)))
        }
        val provider = SimulationLocationProvider.create(InterpolationStrategy(
          listOf(GeoLocation(position = position)) + detour + remaining.drop(20).map { GeoLocation(position = it) },
        ))
        val navigation = TomTomSdk.navigation
        simulationProvider?.let { oldProvider ->
          locationListener?.let(oldProvider::removeOnLocationUpdateListener)
          oldProvider.disable()
        }
        val oldProvider = simulationProvider
        navigation.locationProvider = provider
        simulationProvider = provider
        locationListener?.let(provider::addOnLocationUpdateListener)
        updateMapProviders()
        provider.enable()
        oldProvider?.close()
        promise.resolve(null)
      } catch (error: Throwable) {
        promise.reject("E_TOMTOM_DETOUR_SIMULATION", error.message, error)
      }
    }
  }

  @ReactMethod
  fun stopNavigation(promise: Promise) {
    reactApplicationContext.runOnUiQueueThread {
      try {
        stopNavigationSession()
        promise.resolve(null)
      } catch (error: Throwable) {
        promise.reject("E_TOMTOM_NAVIGATION_STOP", error.message, error)
      }
    }
  }

  @ReactMethod
  fun setVoiceEnabled(enabled: Boolean, promise: Promise) {
    guidanceVoiceEnabled = enabled
    if (!enabled) {
      androidTts?.stop()
      pendingAnnouncement = null
    }
    promise.resolve(null)
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val activity = reactApplicationContext.currentActivity ?: return
    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
    ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
  }

  private fun ensureAnnouncementTts() {
    if (androidTts != null) return
    androidTts = android.speech.tts.TextToSpeech(reactApplicationContext.applicationContext) { status ->
      ttsReady = status == android.speech.tts.TextToSpeech.SUCCESS
      if (ttsReady) {
        androidTts?.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        )
        androidTts?.language = Locale.UK
        val pending = pendingAnnouncement
        pendingAnnouncement = null
        if (pending != null) speakGuidanceAnnouncement(pending)
      }
    }
  }

  private fun speakGuidanceAnnouncement(message: String) {
    val tts = androidTts ?: return
    if (!ttsReady) {
      pendingAnnouncement = message
      return
    }
    tts.speak(
      message,
      android.speech.tts.TextToSpeech.QUEUE_FLUSH,
      null,
      "cr-guidance-${System.currentTimeMillis()}",
    )
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  private fun emitNavigationEvent(type: String, payload: com.facebook.react.bridge.WritableMap) {
    if (!reactApplicationContext.hasActiveReactInstance()) return
    payload.putString("type", type)
    payload.putString("routeId", activeRouteId)
    reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("TomTomNavigationEvent", payload)
  }

  private fun stopNavigationSession() {
    NavigationForegroundService.stop(reactApplicationContext.applicationContext)
    androidTts?.stop()
    pendingAnnouncement = null
    if (!TomTomSdk.isInitialized || activeRouteId == null) return
    val navigation = TomTomSdk.navigation
    progressListener?.let(navigation::removeProgressUpdatedListener)
    guidanceListener?.let(navigation::removeGuidanceUpdatedListener)
    arrivalListener?.let(navigation::removeDestinationArrivalListener)
    activeRouteListener?.let(navigation::removeActiveRouteChangedListener)
    routeAddedListener?.let(navigation::removeRouteAddedListener)
    trackingListener?.let(navigation::removeRouteTrackingStateUpdatedListener)
    waypointListener?.let(navigation::removeWaypointArrivalListener)
    locationListener?.let(navigation.locationProvider::removeOnLocationUpdateListener)
    progressListener = null
    guidanceListener = null
    locationListener = null
    arrivalListener = null
    activeRouteListener = null
    routeAddedListener = null
    currentRoutePlan = null
    pendingActiveRoute = null
    trackingListener = null
    waypointListener = null
    hasDeviated = false
    currentGuidanceInstructions = emptyList()
    pendingRoundaboutExitText = null
    roundaboutExitNumber = null
    roundaboutTurnAngle = null
    sessionRoutePlans.clear()
    navigation.deviationReplanningMode = previousDeviationMode
    navigation.stop()
    simulationProvider?.disable()
    originalLocationProvider?.let { navigation.locationProvider = it }
    updateMapProviders()
    simulationProvider?.close()
    simulationProvider = null
    originalLocationProvider = null
    emitNavigationEvent("stopped", Arguments.createMap())
    activeRouteId = null
  }

  private fun applyActiveRoute(route: Route) {
    val routeId = activeRouteId ?: return
    if (currentRoutePlan?.route?.id == route.id) return
    val updatedPlan = sessionRoutePlans[route.id.toString()]
    if (updatedPlan == null) {
      pendingActiveRoute = route
      return
    }
    pendingActiveRoute = null
    pendingRoundaboutExitText = null
    roundaboutExitNumber = null
    roundaboutTurnAngle = null
    currentRoutePlan = updatedPlan
    plannedRoutes[routeId] = updatedPlan
    emitNavigationEvent("routeChanged", Arguments.createMap().apply {
      putMap("route", route.toWritableMap(routeId))
    })
    sessionRoutePlans.keys.filter { it != route.id.toString() }.forEach(sessionRoutePlans::remove)
  }

  override fun invalidate() {
    androidTts?.stop()
    androidTts?.shutdown()
    androidTts = null
    ttsReady = false
    pendingAnnouncement = null
    reactApplicationContext.runOnUiQueueThread { stopNavigationSession() }
    plannedRoutes.clear()
    super.invalidate()
  }

  private fun emitSdkGuidanceInstruction(instructions: List<GuidanceInstruction>, displayText: String? = null) {
    val instruction = instructions.firstOrNull() ?: return
    val isRoundaboutExit = instruction is ExitRoundaboutGuidanceInstruction
    if (instruction is RoundaboutGuidanceInstruction) {
      roundaboutExitNumber = instruction.exitNumber
      roundaboutTurnAngle = instruction.turnAngle.inDegrees()
    } else if (!isRoundaboutExit) {
      roundaboutExitNumber = null
      roundaboutTurnAngle = null
    }
    val roundaboutDisplayText = if (isRoundaboutExit) {
      displayText ?: pendingRoundaboutExitText.also { pendingRoundaboutExitText = null }
    } else {
      null
    }
    emitNavigationEvent("instruction", Arguments.createMap().apply {
      putString("instructionType", instruction.javaClass.simpleName)
      putDouble("routeOffsetMeters", instruction.routeOffset.inWholeMeters().toDouble())
      putDouble("latitude", instruction.maneuverPoint.latitude)
      putDouble("longitude", instruction.maneuverPoint.longitude)
      putString("roadName", instruction.nextSignificantRoad?.name.orEmpty())
      putString("intersectionName", instruction.intersectionName.orEmpty())
      putBoolean("combineWithNext", instruction.combineWithNext)
      putString("drivingSide", instruction.drivingSide.toString())
      roundaboutExitNumber?.let { putInt("roundaboutExitNumber", it) }
      roundaboutTurnAngle?.let { putDouble("roundaboutTurnAngle", it) }
      roundaboutDisplayText?.let { putString("displayText", it) }
      instruction.signpost?.let { signpost ->
        putString("signpostExitNumber", signpost.exitNumber.orEmpty())
        putString("signpostExitName", signpost.exitName.orEmpty())
        putString("signpostTowardName", signpost.towardName.orEmpty())
      }
    })
  }

  @ReactMethod
  fun openMapDemo(coffeeShopsJson: String, promise: Promise) {
    if (!TomTomSdk.isInitialized) {
      promise.reject("E_TOMTOM_NOT_INITIALIZED", "Initialize the TomTom SDK before opening the map")
      return
    }

    try {
      val intent = Intent(reactApplicationContext, TomTomMapActivity::class.java)
        .putExtra(TomTomMapActivity.EXTRA_COFFEE_SHOPS, coffeeShopsJson)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("E_TOMTOM_MAP_LAUNCH", error.message, error)
    }
  }

  private fun statusMap() = Arguments.createMap().apply {
    putBoolean("available", true)
    putBoolean("configured", BuildConfig.TOMTOM_NAVIGATION_SDK_KEY.isNotBlank())
    putBoolean("initialized", TomTomSdk.isInitialized)
    putString("platform", "android")
    putString("sdkVersion", SDK_VERSION)
  }

  private fun ReadableMap.toGeoPoint(): GeoPoint? {
    if (!hasKey("latitude") || !hasKey("longitude")) return null
    val latitude = getDouble("latitude")
    val longitude = getDouble("longitude")
    if (!latitude.isFinite() || !longitude.isFinite() || latitude !in -90.0..90.0 || longitude !in -180.0..180.0) {
      return null
    }
    return GeoPoint(latitude, longitude)
  }

  private fun createRouteType(routeType: String, hilliness: String, windingness: String): RouteType = when (routeType.lowercase()) {
    "short", "shortest" -> RouteType.Short
    "eco", "efficient" -> RouteType.Efficient
    "thrilling", "curvy", "twisty", "adventure", "scenic", "custom" -> RouteType.Thrilling(
      hilliness = hilliness.toHilliness(),
      windingness = windingness.toWindingness(),
    )
    else -> RouteType.Fast
  }

  private fun String.toHilliness() = when (lowercase()) {
    "low" -> Hilliness.Low
    "high" -> Hilliness.High
    else -> Hilliness.Normal
  }

  private fun String.toWindingness() = when (lowercase()) {
    "low" -> Windingness.Low
    "high" -> Windingness.High
    else -> Windingness.Normal
  }

  private fun Route.toWritableSummaryMap(routeId: String, routeNumber: Int) = Arguments.createMap().apply {
    putString("nativeRouteId", routeId)
    putString("label", "Route $routeNumber")
    putString("routeFingerprint", routeFingerprint())
    putDouble("distance", summary.length.inWholeMeters().toDouble())
    putDouble("duration", summary.travelTime.inWholeSeconds.toDouble())
  }

  private fun Route.toWritableMap(routeId: String) = Arguments.createMap().apply {
    val coordinates = Arguments.createArray()
    geometry.forEach { point ->
      coordinates.pushMap(Arguments.createMap().apply {
        putDouble("latitude", point.latitude)
        putDouble("longitude", point.longitude)
      })
    }
    val instructions = legs.flatMap { it.instructions }
    val steps = Arguments.createArray()
    instructions.forEachIndexed { index, instruction ->
      val next = instructions.getOrNull(index + 1)
      val maneuver = instruction.toAppManeuver()
      val nextManeuver = next?.toAppManeuver() ?: "ARRIVE"
      val distance = ((next?.routeOffset ?: summary.length).inWholeMeters() - instruction.routeOffset.inWholeMeters())
        .coerceAtLeast(0)
      val position = instruction.maneuverPoint.toWritableMap()
      val end = (next?.maneuverPoint ?: geometry.lastOrNull() ?: instruction.maneuverPoint).toWritableMap()
      val streetName = instruction.nextSignificantRoad?.name?.plainText.orEmpty()
      val nextStreetName = next?.nextSignificantRoad?.name?.plainText.orEmpty()
      val nextRoundaboutExitNumber = next?.signpost?.exitNumber?.plainText
      steps.pushMap(Arguments.createMap().apply {
        putString("maneuver", maneuver)
        putString("instruction", instruction.toAppInstruction(streetName, maneuver))
        putDouble("distance", distance.toDouble())
        putDouble("routeOffsetMeters", instruction.routeOffset.inWholeMeters().toDouble())
        putMap("position", position)
        putMap("end", end)
        putString("streetName", streetName)
        putString("nextManeuver", nextManeuver)
        putString("nextInstruction", next?.toAppInstruction(nextStreetName, nextManeuver) ?: "Arrive at destination")
        putString("nextStreetName", nextStreetName)
        nextRoundaboutExitNumber?.let { putString("nextRoundaboutExitNumber", it) }
      })
    }
    val speedLimits = Arguments.createArray()
    sections.speedLimitSections.forEach { section ->
      val startProgressMeters = section.routeOffset.inWholeMeters().toDouble()
      val endProgressMeters = startProgressMeters + section.length.inWholeMeters().toDouble()
      speedLimits.pushMap(Arguments.createMap().apply {
        putDouble("speedLimitKmh", section.speedLimit.inKilometersPerHour())
        putDouble("startProgressMeters", startProgressMeters)
        putDouble("endProgressMeters", endProgressMeters)
        putInt("startPointIndex", section.sectionLocation.startPointIndex)
        putInt("endPointIndex", section.sectionLocation.endPointIndex)
      })
    }
    putArray("polyline", coordinates)
    putDouble("distance", summary.length.inWholeMeters().toDouble())
    putDouble("duration", summary.travelTime.inWholeSeconds.toDouble())
    putDouble("durationInTraffic", summary.travelTime.inWholeSeconds.toDouble())
    putArray("steps", steps)
    putArray("guidance", Arguments.createArray())
    putArray("speedLimits", speedLimits)
    putString("nativeRouteId", routeId)
    putString("routeFingerprint", routeFingerprint())
  }

  private fun Route.routeFingerprint(): String {
    if (geometry.isEmpty()) return ""
    val lastIndex = geometry.lastIndex
    return listOf(0, lastIndex / 4, lastIndex / 2, lastIndex * 3 / 4, lastIndex)
      .distinct()
      .joinToString("|") { index ->
        val point = geometry[index]
        "${String.format(Locale.US, "%.5f", point.latitude)},${String.format(Locale.US, "%.5f", point.longitude)}"
      }
  }

  private fun GeoPoint.toWritableMap() = Arguments.createMap().apply {
    putDouble("latitude", latitude)
    putDouble("longitude", longitude)
  }

  private fun Instruction.toAppManeuver(): String = when (this) {
    is DepartureInstruction -> "DEPART"
    is ArrivalInstruction -> "ARRIVE"
    is RoundaboutInstruction -> "ROUNDABOUT"
    is ExitRoundaboutInstruction -> "ROUNDABOUT_EXIT"
    is TurnInstruction -> when (turnDirection.toString().lowercase()) {
      "turnleft" -> "TURN_LEFT"
      "sharpleft" -> "TURN_SHARP_LEFT"
      "bearleft" -> "TURN_SLIGHT_LEFT"
      "turnright" -> "TURN_RIGHT"
      "sharpright" -> "TURN_SHARP_RIGHT"
      "bearright" -> "TURN_SLIGHT_RIGHT"
      "turnaround" -> "U_TURN"
      else -> "STRAIGHT"
    }
    else -> this::class.simpleName?.replace("Instruction", "")?.replace(Regex("([a-z])([A-Z])"), "$1_$2")?.uppercase() ?: "STRAIGHT"
  }

  private fun Instruction.toAppInstruction(streetName: String, maneuver: String): String {
    val street = streetName.takeIf(String::isNotBlank)?.let { " onto $it" }.orEmpty()
    return when (this) {
      is DepartureInstruction -> "Start$street"
      is ArrivalInstruction -> "Arrive at destination"
      is RoundaboutInstruction -> "Enter roundabout$street"
      is ExitRoundaboutInstruction -> {
        val exitNumber = signpost?.exitNumber?.plainText
        if (exitNumber.isNullOrBlank()) "Exit roundabout$street" else "Take exit $exitNumber$street"
      }
      is TurnInstruction -> "${maneuver.toInstructionVerb()}$street"
      else -> "Continue$street"
    }
  }

  private fun String.toInstructionVerb() = when (this) {
    "TURN_LEFT" -> "Turn left"
    "TURN_SHARP_LEFT" -> "Turn sharp left"
    "TURN_SLIGHT_LEFT" -> "Bear left"
    "TURN_RIGHT" -> "Turn right"
    "TURN_SHARP_RIGHT" -> "Turn sharp right"
    "TURN_SLIGHT_RIGHT" -> "Bear right"
    "U_TURN" -> "Make a U-turn"
    else -> "Continue straight"
  }

  companion object {
    private const val MAX_ROUTE_ALTERNATIVES = 2

    private val maps = java.util.Collections.newSetFromMap(
      java.util.WeakHashMap<com.tomtom.sdk.map.display.TomTomMap, Boolean>(),
    )

    fun registerMap(map: com.tomtom.sdk.map.display.TomTomMap) {
      maps.add(map)
      if (TomTomSdk.isInitialized) {
        val provider = TomTomSdk.navigation.locationProvider
        map.setLocationProvider(provider)
        provider.enable()
      }
    }

    fun unregisterMap(map: com.tomtom.sdk.map.display.TomTomMap) {
      maps.remove(map)
    }

    private fun updateMapProviders() {
      maps.forEach { it.setLocationProvider(TomTomSdk.navigation.locationProvider) }
    }

    const val NAME = "TomTomNavigation"
    const val SDK_VERSION = "2.6.1"
  }
}