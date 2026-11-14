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

## Live data (no waiting for the daily update)
When the page opens it asks the ThingsBoard public view (read-only) for every sample newer than the stored data and adds it to both stations **before** any chart is made,
so every chart / card / analysis already runs up to the last logger minute. While the page stays open it asks again every minute: the **rainfall envelope**
(dot = one finished Bangkok day, dashed live trace for today, red circle = latest value) and the station cards follow live; the chip under the title shows the last
sample of each station and a button to reload the other charts. If ThingsBoard cannot be reached the page shows the stored data (the chip says so).

## Shared settings and field notes
Splices, value filters, pinned lines, thresholds, sensor marks and **field notes** are stored in the browser. To use the same ones on every device,
open **sync** → paste a fine-grained GitHub token that has *Contents: read and write* for this repository only (kept in that browser) →
changes are saved to `config/settings.json` and every other device loads them when it opens the page. Without a token a device can still read
the shared settings but cannot change them. A device with unsaved changes is never overwritten silently (it asks which version to keep).

## Using it on a phone
* One finger drags the time axis, two fingers pinch to zoom; tap a legend entry to hide/show a channel; **values** shows the readings under your finger.
* Long explanations fold to three lines — tap to read the rest. Charts are built when they scroll into view, so the first screen opens quickly.

## Notes
* The raw readings are shown as received; sensor-fault spans are only marked/filtered on request (filter button). Warning criteria can be switched off in *settings*.
* Everything in this repository (including the sensor data) is public because GitHub Pages on a free account requires a public repository.
* Local test: `python tools/build.py` then open `dist/index.html`.
