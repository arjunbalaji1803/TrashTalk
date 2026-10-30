#include <Servo.h>

// Starter pin map for an Arduino Uno/Nano with one HC-SR04 and three servos.
// Change these constants to match the actual wiring before uploading.
const byte TRIG_PIN = 6;
const byte ECHO_PIN = 7;
const byte COMPOST_SERVO_PIN = 9;
const byte RECYCLE_SERVO_PIN = 10;
const byte GENERAL_SERVO_PIN = 11;

const int HAND_DISTANCE_CM = 15;
const int CLEAR_DISTANCE_CM = 20;
const int CLOSED_ANGLE = 0;
const int OPEN_ANGLE = 85;
const unsigned long COMMAND_TIMEOUT_MS = 15000;
const unsigned long SERVO_OPEN_MS = 1200;
const unsigned long SENSOR_INTERVAL_MS = 100;

Servo compostServo;
Servo recycleServo;
Servo generalServo;

bool waitingForCommand = false;
bool waitingForHandClear = false;
unsigned long requestStartedAt = 0;
unsigned long lastSensorReadAt = 0;

long measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, 25000UL);
  if (duration == 0) return -1;
  return (long)(duration * 0.0343 / 2.0);
}

void openLid(Servo &servo, const char *binName) {
  servo.write(OPEN_ANGLE);
  delay(SERVO_OPEN_MS);
  servo.write(CLOSED_ANGLE);
  delay(400);
  Serial.print("OPENED:");
  Serial.println(binName);
}

void handleCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command == "UNKNOWN") {
    if (waitingForCommand) {
      waitingForCommand = false;
      waitingForHandClear = true;
      Serial.println("UNKNOWN");
    }
    return;
  }

  if (!command.startsWith("OPEN:")) return;
  if (!waitingForCommand) {
    Serial.println("ERROR:NOT_READY");
    return;
  }

  const String binName = command.substring(5);
  waitingForCommand = false;
  waitingForHandClear = true;

  if (binName == "COMPOST") openLid(compostServo, "COMPOST");
  else if (binName == "RECYCLE") openLid(recycleServo, "RECYCLE");
  else if (binName == "GENERAL") openLid(generalServo, "GENERAL");
  else Serial.println("ERROR:BAD_BIN");
}

void readCommands() {
  while (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(9600);
  Serial.setTimeout(50);

  compostServo.attach(COMPOST_SERVO_PIN);
  recycleServo.attach(RECYCLE_SERVO_PIN);
  generalServo.attach(GENERAL_SERVO_PIN);
  compostServo.write(CLOSED_ANGLE);
  recycleServo.write(CLOSED_ANGLE);
  generalServo.write(CLOSED_ANGLE);

  Serial.println("TRASHTALK_READY");
}

void loop() {
  readCommands();

  if (waitingForCommand && millis() - requestStartedAt >= COMMAND_TIMEOUT_MS) {
    waitingForCommand = false;
    waitingForHandClear = true;
    Serial.println("TIMEOUT");
  }

  if (millis() - lastSensorReadAt < SENSOR_INTERVAL_MS) return;
  lastSensorReadAt = millis();
  const long distance = measureDistanceCm();

  if (waitingForHandClear) {
    if (distance < 0 || distance > CLEAR_DISTANCE_CM) {
      waitingForHandClear = false;
      Serial.println("REARMED");
    }
    return;
  }

  if (!waitingForCommand && distance > 0 && distance <= HAND_DISTANCE_CM) {
    waitingForCommand = true;
    requestStartedAt = millis();
    Serial.println("READY");
  }
}
