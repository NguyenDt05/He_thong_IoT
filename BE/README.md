# IoT backend

## Chạy với firmware ESP32 hiện tại

Trong `BE/.env`, cấu hình `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MQTT_URL`, `MQTT_USER`, `MQTT_PASSWORD`. `MQTT_URL` có dạng `mqtt://<địa chỉ broker>:<cổng>` và phải trỏ tới cùng broker với firmware. File `.env` được Git bỏ qua; tham khảo [.env.example](.env.example). Trên máy đang dùng, các thông số MQTT được đặt trong `BE/.env` theo mã Arduino bạn cung cấp.

```powershell
cd BE
npm install
npm start
```

Backend tự kết nối lại broker khi mất mạng. Cần chạy **một** tiến trình backend làm cầu nối MQTT để tránh xử lý trùng bản tin. Backend dùng `sensors`, `data_sensor`, `devices`, `action_history`, `users` trong MySQL hiện có; không tự tạo bản ghi mẫu.

Chạy `npm run db:migrate:auth` một lần trước khi dùng tài khoản. Lệnh thêm các cột nullable vào `users` (`username`, `password_hash`, `avatar_file`, mã sinh viên, số điện thoại và bốn URL) cùng bảng `auth_sessions`; có thể chạy lại mà không xóa người dùng cũ. Tài khoản cũ chưa có `username` sẽ không đăng nhập được cho đến khi được bổ sung tên đăng nhập.

| Topic từ firmware | Dữ liệu | Xử lý backend |
| --- | --- | --- |
| `sensor/data` | `{ "temperature": 27.4, "humidity": 68, "light": 35 }` | Ánh xạ ba loại tới `sensor_id` trong bảng `sensors` và ghi đồng thời vào `data_sensor` với thời gian nhận thực. |
| `device/status` | `{ "actionId": 123, "deviceId": 1, "status": "ON" }` hoặc `{ "deviceId": 1, "status": "ON" }` | Luôn cập nhật `devices.status` theo trạng thái chân ESP32 báo về. `actionId` là tùy chọn và chỉ dùng để đặt lịch sử `SUCCESS` hoặc `FAILED` khi phản hồi một lệnh từ Dashboard. |
| `device/control` | `{ "actionId": 123, "deviceId": 1, "command": "ON" }` | Backend phát lệnh đang chờ mỗi giây cho đến khi mạch phản hồi hoặc lệnh hết hạn. Firmware hiện đã xử lý đúng ba khóa này. |

Firmware gửi cảm biến mỗi 2 giây. `HARDWARE_STALE_MS` mặc định `6000` ms: Dashboard kiểm tra trạng thái riêng mỗi giây và báo ngắt mạch khi không nhận đủ ba loại số đo trong thời gian này. `HARDWARE_COMMAND_TIMEOUT_MS` mặc định `30000` ms: lệnh quá hạn không còn được phát, và phản hồi tới trễ không được xem là thành công. Bản tin MQTT sử dụng QoS 0 như firmware hiện tại; lệnh được phát lại để xử lý trường hợp bản tin bị mất. Firmware dùng `actionId` trong phản hồi để backend ghép đúng lệnh.

Sau mọi thay đổi trạng thái LED, kể cả lệnh nhận trực tiếp từ terminal, firmware phải phát `device/status`. Khi kết nối lại MQTT, firmware nên phát lại trạng thái của cả ba LED để backend đồng bộ trạng thái vật lý hiện tại trước khi Dashboard đọc API.

`MQTT_DEVICE_IDS` mặc định `1,2,3`, tương ứng ba LED mà firmware xử lý. Dashboard chỉ hiển thị các thiết bị có ID nằm trong danh sách này. Sau khi thay đổi cấu hình, cần khởi động lại backend để nạp danh sách mới.

## API giao diện

- `GET /api/hardware/status` trả `connected`, lần đo cuối của từng loại cảm biến và ngưỡng quá hạn. `connected` chỉ đúng khi cầu nối MQTT vừa nhận và lưu số đo cùng cả ba loại có bản ghi mới. Đây là trạng thái dựa trên dữ liệu, không phải cảm biến phát hiện cắm/rút vật lý.
- `GET /api/data-sensor?page=1&limit=20&criterion=all&key=` trả số đo từ `data_sensor` nối với `sensors`, mới nhất trước. `criterion` nhận `all`, `temperature`, `humidity`, `light`, `datetime`; với một loại cảm biến, `key` được tìm trong giá trị đo.
- `GET /api/devices` đọc thiết bị từ MySQL, gồm `status` thật và `pendingActionId` nếu có lệnh đang chờ còn hiệu lực.
- `POST /api/history` với `{ "deviceId": 1, "action": "ON" }` hoặc `OFF` xếp lệnh `PENDING`, trả `201`. Nếu thiết bị đã có lệnh đang chờ, trả `409`; nếu firmware chưa hỗ trợ `deviceId`, trả `422`; khi mạch không gửi số đo mới, trả `503`.
- `GET /api/history` đọc lịch sử và tên người dùng từ bảng `users` nếu bản ghi có `user_id`. Bản ghi không có người dùng trả `username: null`, không tạo tên minh họa.
- `POST /api/auth/register` tạo tài khoản với `fullName`, `username`, `password` và các trường hồ sơ tùy chọn; đồng thời đăng nhập. Mật khẩu được băm khi lưu nhưng không kiểm tra độ dài.
- `POST /api/auth/login` nhận `username`, `password` nhưng hiện chỉ xét `username`; `POST /api/auth/logout` xóa phiên hiện tại.
- `GET /api/auth/me` trả hồ sơ hoặc `null` nếu là khách; `PUT /api/auth/me` cập nhật họ tên, email, mã sinh viên, số điện thoại và các URL. Phiên dùng cookie HttpOnly, lưu trong `auth_sessions` 30 ngày; không dùng JWT.
- `PUT /api/auth/avatar` nhận trực tiếp nội dung ảnh JPG, PNG hoặc WebP tối đa 2 MB với `Content-Type` tương ứng; `GET /api/auth/avatar` trả ảnh của tài khoản đang đăng nhập. File nằm trong `BE/uploads/avatars` (được Git bỏ qua), DB chỉ lưu tên file trong `users.avatar_file`. Khi chuyển máy hoặc sao lưu DB, cần sao lưu thư mục ảnh cùng DB.
- Khách vẫn gọi các API xem dữ liệu và `POST /api/history` như trước. Lệnh từ tài khoản đang đăng nhập ghi `action_history.user_id` theo phiên hợp lệ; khách ghi `NULL`.

Các API danh sách trả `{ data, page, limit, total, totalPages }`; `limit` mặc định là `20` và tối đa là `100`. Thời gian lưu và hiển thị theo giờ Việt Nam. DB hiện không có trường nguồn để phân biệt bản ghi cảm biến thử nghiệm với bản ghi đo thật đã tồn tại; cần xác nhận nguồn trước khi xóa hay lọc chúng.

Chạy `npm test` để kiểm tra API đọc, dữ liệu MQTT và xử lý trạng thái. Các test mặc định không ghi DB; phép thử ghi rồi rollback chỉ chạy khi đặt `DB_WRITE_ROLLBACK_TEST=1`.
