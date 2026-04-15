#include <Arduino.h>
#include <LovyanGFX.hpp>
#include <NimBLEDevice.h>
#include <esp_system.h>
#include <math.h>
#include "logo_bitmap.h"
#include "logo_bitmap.h"

// ── LovyanGFX config for ESP32-C3 + GC9A01 1.28" round display ──────────────
// Pins match the Waveshare ESP32-C3 round LCD board (and common clone modules):
//   SDA/MOSI=7  SCL/SCLK=6  CS=10  DC=2  RST=1  BL=3
class LGFX : public lgfx::LGFX_Device {
	lgfx::Panel_GC9A01 _panel;
	lgfx::Bus_SPI      _bus;
	lgfx::Light_PWM    _light;

public:
	LGFX() {
		// SPI bus
		{
			auto cfg       = _bus.config();
			cfg.spi_host   = SPI2_HOST;
			cfg.spi_mode   = 0;
			cfg.freq_write = 40000000;
			cfg.freq_read  = 16000000;
			cfg.spi_3wire  = false;
			cfg.use_lock   = true;
			cfg.dma_channel = SPI_DMA_CH_AUTO;
			cfg.pin_sclk   = 6;
			cfg.pin_mosi   = 7;
			cfg.pin_miso   = -1;
			cfg.pin_dc     = 2;
			_bus.config(cfg);
			_panel.setBus(&_bus);
		}
		// Panel
		{
			auto cfg         = _panel.config();
			cfg.pin_cs       = 10;
			cfg.pin_rst      = 1;
			cfg.pin_busy     = -1;
			cfg.panel_width  = 240;
			cfg.panel_height = 240;
			cfg.memory_width  = 240;
			cfg.memory_height = 240;
			cfg.offset_x      = 0;
			cfg.offset_y      = 0;
			cfg.offset_rotation = 0;
			cfg.dummy_read_pixel = 8;
			cfg.dummy_read_bits  = 1;
			cfg.readable         = false;
			cfg.invert           = true;
			cfg.rgb_order        = false;
			cfg.dlen_16bit       = false;
			cfg.bus_shared       = false;
			_panel.config(cfg);
		}
		// Backlight
		{
			auto cfg      = _light.config();
			cfg.pin_bl    = 3;
			cfg.invert    = false;
			cfg.freq      = 44100;
			cfg.pwm_channel = 7;
			_light.config(cfg);
			_panel.setLight(&_light);
		}
		setPanel(&_panel);
	}
};

static LGFX tft;

static const char* kDeviceName = "CR-Directions";
static const char* kServiceUuid = "12345678-1234-1234-1234-1234567890ab";
static const char* kCharacteristicUuid = "12345678-1234-1234-1234-1234567890ac";

static String gManeuver = "STRAIGHT";
static String gDistance = "--";
static String gInstruction = "Waiting for route updates";
static float gRoundaboutAngle = NAN;
static int gRoundaboutExitNumber = -1;

static String gPendingPayload;
static volatile bool gHasPendingPayload = false;
static portMUX_TYPE gPayloadMux = portMUX_INITIALIZER_UNLOCKED;
static const uint16_t kBootLogoMs = 1700;  // ms to hold idle screen on power-up

// ─────────────────────────────────────────────────────────────────────────────

static const char* resetReasonToString(esp_reset_reason_t reason) {
	switch (reason) {
		case ESP_RST_UNKNOWN:    return "UNKNOWN";
		case ESP_RST_POWERON:    return "POWERON";
		case ESP_RST_EXT:        return "EXT";
		case ESP_RST_SW:         return "SW";
		case ESP_RST_PANIC:      return "PANIC";
		case ESP_RST_INT_WDT:    return "INT_WDT";
		case ESP_RST_TASK_WDT:   return "TASK_WDT";
		case ESP_RST_WDT:        return "WDT";
		case ESP_RST_DEEPSLEEP:  return "DEEPSLEEP";
		case ESP_RST_BROWNOUT:   return "BROWNOUT";
		case ESP_RST_SDIO:       return "SDIO";
		case ESP_RST_USB:        return "USB";
		case ESP_RST_JTAG:       return "JTAG";
		case ESP_RST_EFUSE:      return "EFUSE";
		case ESP_RST_PWR_GLITCH: return "PWR_GLITCH";
		case ESP_RST_CPU_LOCKUP: return "CPU_LOCKUP";
		default:                 return "OTHER";
	}
}

