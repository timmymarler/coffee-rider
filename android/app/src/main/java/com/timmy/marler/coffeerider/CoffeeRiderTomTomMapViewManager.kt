package com.timmy.marler.coffeerider

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.util.LruCache
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import kotlin.time.Duration.Companion.milliseconds
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.tomtom.sdk.init.TomTomSdk
import com.tomtom.sdk.location.GeoPoint
import com.tomtom.sdk.map.display.MapOptions
import com.tomtom.sdk.map.display.camera.CameraOptions
import com.tomtom.sdk.map.display.camera.AnimateCameraCallback
import com.tomtom.sdk.map.display.camera.CameraTrackingMode
import com.tomtom.sdk.map.display.camera.FollowCameraOperatorConfig
import com.tomtom.sdk.map.display.common.screen.Padding
import com.tomtom.sdk.map.display.location.LocationMarkerOptions
import com.tomtom.sdk.map.display.camera.CameraChangeListener
import com.tomtom.sdk.map.display.camera.InitialCameraOptions
import com.tomtom.sdk.map.display.image.ImageFactory
import com.tomtom.sdk.map.display.image.Image
import com.tomtom.sdk.map.display.gesture.MapLongClickListener
import com.tomtom.sdk.map.display.marker.Label
import com.tomtom.sdk.map.display.marker.MarkerClickListener
import com.tomtom.sdk.map.display.marker.MarkerLongClickListener
import com.tomtom.sdk.map.display.marker.MarkerOptions
import com.tomtom.sdk.map.display.marker.Marker
import com.tomtom.sdk.map.display.route.RouteOptions
import com.tomtom.sdk.map.display.ui.MapView

class CoffeeRiderTomTomMapView(context: ThemedReactContext) : FrameLayout(context), LifecycleEventListener {
  private val reactContext = context
  private val mapView: MapView
  private var tomTomMap: com.tomtom.sdk.map.display.TomTomMap? = null
  private var places: List<PlaceMarker> = emptyList()
  private var routeCoordinates: List<GeoPoint> = emptyList()
  private var traveledRouteCoordinates: List<GeoPoint> = emptyList()
  private var center = GeoPoint(DEFAULT_LATITUDE, DEFAULT_LONGITUDE)
  private var routeColor = DEFAULT_ROUTE_COLOR
  private var followZoom = DEFAULT_FOLLOW_ZOOM
  private var traveledRouteOverlay: com.tomtom.sdk.map.display.route.Route? = null
  private var fitRoute = false
  private var followNavigation = false
  private var cameraTarget: CameraOptions? = null
  private var mapReady = false
  private var disposed = false
  private val pinImages = LruCache<String, Image>(128)
  private val renderedPlaces = mutableMapOf<String, Pair<PlaceMarker, Marker>>()
  private val iconTypeface by lazy { Typeface.createFromAsset(context.assets, MATERIAL_COMMUNITY_FONT) }
  private val cameraEventHandler = Handler(Looper.getMainLooper())
  private val dispatchCameraChange = Runnable {
    val map = tomTomMap ?: return@Runnable
    val camera = map.cameraPosition
    val delta = 360.0 / 2.0.pow(camera.zoom)
    val payload = Arguments.createMap().apply {
      putDouble("latitude", camera.position.latitude)
      putDouble("longitude", camera.position.longitude)
      putDouble("latitudeDelta", delta)
      putDouble("longitudeDelta", delta)
      putDouble("zoom", camera.zoom)
    }
    val visibleRegion = map.getVisibleRegion()
    if (visibleRegion.isSuccess()) {
      val region = visibleRegion.value()
      val corners = listOf(region.farLeft, region.nearLeft, region.farRight, region.nearRight)
      payload.putDouble("south", corners.minOf { it.latitude })
      payload.putDouble("north", corners.maxOf { it.latitude })
      payload.putDouble("west", minOf(region.farLeft.longitude, region.nearLeft.longitude))
      payload.putDouble("east", maxOf(region.farRight.longitude, region.nearRight.longitude))
    }
    reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topCameraChange", payload)
  }
  private val markerClickListener = MarkerClickListener { marker ->
    val placeId = marker.tag as? String ?: return@MarkerClickListener
    if (expandCluster(placeId)) return@MarkerClickListener
    val payload = Arguments.createMap().apply { putString("placeId", placeId) }
    reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topPlacePress", payload)
  }
  private val mapLongClickListener = MapLongClickListener { coordinate ->
    val nearestPlace = places.filter { it.clusterCount == 0 }.minByOrNull { place -> distanceMeters(place.coordinate, coordinate) }
    val payload = Arguments.createMap()
    if (nearestPlace != null && distanceMeters(nearestPlace.coordinate, coordinate) <= PLACE_LONG_PRESS_RADIUS_METERS) {
      payload.putString("placeId", nearestPlace.id)
      payload.putDouble("latitude", coordinate.latitude)
      payload.putDouble("longitude", coordinate.longitude)
      reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topPlaceLongPress", payload)
    } else {
      payload.putDouble("latitude", coordinate.latitude)
      payload.putDouble("longitude", coordinate.longitude)
      reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topMapLongPress", payload)
    }
    true
  }
  private val markerLongClickListener = MarkerLongClickListener { marker ->
    val placeId = marker.tag ?: return@MarkerLongClickListener
    if (expandCluster(placeId)) return@MarkerLongClickListener
    val payload = Arguments.createMap().apply {
      putString("placeId", placeId)
      putDouble("latitude", marker.coordinate.latitude)
      putDouble("longitude", marker.coordinate.longitude)
    }
    reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topPlaceLongPress", payload)
  }
  private val cameraChangeListener = CameraChangeListener {
    cameraEventHandler.removeCallbacks(dispatchCameraChange)
    cameraEventHandler.postDelayed(dispatchCameraChange, CAMERA_EVENT_DEBOUNCE_MS)
  }

