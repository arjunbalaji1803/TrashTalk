# TrashTalk

TrashTalk is a voice-assisted waste sorter prototype. An Arduino watches an ultrasonic sensor near the bin opening. When it detects a hand, it sends a ready signal to a laptop browser. The browser listens through the laptop microphone, classifies the spoken item, and asks the Arduino to open the matching servo lid.

This first version uses a small keyword catalog stored in the project. Speech recognition is provided by the browser and may use that browser's online speech service; check the browser's privacy behavior before use. The item matching itself runs in the page. If it cannot confidently classify an item, it leaves every lid closed.

## What it includes

- `firmware/TrashTalk.ino` — Arduino sketch for one HC-SR04 ultrasonic sensor and three servos.
- `index.html`, `styles.css` — browser interface.
- `src/classifier.js` — local item-to-bin keyword matching.
- `src/app.js` — microphone, Web Serial, and interface behavior.
- `tests/classifier.test.js` — classifier checks using Node's built-in test runner.

## Default bins and pins

| Part | Default pin / value |
| --- | --- |
| HC-SR04 trigger | 6 |
| HC-SR04 echo | 7 |
| Compost servo | 9 |
| Recycle servo | 10 |
| General waste servo | 11 |
| Serial speed | 9600 baud |
| Hand detection distance | 15 cm |

These are starter defaults. Confirm the actual board, sensor, servo count, bin categories, wiring, and safe lid angles before powering the hardware. Servo open/closed angles are constants near the top of the Arduino sketch and may need calibration.

## Run the browser app

Use Chrome or Edge. Web Serial and microphone access require `localhost` or HTTPS; opening the HTML file directly may block those features.

1. Upload `firmware/TrashTalk.ino` to the Arduino.
2. Connect the Arduino to the laptop by USB.
3. From this folder, start a local server, for example:

   ```sh
   python -m http.server 8000
   ```

4. Open `http://localhost:8000` in Chrome or Edge.
5. Click **Connect Arduino** and choose the Arduino serial port.
6. Click **Test microphone** once to grant microphone permission. This test only previews a classification; it does not move a servo.
7. Put a hand near the sensor and say one item, such as “banana peel” or “plastic bottle.” The browser classifies it and sends a command for supported items.

The app uses keyword matching, not an online AI model. Add or adjust phrases in `src/classifier.js` to fit the materials accepted by your local recycling program.

## Check the classifier

With Node.js installed, run:

```sh
npm test
```

The tests cover common compost, recyclable, general-waste, special-handling, and unknown phrases. Testing the Arduino firmware and actual microphone/servo cycle still requires the physical hardware.

## Serial protocol

- Arduino → browser: `READY`, `OPENED:<BIN>`, `UNKNOWN`, or `TIMEOUT`
- Browser → Arduino: `OPEN:<BIN>` or `UNKNOWN`
- Supported bin codes: `COMPOST`, `RECYCLE`, `GENERAL`

## Safety behavior

- Unrecognized, mixed, or special-handling items do not open a bin.
- The firmware times out if the browser does not send a command.
- The firmware waits for the hand to move away before it can trigger again.
- Keep fingers clear of moving lids and power servos from a supply rated for their current draw; connect the supply ground to Arduino ground.