static float parseAngleOrNaN(const String& value) {
	if (value.length() == 0) return NAN;
	float parsed = value.toFloat();
	if (!isfinite(parsed)) return NAN;
	while (parsed < 0.0f) parsed += 360.0f;
	while (parsed >= 360.0f) parsed -= 360.0f;
	return parsed;
}

static int parseExitNumberOrDefault(const String& value, int fallback = -1) {
	if (value.length() == 0) return fallback;
	int parsed = value.toInt();
	return parsed > 0 ? parsed : fallback;
}

static void splitPayload(
	const String& payload,
	String& maneuver,
	String& distance,
	String& instruction,
	float& roundaboutAngle,
	int& roundaboutExitNumber
) {
	int firstSep = payload.indexOf('|');
	int secondSep = firstSep >= 0 ? payload.indexOf('|', firstSep + 1) : -1;
	int thirdSep = secondSep >= 0 ? payload.indexOf('|', secondSep + 1) : -1;
	int fourthSep = thirdSep >= 0 ? payload.indexOf('|', thirdSep + 1) : -1;

	roundaboutAngle = NAN;
	roundaboutExitNumber = -1;

	if (firstSep < 0 || secondSep < 0) {
		maneuver = "STRAIGHT";
		distance = "--";
		instruction = payload;
		instruction.trim();
		if (instruction.length() == 0) {
			instruction = "No instruction";
		}
		return;
	}

	maneuver = payload.substring(0, firstSep);
	distance = payload.substring(firstSep + 1, secondSep);

	if (thirdSep < 0) {
		// Legacy format: MANEUVER|DISTANCE|INSTRUCTION
		instruction = payload.substring(secondSep + 1);
	} else {
		// Extended format: MANEUVER|DISTANCE|INSTRUCTION|ROUNDABOUT_ANGLE|ROUNDABOUT_EXIT_NUMBER
		instruction = payload.substring(secondSep + 1, thirdSep);
		String angleField = (fourthSep < 0)
			? payload.substring(thirdSep + 1)
			: payload.substring(thirdSep + 1, fourthSep);
		String exitField = (fourthSep < 0)
			? ""
			: payload.substring(fourthSep + 1);

		roundaboutAngle = parseAngleOrNaN(angleField);
		roundaboutExitNumber = parseExitNumberOrDefault(exitField);
	}

	maneuver.trim();
	distance.trim();
	instruction.trim();

	if (maneuver.length() == 0) maneuver = "STRAIGHT";
	if (distance.length() == 0) distance = "--";
	if (instruction.length() == 0) instruction = "No instruction";
}

static void drawWrappedLineBlock(const String& text, int x, int yStart, int maxCharsPerLine, int lineHeight, int maxLines) {
	String remaining = text;
	remaining.trim();

	for (int line = 0; line < maxLines && remaining.length() > 0; ++line) {
		int cut = remaining.length();
		if (cut > maxCharsPerLine) {
			cut = maxCharsPerLine;
			int lastSpace = remaining.lastIndexOf(' ', maxCharsPerLine);
			if (lastSpace > maxCharsPerLine / 2) {
				cut = lastSpace;
			}
		}

		String current = remaining.substring(0, cut);
		current.trim();
		tft.setCursor(x, yStart + (line * lineHeight));
		tft.print(current);

		if (cut >= remaining.length()) {
			break;
		}
		remaining = remaining.substring(cut);
		remaining.trim();
	}
}

static bool containsUpper(const String& text, const char* token) {
	return text.indexOf(token) >= 0;
}

static String ordinalSuffix(int n) {
	int mod100 = n % 100;
	int mod10 = n % 10;
	if (mod100 >= 11 && mod100 <= 13) return String(n) + "th";
	if (mod10 == 1) return String(n) + "st";
	if (mod10 == 2) return String(n) + "nd";
	if (mod10 == 3) return String(n) + "rd";
	return String(n) + "th";
}