  init {
    check(TomTomSdk.isInitialized) { "Initialize the TomTom SDK before rendering its map" }
    mapView = MapView(
      context,
      MapOptions(
        mapKey = BuildConfig.TOMTOM_NAVIGATION_SDK_KEY,
        initialCameraOptions = InitialCameraOptions.LocationBased(
          position = center,
          zoom = DEFAULT_ZOOM,
        ),
      ),
    )
    addView(mapView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    mapView.onCreate(Bundle())
    mapView.onStart()
    mapView.onResume()
    mapView.getMapAsync { map ->
      if (disposed) return@getMapAsync
      tomTomMap = map
      mapReady = true
      map.moveCamera(CameraOptions(position = center, zoom = DEFAULT_ZOOM))
      map.addMarkerClickListener(markerClickListener)
      map.addMarkerLongClickListener(markerLongClickListener)
      map.addMapLongClickListener(mapLongClickListener)
      map.addCameraChangeListener(cameraChangeListener)
      TomTomNavigationModule.registerMap(map)
      map.enableLocationMarker(LocationMarkerOptions(type = LocationMarkerOptions.Type.Pointer))
      applyFollowCamera()
      renderOverlays()
      animateToCameraTarget()
      cameraEventHandler.post(dispatchCameraChange)
    }
    context.addLifecycleEventListener(this)
  }

  fun setCenter(latitude: Double, longitude: Double) {
    if (!latitude.isFinite() || !longitude.isFinite()) return
    center = GeoPoint(latitude.coerceIn(-90.0, 90.0), longitude.coerceIn(-180.0, 180.0))
    if (!mapReady) tomTomMap?.moveCamera(CameraOptions(position = center, zoom = DEFAULT_ZOOM))
  }

  fun setCenterLatitude(latitude: Double) = setCenter(latitude, center.longitude)

  fun setCenterLongitude(longitude: Double) = setCenter(center.latitude, longitude)

  fun setCameraTarget(value: ReadableMap?) {
    if (value == null) return
    val latitude = value.getDouble("latitude")
    val longitude = value.getDouble("longitude")
    if (!latitude.isFinite() || !longitude.isFinite() || latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return
    cameraTarget = CameraOptions(
      position = GeoPoint(latitude, longitude),
      zoom = value.getDouble("zoom"),
      tilt = value.getDouble("pitch"),
      rotation = value.getDouble("heading"),
    )
    tomTomMap?.let { map ->
      map.cameraTrackingMode = CameraTrackingMode.None
      animateToCameraTarget()
    }
  }

  private fun animateToCameraTarget() {
    val map = tomTomMap ?: return
    val target = cameraTarget ?: return
    map.animateCamera(target, object : AnimateCameraCallback {
      override fun onComplete() {
        if (!disposed && followNavigation) applyFollowCamera()
      }

      override fun onCancelled() = Unit
    }, 700.milliseconds)
  }

  fun setPlaces(value: ReadableArray?) {
    val updatedPlaces = buildList {
      for (index in 0 until (value?.size() ?: 0)) {
        val item = value?.getMap(index) ?: continue
        val id = item.getString("id")?.takeIf(String::isNotBlank) ?: continue
        val name = item.getString("title")?.takeIf(String::isNotBlank) ?: "Coffee Rider place"
        val iconGlyph = if (item.hasKey("iconGlyph") && !item.isNull("iconGlyph")) item.getInt("iconGlyph") else DEFAULT_ICON_GLYPH
        val iconColor = parseColor(item.getString("iconColor"), Color.BLACK)
        val fillColor = parseColor(item.getString("fillColor"), DEFAULT_PIN_COLOR)
        val circleColor = parseColor(item.getString("circleColor"), Color.WHITE)
        val strokeColor = parseColor(item.getString("strokeColor"), DEFAULT_STROKE_COLOR)
        val visited = item.hasKey("visited") && item.getBoolean("visited")
        val clusterCount = if (item.hasKey("clusterCount")) item.getInt("clusterCount") else 0
        val expansionZoom = if (item.hasKey("expansionZoom")) item.getDouble("expansionZoom") else DEFAULT_ZOOM
        val latitude = item.getDouble("latitude")
        val longitude = item.getDouble("longitude")
        if (latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0) {
          add(PlaceMarker(id, name, GeoPoint(latitude, longitude), iconGlyph, iconColor, fillColor, circleColor, strokeColor, visited, clusterCount, expansionZoom))
        }
      }
    }
    if (updatedPlaces == places) return
    places = updatedPlaces
    renderPlaces()
  }

  fun setRoute(value: ReadableArray?) {
    val updatedRoute = buildList {
      for (index in 0 until (value?.size() ?: 0)) {
        val item = value?.getMap(index) ?: continue
        val latitude = item.getDouble("latitude")
        val longitude = item.getDouble("longitude")
        if (latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0) {
          add(GeoPoint(latitude, longitude))
        }
      }
    }
    val routeChanged = updatedRoute != routeCoordinates
    if (!routeChanged) return
    routeCoordinates = updatedRoute
    renderRoute()
    if (routeChanged && fitRoute && !followNavigation && routeCoordinates.size > 1) tomTomMap?.zoomToRoutes(72)
  }

  fun setRouteColor(value: String?) {
    val updatedColor = runCatching { Color.parseColor(value) }.getOrDefault(DEFAULT_ROUTE_COLOR)
    if (updatedColor == routeColor) return
    routeColor = updatedColor
    renderRoute()
  }

  fun setTraveledRoute(value: ReadableArray?) {
    val updatedRoute = buildList {
      for (index in 0 until (value?.size() ?: 0)) {
        val item = value?.getMap(index) ?: continue
        val latitude = item.getDouble("latitude")
        val longitude = item.getDouble("longitude")
        if (latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0) {
          add(GeoPoint(latitude, longitude))
        }
      }
    }
    if (updatedRoute == traveledRouteCoordinates) return
    traveledRouteCoordinates = updatedRoute
    renderTraveledRoute()
  }

  fun setFollowZoom(value: Double) {
    if (!value.isFinite()) return
    followZoom = value.coerceIn(0.0, 18.0)
    if (followNavigation) applyFollowCamera()
  }

  fun setFitRoute(value: Boolean) {
    val shouldFit = value && !fitRoute
    fitRoute = value
    if (shouldFit && !followNavigation && routeCoordinates.size > 1) tomTomMap?.zoomToRoutes(72)
  }

  fun setFollowNavigation(value: Boolean) {
    if (followNavigation == value) return
    followNavigation = value
    if (value) tomTomMap?.moveCamera(CameraOptions(zoom = followZoom, tilt = 35.0))
    applyFollowCamera()
  }

  private fun applyFollowCamera() {
    val map = tomTomMap ?: return
    map.enableLocationMarker(LocationMarkerOptions(
      type = if (followNavigation) LocationMarkerOptions.Type.Chevron else LocationMarkerOptions.Type.Pointer,
    ))
    val density = resources.displayMetrics.density
    map.setPadding(if (followNavigation) Padding(0, (200 * density).toInt(), 0, (120 * density).toInt()) else Padding(0))
    map.cameraTrackingMode = if (followNavigation) {
      CameraTrackingMode.FollowDirection(FollowCameraOperatorConfig(defaultZoom = followZoom, defaultTilt = 35.0))
    } else {
      CameraTrackingMode.None
    }
  }

  fun dispose() {
    if (disposed) return
    disposed = true
    cameraEventHandler.removeCallbacks(dispatchCameraChange)
    reactContext.removeLifecycleEventListener(this)
    tomTomMap?.removeMarkerClickListener(markerClickListener)
    tomTomMap?.removeMarkerLongClickListener(markerLongClickListener)
    tomTomMap?.removeMapLongClickListener(mapLongClickListener)
    tomTomMap?.removeCameraChangeListener(cameraChangeListener)
    tomTomMap?.let(TomTomNavigationModule::unregisterMap)
    renderedPlaces.clear()
    pinImages.evictAll()
    tomTomMap = null
    mapView.onPause()
    mapView.onStop()
    mapView.onDestroy()
  }

  override fun onHostResume() {
    if (disposed) return
    mapView.onStart()
    mapView.onResume()
  }

  override fun onHostPause() {
    if (disposed) return
    mapView.onPause()
    mapView.onStop()
  }

  override fun onHostDestroy() = dispose()

  private fun renderOverlays() {
    renderRoute()
    renderPlaces()
  }

  private fun renderRoute() {
    val map = tomTomMap ?: return
    map.removeRoutes()
    traveledRouteOverlay = null
    if (routeCoordinates.size > 1) {
      map.addRoute(
        RouteOptions(
          geometry = routeCoordinates,
          color = routeColor,
          departureMarkerVisible = false,
          destinationMarkerVisible = false,
        ),
      )
    }
    renderTraveledRoute()
  }

  private fun renderTraveledRoute() {
    val map = tomTomMap ?: return
    traveledRouteOverlay?.remove()
    traveledRouteOverlay = null
    if (traveledRouteCoordinates.size > 1) {
      traveledRouteOverlay = map.addRoute(
        RouteOptions(
          geometry = traveledRouteCoordinates,
          color = DEFAULT_TRAVELED_ROUTE_COLOR,
          departureMarkerVisible = false,
          destinationMarkerVisible = false,
        ),
      )
    }
  }

  private fun renderPlaces() {
    val map = tomTomMap ?: return
    val updatedPlaces = places.associateBy { it.id }
    renderedPlaces.keys.toList().forEach { placeId ->
      val rendered = renderedPlaces[placeId] ?: return@forEach
      if (updatedPlaces[placeId] != rendered.first) {
        rendered.second.remove()
        renderedPlaces.remove(placeId)
      }
    }
    places.forEach { place ->
      if (renderedPlaces.containsKey(place.id)) return@forEach
      val imageKey = "${place.iconGlyph}:${place.iconColor}:${place.fillColor}:${place.circleColor}:${place.strokeColor}:${place.visited}:${place.clusterCount}"
      val placePin = pinImages.get(imageKey) ?: ImageFactory.fromBitmap(
        if (place.clusterCount > 0) createClusterPin(place.clusterCount) else createPlacePin(place),
      ).also { pinImages.put(imageKey, it) }
      val marker = map.addMarker(
        MarkerOptions(
          coordinate = place.coordinate,
          pinImage = placePin,
          label = if (place.clusterCount == 0) Label(text = place.title, textColor = Color.rgb(38, 45, 41), textSize = 12.0) else null,
          tag = PLACE_MARKER_TAG,
        ),
      )
      marker.tag = place.id
      renderedPlaces[place.id] = place to marker
    }
  }

  private fun expandCluster(placeId: String): Boolean {
    val cluster = places.firstOrNull { it.id == placeId && it.clusterCount > 0 } ?: return false
    tomTomMap?.animateCamera(CameraOptions(position = cluster.coordinate, zoom = cluster.expansionZoom.coerceAtMost(18.0)), 500.milliseconds)
    return true
  }

  private fun createClusterPin(count: Int): Bitmap {
    val bitmap = Bitmap.createBitmap(90, 90, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = Color.WHITE
    canvas.drawCircle(45f, 45f, 43f, paint)
    paint.color = Color.rgb(22, 120, 184)
    canvas.drawCircle(45f, 45f, 38f, paint)
    paint.color = Color.WHITE
    paint.typeface = Typeface.DEFAULT_BOLD
    paint.textAlign = Paint.Align.CENTER
    paint.textSize = if (count < 1000) 30f else 23f
    val baseline = 45f - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2f
    canvas.drawText(count.toString(), 45f, baseline, paint)
    return bitmap
  }

  private fun createPlacePin(place: PlaceMarker): Bitmap {
    val bitmap = Bitmap.createBitmap(90, 110, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.scale(1.25f, 1.25f)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val pin = Path().apply {
      moveTo(36f, 86f)
      cubicTo(29f, 72f, 7f, 51f, 7f, 31f)
      cubicTo(7f, 14f, 20f, 4f, 36f, 4f)
      cubicTo(52f, 4f, 65f, 14f, 65f, 31f)
      cubicTo(65f, 51f, 43f, 72f, 36f, 86f)
      close()
    }
    if (place.visited) {
      paint.color = VISITED_COLOR
      paint.style = Paint.Style.STROKE
      paint.strokeWidth = 9f
      canvas.drawPath(pin, paint)
      paint.style = Paint.Style.FILL
    }
    paint.color = place.fillColor
    canvas.drawPath(pin, paint)
    paint.color = place.strokeColor
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 2f
    canvas.drawPath(pin, paint)
    paint.style = Paint.Style.FILL
    paint.color = place.circleColor
    canvas.drawCircle(36f, 31f, 18f, paint)
    paint.typeface = iconTypeface
    paint.textAlign = Paint.Align.CENTER
    paint.textSize = 31f
    paint.color = place.iconColor
    val fontMetrics = paint.fontMetrics
    val baseline = 31f - (fontMetrics.ascent + fontMetrics.descent) / 2f
    canvas.drawText(String(Character.toChars(place.iconGlyph)), 36f, baseline, paint)
    return bitmap
  }

  private fun parseColor(value: String?, fallback: Int): Int =
    runCatching { Color.parseColor(value) }.getOrDefault(fallback)

  private fun distanceMeters(first: GeoPoint, second: GeoPoint): Double {
    val latitudeDelta = Math.toRadians(second.latitude - first.latitude)
    val longitudeDelta = Math.toRadians(second.longitude - first.longitude)
    val firstLatitude = Math.toRadians(first.latitude)
    val secondLatitude = Math.toRadians(second.latitude)
    val haversine = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
      Math.cos(firstLatitude) * Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2)
    return 6_371_000.0 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  }

  private fun Double.pow(exponent: Double): Double = Math.pow(this, exponent)

  private data class PlaceMarker(
    val id: String,
    val title: String,
    val coordinate: GeoPoint,
    val iconGlyph: Int,
    val iconColor: Int,
    val fillColor: Int,
    val circleColor: Int,
    val strokeColor: Int,
    val visited: Boolean,
    val clusterCount: Int,
    val expansionZoom: Double,
  )

  companion object {
    private const val PLACE_MARKER_TAG = "coffee-rider-place"
    private const val DEFAULT_LATITUDE = 51.5072
    private const val DEFAULT_LONGITUDE = -0.1276
    private const val DEFAULT_ZOOM = 12.0
    private const val DEFAULT_FOLLOW_ZOOM = 16.0
    private const val CAMERA_EVENT_DEBOUNCE_MS = 120L
    private const val PLACE_LONG_PRESS_RADIUS_METERS = 35.0
    private const val MATERIAL_COMMUNITY_FONT = "MaterialCommunityIcons.ttf"
    private const val DEFAULT_ICON_GLYPH = 0xF0C3
    private val DEFAULT_PIN_COLOR = Color.rgb(29, 91, 75)
    private val DEFAULT_STROKE_COLOR = Color.rgb(20, 75, 62)
    private val VISITED_COLOR = Color.rgb(0, 200, 83)
    private val DEFAULT_ROUTE_COLOR = Color.rgb(37, 125, 186)
    private val DEFAULT_TRAVELED_ROUTE_COLOR = Color.rgb(255, 216, 92)
  }
}

class CoffeeRiderTomTomMapViewManager : SimpleViewManager<CoffeeRiderTomTomMapView>() {
  override fun getName() = REACT_CLASS

  override fun createViewInstance(reactContext: ThemedReactContext) = CoffeeRiderTomTomMapView(reactContext)

  override fun onDropViewInstance(view: CoffeeRiderTomTomMapView) {
    view.dispose()
    super.onDropViewInstance(view)
  }

  @ReactProp(name = "centerLatitude", defaultDouble = 51.5072)
  fun setCenterLatitude(view: CoffeeRiderTomTomMapView, value: Double) {
    view.setCenterLatitude(value)
  }

  @ReactProp(name = "centerLongitude", defaultDouble = -0.1276)
  fun setCenterLongitude(view: CoffeeRiderTomTomMapView, value: Double) {
    view.setCenterLongitude(value)
  }

  @ReactProp(name = "places")
  fun setPlaces(view: CoffeeRiderTomTomMapView, value: ReadableArray?) = view.setPlaces(value)

  @ReactProp(name = "cameraTarget")
  fun setCameraTarget(view: CoffeeRiderTomTomMapView, value: ReadableMap?) = view.setCameraTarget(value)

  @ReactProp(name = "routeCoordinates")
  fun setRouteCoordinates(view: CoffeeRiderTomTomMapView, value: ReadableArray?) = view.setRoute(value)

  @ReactProp(name = "traveledRouteCoordinates")
  fun setTraveledRouteCoordinates(view: CoffeeRiderTomTomMapView, value: ReadableArray?) = view.setTraveledRoute(value)

  @ReactProp(name = "followZoom", defaultDouble = 16.0)
  fun setFollowZoom(view: CoffeeRiderTomTomMapView, value: Double) = view.setFollowZoom(value)

  @ReactProp(name = "routeColor")
  fun setRouteColor(view: CoffeeRiderTomTomMapView, value: String?) = view.setRouteColor(value)

  @ReactProp(name = "fitRoute", defaultBoolean = false)
  fun setFitRoute(view: CoffeeRiderTomTomMapView, value: Boolean) = view.setFitRoute(value)

  @ReactProp(name = "followNavigation", defaultBoolean = false)
  fun setFollowNavigation(view: CoffeeRiderTomTomMapView, value: Boolean) = view.setFollowNavigation(value)

  override fun getExportedCustomDirectEventTypeConstants() = mapOf(
    "topPlacePress" to mapOf("registrationName" to "onPlacePress"),
    "topPlaceLongPress" to mapOf("registrationName" to "onPlaceLongPress"),
    "topMapLongPress" to mapOf("registrationName" to "onMapLongPress"),
    "topCameraChange" to mapOf("registrationName" to "onCameraChange"),
  )

  companion object {
    const val REACT_CLASS = "CoffeeRiderTomTomMapView"
  }
}