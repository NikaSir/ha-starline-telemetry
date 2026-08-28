# StarLine 0.6.5

- Replaces the visually neutral v0.6.4 default-car correction with an explicit 1.04 landmark-height calibration for every 130-й scene.
- Uses the 683-й scene as the source reference while matching the perceived wheel/body/roof geometry instead of only the outer alpha rectangle.
- Keeps the common 72% width, horizontal centre and fixed wheel line, so the additional height grows upward without moving the car down.
- Allocates the operational row as 40% engine, 38% latest event and 22% parking after measuring the full approved-size labels and values.
- Keeps `Двигатель`, `Остановлен` and parking values on complete single lines without reducing the approved font sizes or increasing the 74 px row.