static String simpleInstructionLabel(const String& rawManeuver, int roundaboutExitNumber, const String& fallbackInstruction) {
	String maneuver = rawManeuver;
	maneuver.toUpperCase();

	if (containsUpper(maneuver, "ARRIVE") || containsUpper(maneuver, "DESTINATION")) return "Arrived";
	if (containsUpper(maneuver, "ROUNDABOUT")) {
		if (roundaboutExitNumber > 0) return ordinalSuffix(roundaboutExitNumber) + " Exit";
		return "Roundabout";
	}
	if (containsUpper(maneuver, "UTURN") || containsUpper(maneuver, "U_TURN") || containsUpper(maneuver, "TURN_LEFT_U") || containsUpper(maneuver, "TURN_RIGHT_U")) return "U-Turn";
	if (containsUpper(maneuver, "BEAR_LEFT") || containsUpper(maneuver, "KEEP_LEFT") || containsUpper(maneuver, "SLIGHT_LEFT") || containsUpper(maneuver, "MERGE_LEFT")) return "Bear Left";
	if (containsUpper(maneuver, "BEAR_RIGHT") || containsUpper(maneuver, "KEEP_RIGHT") || containsUpper(maneuver, "SLIGHT_RIGHT") || containsUpper(maneuver, "MERGE_RIGHT")) return "Bear Right";
	if (containsUpper(maneuver, "LEFT")) return "Turn Left";
	if (containsUpper(maneuver, "RIGHT")) return "Turn Right";
	if (containsUpper(maneuver, "STRAIGHT")) return "Straight";

	String fallback = fallbackInstruction;
	fallback.trim();
	if (fallback.length() == 0) return "Continue";
	return fallback;
}

static void polarPoint(int cx, int cy, float radius, float angleDegrees, int& outX, int& outY) {
	float radians = angleDegrees * (PI / 180.0f);
	outX = (int)roundf(cx + radius * cosf(radians));
	outY = (int)roundf(cy + radius * sinf(radians));
}

static void drawThickLine(int x1, int y1, int x2, int y2, int thickness, int color) {
	if (thickness < 1) thickness = 1;
	float dx = (float)(x2 - x1);
	float dy = (float)(y2 - y1);
	float length = sqrtf(dx * dx + dy * dy);
	if (length < 1.0f) {
		tft.fillCircle(x1, y1, thickness / 2, color);
		return;
	}
	float nx = -dy / length;
	float ny = dx / length;
	int half = thickness / 2;
	for (int i = -half; i <= half; ++i) {
		int ox = (int)roundf(nx * i);
		int oy = (int)roundf(ny * i);
		tft.drawLine(x1 + ox, y1 + oy, x2 + ox, y2 + oy, color);
	}
}

static void drawArrowUp(int cx, int cy, int color) {
	tft.fillRect(cx - 10, cy - 28, 20, 42, color);
	tft.fillTriangle(cx, cy - 64, cx - 30, cy - 20, cx + 30, cy - 20, color);
}

static void drawArrowLeft(int cx, int cy, int color) {
	tft.fillRect(cx - 20, cy - 10, 42, 20, color);
	tft.fillTriangle(cx - 54, cy, cx - 14, cy - 30, cx - 14, cy + 30, color);
}

static void drawArrowRight(int cx, int cy, int color) {
	tft.fillRect(cx - 22, cy - 10, 42, 20, color);
	tft.fillTriangle(cx + 54, cy, cx + 14, cy - 30, cx + 14, cy + 30, color);
}

static void drawArrowBearLeft(int cx, int cy, int color) {
	tft.fillTriangle(cx - 46, cy - 32, cx - 10, cy - 36, cx - 34, cy + 14, color);
	tft.fillRect(cx - 7, cy - 32, 16, 50, color);
	tft.fillTriangle(cx + 2, cy - 66, cx - 26, cy - 24, cx + 30, cy - 24, color);
}

