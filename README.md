# Phangan Slope Monitoring

Dashboard of the Koh Phangan slope-monitoring stations (tilt, soil moisture, rainfall, weather) with warning criteria,
trend lines, splice / filter tools and a phone-friendly layout.

**Live page:** https://korakotkkrt-dev.github.io/phangan-slope-monitoring/

## How it stays up to date
* `tools/update_data.py` reads the newest 1-minute samples from the public ThingsBoard dashboard and stores them in `data/`
  (one small file per station and month).
* `tools/build.py` puts the data into `template/index.template.html` and writes `dist/index.html`.
* The workflow `.github/workflows/update.yml` runs both **every day at 07:30 (Thailand time)**, commits the new data and publishes the page
  with GitHub Pages. Change the `cron:` line to update more often; the **Run workflow** button in the *Actions* tab updates it right away.

## Using it on a phone
* One finger drags the time axis, two fingers pinch to zoom; double tap a legend entry to isolate a channel; **values** shows the readings under your finger.
* Long explanations fold to three lines — tap to read the rest. Charts are built when they scroll into view, so the first screen opens quickly.

## Notes
* The raw readings are shown as received; sensor-fault spans are only marked/filtered on request (filter button). Warning criteria can be switched off in *settings*.
* Everything in this repository (including the sensor data) is public because GitHub Pages on a free account requires a public repository.
* Local test: `python tools/build.py` then open `dist/index.html`.
