#include <Arduino.h>
#include <TFT_eSPI.h>

TFT_eSPI tft = TFT_eSPI();

void setup() {
  Serial.begin(115200);
  delay(800);

  Serial.println();
  Serial.println("=================================");
  Serial.println("[PROBE] Booted");
  Serial.println("[PROBE] Waiting 20s before TFT init...");
  Serial.println("=================================");

  delay(20000);

  Serial.println("[PROBE] Calling tft.init()");
  tft.init();
  Serial.println("[PROBE] tft.init() returned");

  Serial.println("[PROBE] Calling tft.setRotation(0)");
  tft.setRotation(0);
  Serial.println("[PROBE] setRotation returned");

  Serial.println("[PROBE] Calling tft.fillScreen(TFT_BLACK)");
  tft.fillScreen(TFT_BLACK);
  Serial.println("[PROBE] fillScreen returned");

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString("Display probe OK", 40, 110, 2);
  Serial.println("[PROBE] DONE");
}

void loop() {
  delay(1000);
}