static void drawArrowBearRight(int cx, int cy, int color) {
	tft.fillTriangle(cx + 46, cy - 32, cx + 10, cy - 36, cx + 34, cy + 14, color);
	tft.fillRect(cx - 9, cy - 32, 16, 50, color);
	tft.fillTriangle(cx - 2, cy - 66, cx - 30, cy - 24, cx + 26, cy - 24, color);
}

static void drawUTurnLeft(int cx, int cy, int color) {
	// A proper U: arc across the top, two vertical legs, arrowhead on exit (left) leg.
	// Convention (sketch coords): 0°=right, 90°=down, 180°=left, 270°=up
	// Top semicircle spans 180°→360° (left side → top → right side when y-axis is down)
	const int half  = 6;
	const int arcR  = 24;
	const int arcCx = cx;
	const int arcCy = cy - 18;

	// Draw thick arc by stamping filled circles along the path
	for (float a = 180.0f; a <= 361.0f; a += 2.5f) {
		float rad = a * (PI / 180.0f);
		int px = (int)roundf(arcCx + arcR * cosf(rad));
		int py = (int)roundf(arcCy + arcR * sinf(rad));
		tft.fillCircle(px, py, half, color);
	}

	// Right leg (entry — no arrowhead)
	int rx = arcCx + arcR;
	tft.fillRect(rx - half, arcCy, half * 2, cy + 36 - arcCy, color);

	// Left leg (exit)
	int lx = arcCx - arcR;
	tft.fillRect(lx - half, arcCy, half * 2, cy + 24 - arcCy, color);

	// Arrowhead pointing DOWN at bottom of left leg
	tft.fillTriangle(lx, cy + 46, lx - 20, cy + 22, lx + 20, cy + 22, color);
}

static void drawUTurnRight(int cx, int cy, int color) {
	// Mirror of drawUTurnLeft: exit leg is on the right.
	const int half  = 6;
	const int arcR  = 24;
	const int arcCx = cx;
	const int arcCy = cy - 18;

	for (float a = 180.0f; a <= 361.0f; a += 2.5f) {
		float rad = a * (PI / 180.0f);
		int px = (int)roundf(arcCx + arcR * cosf(rad));
		int py = (int)roundf(arcCy + arcR * sinf(rad));
		tft.fillCircle(px, py, half, color);
	}

	// Left leg (entry — no arrowhead)
	int lx = arcCx - arcR;
	tft.fillRect(lx - half, arcCy, half * 2, cy + 36 - arcCy, color);

	// Right leg (exit)
	int rx = arcCx + arcR;
	tft.fillRect(rx - half, arcCy, half * 2, cy + 24 - arcCy, color);

	// Arrowhead pointing DOWN at bottom of right leg
	tft.fillTriangle(rx, cy + 46, rx - 20, cy + 22, rx + 20, cy + 22, color);
}

static float fallbackRoundaboutAngleFromExit(int exitNumber) {
	if (exitNumber <= 0) return NAN;
	int normalized = (exitNumber - 1) % 8;
	return (float)((180 + normalized * 45) % 360);
}

static void drawRoundabout(int cx, int cy, int color, float exitAngleDegrees = NAN, int exitNumber = -1) {
	// Circle — draw 3px thick by stacking three circles
	int r = 30;
	tft.drawCircle(cx, cy, r,     color);
	tft.drawCircle(cx, cy, r - 1, color);
	tft.drawCircle(cx, cy, r - 2, color);

	// Exit line — aligned to same angle model as app panel (0=right, 90=down, 180=left, 270=up)
	float angle = isfinite(exitAngleDegrees) ? exitAngleDegrees : fallbackRoundaboutAngleFromExit(exitNumber);
	if (!isfinite(angle)) angle = 0.0f;
	int lineStartX, lineStartY, lineEndX, lineEndY;
	polarPoint(cx, cy, r - 1.0f, angle, lineStartX, lineStartY);
	polarPoint(cx, cy, r + 26.0f, angle, lineEndX, lineEndY);
	drawThickLine(lineStartX, lineStartY, lineEndX, lineEndY, 6, color);
	tft.fillCircle(lineEndX, lineEndY, 2, color);

	if (exitNumber > 0) {
		String exitLabel = String(exitNumber);
		tft.setTextColor(TFT_WHITE, TFT_BLACK);
		tft.setTextSize(exitNumber >= 10 ? 1 : 2);
		int textW = tft.textWidth(exitLabel);
		int textH = exitNumber >= 10 ? 8 : 16;
		tft.setCursor(cx - (textW / 2), cy - (textH / 2));
		tft.print(exitLabel);
	}
}

