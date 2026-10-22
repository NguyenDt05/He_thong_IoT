# Tài liệu API hệ thống IoT

> Phạm vi rà soát: toàn bộ `BE/src`, `BE/test`, các lời gọi HTTP trong `FE/src`, `BE/README.md`, `FE/README.md` và `HUONG_DAN_HOC_BACKEND_IOT.md`; cập nhật tài khoản ngày 22/10/2026.

## 1. Tổng quan

- Base URL khi chạy local: `http://localhost:3001`.
- Định dạng request body: `application/json`.
- Định dạng response thành công và các lỗi do controller bắt: JSON.
- Tài khoản dùng cookie phiên HttpOnly lưu trong `auth_sessions`; khách vẫn xem và điều khiển thiết bị.
- `cors()` đang dùng cấu hình mặc định, không giới hạn origin trong mã nguồn.
- Thời gian từ MySQL được hiểu là giờ Việt Nam (`+07:00`) và chuyển thành ISO UTC ở các trường `createdAt`, `updatedAt`, `lastSeen`.
- Endpoint không tồn tại dùng handler 404 mặc định của Express, vì vậy response là HTML, không phải JSON.

Backend hiện có **12 operation HTTP trên 9 endpoint**:

| Nhóm | Method | Endpoint | Frontend sử dụng |
| --- | --- | --- | --- |
| DataSensor | GET | `/api/data-sensor` | Dashboard, DataSensor |
| Device | GET | `/api/devices` | Dashboard, History |
| ActionHistory | GET | `/api/history` | History |
| ActionHistory | POST | `/api/history` | Công tắc thiết bị trên Dashboard |
| Hardware | GET | `/api/hardware/status` | Dashboard |
| Auth | POST | `/api/auth/register` | Đăng ký |
| Auth | POST | `/api/auth/login` | Đăng nhập |
| Auth | GET | `/api/auth/me` | Trang cá nhân, trạng thái đăng nhập |
| Auth | PUT | `/api/auth/me` | Chỉnh sửa trang cá nhân |
| Auth | POST | `/api/auth/logout` | Đăng xuất |
| Auth | PUT | `/api/auth/avatar` | Tải ảnh đại diện |
| Auth | GET | `/api/auth/avatar` | Hiển thị ảnh đại diện |

Luồng lớp thông thường là Route → Controller → Service → Repository → MySQL. Riêng `GET /api/hardware/status` được xử lý trực tiếp trong route và gọi repository/MQTT service, không có controller và service riêng.

## 2. Quy ước chung

### 2.1. Phân trang

`GET /api/data-sensor` và `GET /api/history` dùng cùng quy tắc:

| Tham số | Mặc định | Giới hạn | Khi không hợp lệ |
| --- | ---: | ---: | --- |
| `page` | `1` | tối đa `100000` | trở về `1` |
| `limit` | `20` | tối đa `100` | trở về `20` |

Giá trị hợp lệ phải chuyển được thành số nguyên dương an toàn. Ví dụ `limit=999` được chặn thành `100`, còn `limit=abc` trở về `20`.

Response phân trang có dạng:

