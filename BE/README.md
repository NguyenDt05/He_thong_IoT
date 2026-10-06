# IoT backend

The API reads the existing MySQL database configured in `BE/.env`. It does not seed demo rows or issue hardware commands. Required environment variables are `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`; `PORT` defaults to `3001`.

From `BE`, run `npm install` and `npm start`. Run `npm test` for read-only API checks and request validation. Tests that need MySQL are skipped when DB settings are absent. To check the history insert constraints without keeping a row, set `DB_WRITE_ROLLBACK_TEST=1` while running `npm test`; that check inserts inside a transaction and rolls it back.

## API

- `GET /api/data-sensor?page=1&limit=10&key=&field=all` returns readings from `data_sensor` joined with `sensors`, newest first. `field` accepts `all` (default), `type`, `datetime`, or `value` and selects the column searched by `key`. `all` searches every displayed column: ID, sensor name, type, value (including unit), and displayed time. `type` matches type codes or Vietnamese labels. Dates use `dd/mm/yyyy hh:mm:ss`; older input with a comma is also accepted. The `type` parameter filters by exact sensor type (`TEMPERATURE`, `HUMIDITY`, or `LIGHT`), and can be combined with `field=value` to search that sensor's readings.
- `GET /api/devices` returns the devices currently present in MySQL. The dashboard switch uses these IDs and names but does not change device status.
- `GET /api/history?page=1&limit=10&key=&device=&action=&status=` returns rows from `action_history` joined with `devices`, newest first. `key` searches the displayed device name, username, action (`Bật`/`Tắt` or `ON`/`OFF`), status, or date and time. The `device`, `action`, and `status` filters can be combined with `key`. The displayed username alternates between `thaonguyen` and `nguyễn văn a` by row ID.
- `POST /api/history` with JSON `{ "deviceId": 1, "action": "ON" }` or `OFF` records a dashboard switch interaction and returns the new history row with HTTP 201. It does not update `devices` or control a physical light. The device ID must exist in MySQL.

List endpoints return `{ data, page, limit, total, totalPages }`. Sensor rows include `dataId`, `sensorId`, `sensorName`, `sensorType`, `unit`, `value`, `createdAt`, and `createdAtText`. History rows include `id`, `deviceId`, `device`, `deviceName`, `username`, `action`, `status`, `createdAt`, and `time`. ISO timestamps are in UTC; display times use Vietnam local time (`dd/mm/yyyy HH:mm:ss`).