static void drawArrive(int cx, int cy, int color) {
	tft.fillCircle(cx, cy - 30, 16, color);
	tft.fillTriangle(cx, cy + 30, cx - 16, cy - 4, cx + 16, cy - 4, color);
	tft.fillCircle(cx, cy - 30, 6, TFT_BLACK);
}

static void drawManeuverIcon(const String& rawManeuver, int cx, int cy, float roundaboutAngle = NAN, int roundaboutExitNumber = -1) {
	String maneuver = rawManeuver;
	maneuver.toUpperCase();
	const int iconColor = TFT_WHITE;

	if (containsUpper(maneuver, "ARRIVE") || containsUpper(maneuver, "DESTINATION")) {
		drawArrive(cx, cy, iconColor);
		return;
	}
	if (containsUpper(maneuver, "ROUNDABOUT")) {
		drawRoundabout(cx, cy, iconColor, roundaboutAngle, roundaboutExitNumber);
		return;
	}
	if (containsUpper(maneuver, "UTURN") || containsUpper(maneuver, "U_TURN") || containsUpper(maneuver, "TURN_LEFT_U") || containsUpper(maneuver, "TURN_RIGHT_U")) {
		if (containsUpper(maneuver, "RIGHT")) {
			drawUTurnRight(cx, cy, iconColor);
		} else {
			drawUTurnLeft(cx, cy, iconColor);
		}
		return;
	}
	if (containsUpper(maneuver, "BEAR_LEFT") || containsUpper(maneuver, "KEEP_LEFT") || containsUpper(maneuver, "SLIGHT_LEFT") || containsUpper(maneuver, "MERGE_LEFT")) {
		drawArrowBearLeft(cx, cy, iconColor);
		return;
	}
	if (containsUpper(maneuver, "BEAR_RIGHT") || containsUpper(maneuver, "KEEP_RIGHT") || containsUpper(maneuver, "SLIGHT_RIGHT") || containsUpper(maneuver, "MERGE_RIGHT")) {
		drawArrowBearRight(cx, cy, iconColor);
		return;
	}
	if (containsUpper(maneuver, "LEFT")) {
		drawArrowLeft(cx, cy, iconColor);
		return;
	}
	if (containsUpper(maneuver, "RIGHT")) {
		drawArrowRight(cx, cy, iconColor);
		return;
	}

	drawArrowUp(cx, cy, iconColor);
}

static void drawDirectionsCard() {
	tft.fillScreen(TFT_BLACK);

	// Icon zone — large, centred, slightly above middle
	drawManeuverIcon(gManeuver, 120, 95, gRoundaboutAngle, gRoundaboutExitNumber);

	// Distance — large, centred, below icon
	tft.setTextColor(TFT_YELLOW, TFT_BLACK);
	tft.setTextSize(3);
	String distLabel = gDistance;
	int distW = distLabel.length() * 18; // approx width at size 3
	tft.setCursor(120 - distW / 2, 158);
	tft.print(distLabel);

	// Instruction — smaller and simpler, one line, centred at bottom
	String simpleLabel = simpleInstructionLabel(gManeuver, gRoundaboutExitNumber, gInstruction);
	tft.setTextColor(TFT_WHITE, TFT_BLACK);
	tft.setTextSize(1);
	int labelW = tft.textWidth(simpleLabel);
	tft.setCursor(120 - (labelW / 2), 206);
	tft.print(simpleLabel);
}

// Draws the idle / boot screen using the actual Coffee Rider logo bitmap.
// Called on power-up and whenever the app sends maneuver=IDLE (Follow Me off).
static void drawIdleScreen() {
	tft.fillScreen(TFT_BLACK);

	// Centre the bitmap horizontally, vertically centred slightly above middle
	const int logoX = (240 - (int)kLogoBitmapW) / 2;
	const int logoY = (240 - (int)kLogoBitmapH) / 2 - 16;
	tft.pushImage(logoX, logoY, kLogoBitmapW, kLogoBitmapH,
	              (const uint16_t*)kLogoBitmap);
}