```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

`totalPages` bằng `Math.ceil(total / limit)`, nên bằng `0` khi không có bản ghi.

### 2.2. Lỗi chung

- Lỗi MySQL hoặc lỗi nội bộ được ghi ra console backend rồi trả status `500` với body JSON riêng của từng operation.
- Không có middleware JSON 404 chung. Route hoặc method không tồn tại trả trang HTML 404 mặc định của Express.
- Body JSON sai cú pháp được middleware `express.json()` xử lý trước controller; dự án không định nghĩa body JSON riêng cho trường hợp này. Cần kiểm thử theo đúng phiên bản Express đang chạy nếu đưa kết quả đó vào báo cáo.

---

## 3. DataSensor

### GET `/api/data-sensor`

Lấy dữ liệu đo mới nhất trước, JOIN bảng `data_sensor` với `sensors`, hỗ trợ tìm kiếm, lọc loại và phân trang.

#### Query parameters

| Tên | Kiểu | Bắt buộc | Giá trị/quy tắc | Ý nghĩa |
| --- | --- | --- | --- | --- |
| `page` | string biểu diễn integer | Không | mặc định `1`, tối đa `100000` | Trang cần lấy. |
| `limit` | string biểu diễn integer | Không | mặc định `20`, tối đa `100` | Số dòng mỗi trang. |
| `key` | string | Không | được `trim()` | Từ khóa tìm kiếm. Chuỗi rỗng không tạo điều kiện tìm kiếm. |
| `criterion` | string | Không | `all`, `temperature`, `humidity`, `light`, `datetime`; mặc định `all` | Tiêu chí tìm kiếm tương ứng trực tiếp với lựa chọn trên giao diện. Không phân biệt chữ hoa/thường; giá trị khác tự trở về `all`. |

Quy tắc tìm kiếm:

- `all`: tìm `key` trong ID dữ liệu, tên cảm biến, loại/mô tả loại, ngày giờ, giá trị và chuỗi `giá trị + đơn vị`.
- `temperature`: chỉ lấy dữ liệu `TEMPERATURE`; nếu có `key` thì tìm trong giá trị đo.
- `humidity`: chỉ lấy dữ liệu `HUMIDITY`; nếu có `key` thì tìm trong giá trị đo.
- `light`: chỉ lấy dữ liệu `LIGHT`; nếu có `key` thì tìm trong giá trị đo.
- `datetime`: tìm `key` trên chuỗi ngày giờ `yyyy/MM/dd HH:mm:ss`.
- Ký tự `%`, `_`, `!` trong `key` được escape và được hiểu là ký tự thường, không phải wildcard SQL.

Ví dụ tìm giá trị chứa `25` trong dữ liệu nhiệt độ:

```http
GET /api/data-sensor?page=1&limit=20&criterion=temperature&key=25
```

#### Success response — `200 OK`

Response thực tế đã được xác nhận bằng test và gọi local:

```json
{
  "data": [
    {
      "dataId": 2603,
      "sensorId": 3,
      "sensorName": "Cảm biến ánh sáng",
      "sensorType": "LIGHT",
      "unit": "%",
      "value": 76.68,
      "createdAt": "2026-10-15T17:29:05.000Z",
      "createdAtText": "2026/10/16 00:29:05"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1780,
  "totalPages": 89
}
```

Giá trị và tổng số dòng phụ thuộc CSDL tại thời điểm gọi. `createdAt`/`createdAtText` có thể là `null` nếu giá trị ngày giờ từ DB không khớp định dạng mà `rowFormat.js` hỗ trợ; cần kiểm thử nếu schema hoặc driver thay đổi.

#### Error response — `500 Internal Server Error`

```json
{
  "error": "Loi"
}
```

Không có status `400` riêng cho query sai; backend chuẩn hóa phân trang và đưa `criterion` không hợp lệ về `all` như mô tả trên.

#### CSDL liên quan

| Bảng | Thao tác | Cột dùng trực tiếp |
| --- | --- | --- |
| `data_sensor` | SELECT, COUNT | `data_id`, `sensor_id`, `value`, `created_at` |
| `sensors` | JOIN/SELECT/filter | `sensor_id`, `sensor_name`, `sensor_type`, `unit` |

Thứ tự: `created_at DESC`, sau đó `data_id DESC`.

---

## 4. Device

### GET `/api/devices`

Đọc toàn bộ thiết bị, trạng thái vật lý gần nhất và lệnh `PENDING` còn hiệu lực.

#### Query/body

Không có query parameter và không có request body.

#### Success response — `200 OK`

Response là một mảng, không bọc trong đối tượng phân trang:

```json
[
  {
    "deviceId": 1,
    "deviceName": "LED 1",
    "status": "OFF",
    "pendingActionId": null,
    "updatedAt": "2026-10-15T17:28:54.000Z"
  }
]
```

| Trường | Kiểu thực tế | Ghi chú |
| --- | --- | --- |
| `deviceId` | integer | ID trong `devices`. |
| `deviceName` | string | Tên trong CSDL. |
| `status` | string | Frontend hiểu `ON` là bật; giá trị khác hiển thị tắt. Schema DB dự kiến `ON`/`OFF`, nhưng repository không validate lại. |
| `pendingActionId` | integer hoặc `null` | Action mới nhất còn `PENDING` và chưa quá timeout. |
| `updatedAt` | ISO string hoặc `null` | Được tạo từ `devices.updated_at`. |

#### Error response — `500 Internal Server Error`

```json
{
  "error": "Không thể tải thiết bị"
}
```

#### CSDL/cấu hình liên quan

| Nguồn | Thao tác/ý nghĩa |
| --- | --- |
| `devices` | SELECT `device_id`, `device_name`, `status`, `updated_at`. |
| `action_history` | Subquery lấy `action_id` của lệnh `PENDING` chưa hết hạn. |
| `HARDWARE_COMMAND_TIMEOUT_MS` | Cửa sổ thời gian lệnh còn hiệu lực, mặc định 30000 ms. |

---

## 5. ActionHistory

### GET `/api/history`

Lấy lịch sử thao tác thiết bị, JOIN tên thiết bị và tên người dùng, hỗ trợ tìm kiếm/lọc/phân trang.

#### Query parameters

| Tên | Kiểu | Bắt buộc | Giá trị FE gửi | Ý nghĩa |
| --- | --- | --- | --- | --- |
| `page` | integer string | Không | `1...` | Trang cần lấy. |
| `limit` | integer string | Không | `10`, `20`, `50`; mặc định `20` | Số dòng/trang; backend cho tối đa `100`. |
| `key` | string | Không | nội dung tự do | Tìm tên thiết bị, tên người dùng, thời gian, action/status; hỗ trợ từ tiếng Việt “bật”, “tắt” sau khi bỏ dấu. |
| `deviceId` | integer string | Không | ID thiết bị, ví dụ `3` | Lọc chính xác theo `action_history.device_id`; giá trị phải là số nguyên dương an toàn. |
| `action` | string | Không | `ON`, `OFF` | So sánh chính xác với `action_history.action`. Backend không validate query enum. |
| `status` | string | Không | `SUCCESS`, `FAILED`, `PENDING` | So sánh với trạng thái hiệu dụng. Backend không validate query enum. |

Lệnh `PENDING` quá `HARDWARE_COMMAND_TIMEOUT_MS` được cập nhật thành `FAILED` trong DB trước khi backend đọc lịch sử hoặc tạo lệnh mới.

#### Success response — `200 OK`

```json
{
  "data": [
    {
      "id": 853,
      "deviceName": "LED 3",
      "username": null,
      "action": "OFF",
      "status": "SUCCESS",
      "deviceId": 3,
      "createdAt": "2026-10-15T17:28:57.000Z",
      "createdAtText": "2026/10/16 00:28:57"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 851,
  "totalPages": 43
}
```

`username` là `users.full_name` hoặc `null` khi `user_id` không có/không khớp. Action của khách ghi `user_id = NULL`; action của tài khoản đăng nhập dùng `user_id` từ cookie phiên hợp lệ.

`deviceId` không hợp lệ trả `400 Bad Request` với `{"error":"deviceId không hợp lệ"}`.

#### Error response — `500 Internal Server Error`

```json
{
  "error": "Không thể tải lịch sử hoạt động"
}
```

#### CSDL liên quan

| Bảng | Thao tác | Vai trò |
| --- | --- | --- |
| `action_history` | SELECT, COUNT, UPDATE | Nguồn lịch sử, action, status và thời gian; cập nhật lệnh quá hạn thành `FAILED`. |
| `devices` | INNER JOIN | Lấy tên thiết bị; lịch sử có device không tồn tại sẽ không xuất hiện. |
| `users` | LEFT JOIN | Lấy `full_name`; cho phép `username: null`. |

Thứ tự: `created_at DESC`, sau đó `action_id DESC`.

### POST `/api/history`

Tạo một lệnh điều khiển thiết bị ở trạng thái `PENDING`. Đây là API điều khiển mà Frontend thực sự gọi; không có `/api/devices/control`.

#### Request body

```json
{
  "deviceId": 1,
  "action": "ON"
}
```

| Trường | Bắt buộc | Quy tắc |
| --- | --- | --- |
| `deviceId` | Có | Sau `Number(...)` phải là số nguyên an toàn và lớn hơn 0. Do có ép kiểu, chuỗi số như `"1"` cũng được chấp nhận. |
| `action` | Có | Phải đúng `ON` hoặc `OFF`, có phân biệt hoa/thường. |

Trường thừa bị bỏ qua. API chỉ tạo lệnh trong DB; MQTT bridge quét lệnh `PENDING` mỗi giây và publish tới topic `device/control`.

#### Success response — `201 Created`

Cấu trúc là một dòng lịch sử, dùng trường `id` (không phải `actionId`):

```json
{
  "id": 854,
  "deviceName": "LED 1",
  "username": null,
  "action": "ON",
  "status": "PENDING",
  "deviceId": 1,
  "createdAt": "2026-10-17T02:20:00.000Z",
  "createdAtText": "2026/10/17 09:20:00"
}
```

Ví dụ trên minh họa đúng cấu trúc do code trả về; ID và thời gian của một lần POST thành công phải lấy từ lần kiểm thử thật. Lần rà soát này không gửi lệnh thành công để tránh điều khiển phần cứng ngoài ý muốn.

#### Validation và error responses

Thứ tự kiểm tra có ý nghĩa:

| Status | Điều kiện | Response JSON |
| ---: | --- | --- |
| `400 Bad Request` | `deviceId` không phải integer dương, hoặc `action` không phải `ON`/`OFF`. | `{"error":"Thiết bị hoặc thao tác không hợp lệ"}` |
| `422 Unprocessable Entity` | `deviceId` không nằm trong `MQTT_DEVICE_IDS`. | `{"error":"Thiết bị chưa được cấu hình trên mạch"}` |
| `503 Service Unavailable` | MQTT client/sensor stream không live. | `{"error":"Mạch cứng chưa kết nối"}` |
| `404 Not Found` | ID được cấu hình điều khiển và mạch live, nhưng không có dòng tương ứng trong `devices`. | `{"error":"Không tìm thấy thiết bị"}` |
| `409 Conflict` | Thiết bị đã có lệnh `PENDING` chưa hết hạn. | `{"error":"Thiết bị đang chờ mạch xác nhận lệnh trước"}` |
| `500 Internal Server Error` | Lỗi DB/nội bộ khác. | `{"error":"Không thể lưu lịch sử hoạt động"}` |

`400` đã được xác nhận bằng test và gọi local. Các nhánh `201`, `404`, `409`, `503` phụ thuộc trạng thái mạch/CSDL tại thời điểm chạy và phải được kiểm thử với đúng điều kiện ghi trong bảng. `422` ổn định khi dùng một ID dương chắc chắn không có trong `MQTT_DEVICE_IDS` của môi trường đang chạy.

#### CSDL/MQTT liên quan

| Nguồn | Thao tác |
| --- | --- |
| `devices` | SELECT có `FOR UPDATE` để xác nhận thiết bị tồn tại. |
| `action_history` | Kiểm tra lệnh chờ và INSERT `{user_id: ID từ phiên hoặc NULL, device_id, action, status: PENDING}` trong transaction. |
| Topic MQTT `device/control` | Bridge publish `{actionId, deviceId, command}`; đây không phải HTTP endpoint. |
| Topic MQTT `device/status` | ESP32 phản hồi để cập nhật `devices.status` và trạng thái lịch sử. |

---

## 6. Hardware

### GET `/api/hardware/status`

Kiểm tra kết nối phần cứng dựa trên cả trạng thái MQTT trong tiến trình backend và độ mới của dữ liệu ba loại cảm biến.

#### Query/body

Không có query parameter và không có request body.

#### Success response — `200 OK`

```json
{
  "connected": false,
  "lastSeen": {
    "TEMPERATURE": "2026-10-15T17:29:05.000Z",
    "HUMIDITY": "2026-10-15T17:29:05.000Z",
    "LIGHT": "2026-10-15T17:29:05.000Z"
  },
  "staleAfterMs": 6000,
  "checkedAt": "2026-10-17T02:16:27.645Z"
}
```

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `connected` | boolean | Chỉ `true` khi MQTT client connected, vừa lưu thành công gói `sensor/data`, và bản ghi mới nhất của cả ba loại chưa quá hạn. |
| `lastSeen` | object | Ánh xạ loại cảm biến có trong truy vấn sang ISO string hoặc `null`. Cấu hình bình thường có đủ ba khóa. |
| `staleAfterMs` | number | `HARDWARE_STALE_MS`, mặc định `6000`. |
| `checkedAt` | ISO string | Thời điểm backend tạo response. |

#### Error response — `500 Internal Server Error`

```json
{
  "error": "Không thể kiểm tra kết nối phần cứng"
}
```

#### CSDL/runtime liên quan

| Nguồn | Thao tác/ý nghĩa |
| --- | --- |
| `sensors` + `data_sensor` | LEFT JOIN và `MAX(created_at)` theo `sensor_type`. |
| MQTT client trong `mqttBridge.js` | `client.connected` và `lastSensorMessageAt` chỉ tồn tại trong bộ nhớ tiến trình. |
| `HARDWARE_STALE_MS` | Ngưỡng quá hạn; mặc định 6000 ms. |

---

## 7. Tài khoản và hồ sơ

Chạy `npm run db:migrate:auth` trong `BE` để thêm cột tài khoản/hồ sơ vào `users` và bảng `auth_sessions`. Các cột mới nullable nên không sửa dữ liệu của người dùng cũ. Mật khẩu đăng ký được băm vào `password_hash`; đăng nhập hiện chưa đối chiếu cột này. Tài khoản cũ chưa có `username` chưa thể đăng nhập.

| Method | Endpoint | Request | Kết quả |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | `fullName`, `username`, `password`; tùy chọn `email`, `studentId`, `phone`, `githubUrl`, `figmaUrl`, `reportUrl`, `postmanUrl` | `201`, thông tin người dùng và cookie phiên. `username` trùng trả `409`; không kiểm tra độ dài mật khẩu. |
| POST | `/api/auth/login` | `username`, `password` | `200`, thông tin người dùng và cookie phiên; chỉ xét username, username không tồn tại trả `401`. |
| GET | `/api/auth/me` | Cookie phiên nếu có | `200`, thông tin người dùng hoặc `null` nếu là khách. |
| PUT | `/api/auth/me` | Cookie phiên; `fullName` và các trường hồ sơ tùy chọn | `200`, hồ sơ đã cập nhật; khách trả `401`. Không sửa username. |
| POST | `/api/auth/logout` | Cookie phiên nếu có | `204`, xóa phiên trên DB và cookie ở trình duyệt. |
| PUT | `/api/auth/avatar` | Cookie phiên, body ảnh JPG/PNG/WebP tối đa 2 MB; `Content-Type` là MIME ảnh | `200`, hồ sơ có `avatarFile` mới; khách trả `401`, sai loại ảnh trả `400`, ảnh quá lớn trả `413`. |
| GET | `/api/auth/avatar` | Cookie phiên | `200`, ảnh của tài khoản hiện tại; chưa có ảnh trả `404`, khách trả `401`. |

Mật khẩu đăng ký được băm bằng `scrypt` nhưng mật khẩu nhập lúc đăng nhập hiện bị bỏ qua; ai biết username của một tài khoản đều có thể đăng nhập vào tài khoản đó. Cookie phiên là token ngẫu nhiên HttpOnly, SameSite=Lax; DB chỉ lưu hash token. Phiên hết hạn sau 30 ngày. Các URL hồ sơ chỉ nhận `http` hoặc `https`.

Ảnh đại diện lưu riêng trong `BE/uploads/avatars`, còn `users.avatar_file` lưu tên file. Sidebar và Profile dùng ảnh của tài khoản đăng nhập; khi chưa tải ảnh, giao diện hiển thị chữ cái đầu tên. Thư mục ảnh không nằm trong Git nên cần sao lưu cùng DB khi chuyển máy.

---

## 8. Kiểm tra các endpoint được nêu trong báo cáo

Kết quả dựa trên route được mount trong `BE/src/app.js`, toàn bộ file route và lần gọi local ngày 17/10/2026:

| Endpoint được hỏi | Có tồn tại? | Kết quả thực tế | Giải thích |
| --- | --- | --- | --- |
| `/api/dashboard` | Không | `404`, HTML Express | Dashboard là trang React. Nó tổng hợp `/api/data-sensor`, `/api/devices`, `/api/history` và `/api/hardware/status`. |
| `/api/devices/control` | Không | `404`, HTML Express | Điều khiển được tạo bằng `POST /api/history`; `device/control` chỉ là tên topic MQTT. |
| `/api/action-history` | Không | `404`, HTML Express | Endpoint hiện tại là `/api/history` cho cả GET và POST. Tên bảng DB mới là `action_history`. |
| `/api/profile` | Không | `404`, HTML Express | Profile gọi `GET/PUT /api/auth/me`; không có endpoint `/api/profile`. |

Không nên thêm bốn endpoint này vào báo cáo như API đang hoạt động. Postman Collection có nhóm “Endpoint audit” để xác nhận 404.

## 9. Đối chiếu với `HUONG_DAN_HOC_BACKEND_IOT.md`

### Nội dung khớp mã nguồn

- Năm operation dữ liệu/thiết bị ban đầu vẫn đúng; hệ thống đã thêm năm operation tài khoản.
- Luồng Route → Controller → Service → Repository đúng với ba nhóm chính; ngoại lệ Hardware đã được chính tài liệu học ghi rõ.
- Luồng `POST /api/history` → `PENDING` → MQTT `device/control` → MQTT `device/status` đúng.
- Các bảng `sensors`, `data_sensor`, `devices`, `action_history`, `users`, `auth_sessions` khớp các câu SQL trong repository.
- Quy tắc online/offline dựa trên MQTT và dữ liệu cảm biến, mặc định 6 giây, khớp code.
- Frontend Profile dùng `GET/PUT /api/auth/me` để đọc và sửa hồ sơ.

### Khác biệt hoặc điểm cần làm rõ

| Vị trí/nội dung trong tài liệu học | Mã nguồn thực tế | Kết luận |
| --- | --- | --- |
| Ví dụ `GET /api/devices` ở mục HTTP không có `updatedAt`. | Repository luôn thêm `updatedAt` (ISO hoặc `null`). | Ví dụ trong tài liệu học thiếu một trường response. |
| Sequence điều khiển ghi “API trả actionId”. | `POST /api/history` trả một history row với khóa `id`; MQTT payload sau đó mới đổi khóa này thành `actionId`. | Cần phân biệt tên trường HTTP `id` và MQTT `actionId`. |
| Mô tả `FAILED` có thể khiến người đọc hiểu rằng DB luôn được cập nhật khi lệnh hết hạn. | `GET /api/history` dùng biểu thức `CASE` để hiển thị lệnh `PENDING` quá hạn thành `FAILED`, nhưng không UPDATE DB. DB chỉ được UPDATE thành `FAILED` khi có `device/status` mang `actionId` cho lệnh đã hết hạn. | Response API và giá trị đang lưu trong DB có thể khác nhau đối với lệnh quá hạn chưa có phản hồi. |
| ERD liệt kê đầy đủ cột/schema. | `BE/scripts/migrate-auth.js` tạo phần schema tài khoản; schema cảm biến/thiết bị vẫn cần đối chiếu MySQL. | Các ràng buộc/cột không dùng trong SQL cần đối chiếu schema MySQL riêng nếu đưa vào báo cáo chính thức. |
| Tài liệu không liệt kê bốn đường dẫn `/api/dashboard`, `/api/devices/control`, `/api/action-history`, `/api/profile` như API. | Tất cả đều 404. | Không có mâu thuẫn; cần ghi rõ để tránh nhầm trang FE, topic MQTT hoặc tên bảng thành REST endpoint. |

## 10. Postman Collection và kiểm thử

Các file:

- `docs/postman/IoT_API.postman_collection.json`
- `docs/postman/IoT_Local.postman_environment.json`

Collection được phân nhóm DataSensor, Device, ActionHistory, Hardware và Endpoint audit. Test scripts kiểm tra:

- HTTP status.
- Header JSON với các endpoint có JSON.
- Kiểu response gốc: object hoặc array.
- Các trường bắt buộc và kiểu dữ liệu từng dòng.
- Enum `sensorType`, `action`, `status` mà hệ thống đang dùng.
- ISO datetime và cấu trúc phân trang.
- Response lỗi `400`, `422` và bốn endpoint 404.

Request POST thành công có thể điều khiển thiết bị thật. Collection mặc định đặt biến `runWriteTests=false`, nên request này được skip bằng pre-request script. Chỉ đổi thành `true` sau khi xác nhận đúng `controlDeviceId`, `controlAction`, broker và phần cứng.

### Import

1. Mở Postman → **Import**.
2. Chọn hai file JSON trong `docs/postman/`.
3. Chọn environment **IoT Local**.
4. Kiểm tra `baseUrl` là `http://localhost:3001`.
5. Chạy backend bằng `cd BE`, sau đó `npm start`.

### Chạy an toàn

1. Mở Collection Runner.
2. Chọn **IoT API** và environment **IoT Local**.
3. Giữ `runWriteTests=false` để chỉ chạy GET, validation lỗi không ghi DB và kiểm tra 404.
4. Run collection và xem tab **Test Results**.

### Kiểm thử lệnh điều khiển

1. Bảo đảm `GET /api/hardware/status` trả `connected: true`.
2. Dùng `GET /api/devices` chọn một thiết bị không có `pendingActionId`.
3. Đặt collection variable `controlDeviceId` bằng ID đó và `controlAction` là `ON` hoặc `OFF`.
4. Đặt `runWriteTests=true` rồi chỉ chạy request **Create command - success (manual, writes DB)**.
5. Kỳ vọng `201`, response `status: "PENDING"`; sau đó gọi lại Devices/History để quan sát xác nhận từ mạch.

Các nhánh `404`, `409`, `503` của POST cần trạng thái runtime cụ thể như bảng ở mục 5; không nên giả lập bằng cách sửa code hoặc tự coi một response khác là đúng. Với `409`, gửi lệnh thứ hai cho cùng thiết bị trong lúc lệnh đầu vẫn còn `PENDING`. Với `503`, chạy khi backend/MQTT sensor stream không live. Với `404`, cần một ID nằm trong `MQTT_DEVICE_IDS` nhưng không có trong bảng `devices` và mạch phải live.

## 11. Kết quả xác minh

- `npm test` tại `BE` sau khi thêm tài khoản: 13 test pass, 0 fail, 1 test ghi rồi rollback được skip vì `DB_WRITE_ROLLBACK_TEST` không bật.
- GET DataSensor, Device, ActionHistory và Hardware đều trả `200` với CSDL local tại thời điểm kiểm tra.
- POST ActionHistory body sai trả đúng `400` và JSON đã mô tả.
- Bốn endpoint nghi vấn đều trả `404` HTML.

Các route `/api/auth/*` và việc gắn `user_id` cho lệnh điều khiển được bổ sung ngày 22/10/2026; luồng MQTT và điều khiển thiết bị giữ nguyên.