class DirectionsWriteCallbacks : public NimBLECharacteristicCallbacks {
	void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connInfo) override {
		(void)connInfo;
		std::string value = characteristic->getValue();
		if (value.empty()) {
			return;
		}

		String payload = String(value.c_str());
		portENTER_CRITICAL(&gPayloadMux);
		gPendingPayload = payload;
		gHasPendingPayload = true;
		portEXIT_CRITICAL(&gPayloadMux);

		Serial.print("[BLE] RX payload: ");
		Serial.println(payload);
	}
};

class DirectionsServerCallbacks : public NimBLEServerCallbacks {
	void onConnect(NimBLEServer* server, NimBLEConnInfo& connInfo) override {
		(void)server;
		Serial.print("[BLE] Client connected: ");
		Serial.println(connInfo.getAddress().toString().c_str());
	}

	void onDisconnect(NimBLEServer* server, NimBLEConnInfo& connInfo, int reason) override {
		(void)server;
		(void)connInfo;
		Serial.printf("[BLE] Client disconnected, reason=%d\n", reason);
		NimBLEDevice::startAdvertising();
		Serial.println("[BLE] Advertising restarted");
	}
};

static void setupBle() {
	NimBLEDevice::init(kDeviceName);
	NimBLEDevice::setMTU(247);

	NimBLEServer* server = NimBLEDevice::createServer();
	server->setCallbacks(new DirectionsServerCallbacks());

	NimBLEService* service = server->createService(kServiceUuid);
	NimBLECharacteristic* characteristic = service->createCharacteristic(
		kCharacteristicUuid,
		NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
	);
	characteristic->setValue("STRAIGHT|--|Ready");
	characteristic->setCallbacks(new DirectionsWriteCallbacks());

	service->start();

	NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
	advertising->setName(kDeviceName);
	advertising->addServiceUUID(kServiceUuid);
	advertising->start();

	Serial.println("[BLE] Advertising as CR-Directions");
	Serial.printf("[BLE] Service: %s\n", kServiceUuid);
	Serial.printf("[BLE] Characteristic: %s\n", kCharacteristicUuid);
}

void setup() {
	Serial.begin(115200);
	delay(800);

	esp_reset_reason_t reason = esp_reset_reason();

	Serial.println();
	Serial.println("=================================");
	Serial.println("[PROBE] Booted (LovyanGFX + NimBLE build)");
	Serial.printf("[PROBE] Reset reason: %s (%d)\n", resetReasonToString(reason), (int)reason);
	Serial.println("=================================");

	Serial.println("[PROBE] Calling tft.init()");
	Serial.flush();
	tft.init();
	Serial.println("[PROBE] tft.init() returned");

	tft.setRotation(0);
	drawIdleScreen();
	delay(kBootLogoMs);

	setupBle();
	Serial.println("[PROBE] READY - waiting for BLE direction payloads");
}

void loop() {
	if (gHasPendingPayload) {
		String payload;
		portENTER_CRITICAL(&gPayloadMux);
		payload = gPendingPayload;
		gHasPendingPayload = false;
		portEXIT_CRITICAL(&gPayloadMux);

		splitPayload(payload, gManeuver, gDistance, gInstruction, gRoundaboutAngle, gRoundaboutExitNumber);
		if (gManeuver == "IDLE") {
			drawIdleScreen();
		} else {
			drawDirectionsCard();
		}

		Serial.print("[UI] Maneuver: ");
		Serial.print(gManeuver);
		Serial.print(" | Distance: ");
		Serial.print(gDistance);
		Serial.print(" | Instruction: ");
		Serial.print(gInstruction);
		Serial.print(" | RoundaboutAngle: ");
		if (isfinite(gRoundaboutAngle)) {
			Serial.print(gRoundaboutAngle);
		} else {
			Serial.print("none");
		}
		Serial.print(" | Exit: ");
		Serial.println(gRoundaboutExitNumber);
	}

	delay(20);
}

