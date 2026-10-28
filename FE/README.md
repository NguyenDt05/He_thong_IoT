# Giao diện hệ thống IoT

## Chạy tại máy

Khởi động BE theo [hướng dẫn của BE](../BE/README.md), sau đó chạy:

```powershell
cd FE
npm install
npm run dev
```

Vite chuyển tiếp `/api` tới `http://localhost:3001`. Có thể đặt `VITE_API_BASE_URL` khi cần gọi một API khác. Với bản build tĩnh, cấu hình web server chuyển tiếp `/api` đến BE hoặc đặt biến này lúc build.

## Nguồn dữ liệu

Các lời gọi HTTP nằm trong `src/services/`. `apiConfig.js` chọn gốc API từ `VITE_API_BASE_URL`, mặc định là `/api`. Backend đọc MySQL; không tự tạo dữ liệu cảm biến hoặc thiết bị mẫu.

| Giao diện | Nguồn và cách cập nhật |
| --- | --- |
| Dashboard: thẻ cảm biến và biểu đồ | Gọi `GET /api/data-sensor` riêng cho `TEMPERATURE`, `HUMIDITY`, `LIGHT` mỗi 2 giây và chỉ dùng bản ghi MySQL. Lưu số đo cuối và tối đa 20 điểm biểu đồ mỗi loại trong `localStorage`; khi mạch ngừng gửi hoặc API lỗi, giữ nguyên các giá trị và biểu đồ đó. Trục X dàn đều các lần đo để tránh ép các điểm khi lịch sử có khoảng trống dài; thời gian thật vẫn hiện trong tooltip và đường được ngắt ở khoảng ngừng đo. Gọi `GET /api/hardware/status` độc lập mỗi giây để cập nhật thông báo kết nối ngay cả khi request dữ liệu cảm biến bị chậm. |
| Dashboard: danh sách đèn | Gọi `GET /api/devices` mỗi 2 giây để lấy trạng thái thật và lệnh đang chờ. |
| Dashboard: công tắc đèn | Chỉ cho gửi lệnh khi mạch đang kết nối. `POST /api/history` tạo lệnh `PENDING`; nút chờ mạch xác nhận và chỉ đổi trạng thái khi `devices.status` trong DB đổi. |
| Dữ liệu cảm biến | Gọi `GET /api/data-sensor` với một `criterion` tương ứng lựa chọn `all`, `temperature`, `humidity`, `light` hoặc `datetime` khi mở trang hay đổi phân trang/tìm kiếm. Trang API đã tải được lưu trong `localStorage` theo truy vấn; bản đã lưu có thể hiện ngay hoặc khi API lỗi. |
| Lịch sử hoạt động | Gọi `GET /api/history` khi mở trang hoặc đổi phân trang/bộ lọc; tên người dùng đến từ bảng `users` nếu có. Bản ghi không có `user_id` hiển thị dấu gạch ngang. |
| Đăng ký/đăng nhập | Đăng ký yêu cầu mật khẩu 8–128 ký tự; đăng nhập kiểm tra cả username và mật khẩu qua API `/api/auth`, giữ phiên bằng cookie HttpOnly. Khách vẫn xem và điều khiển thiết bị. |
| Profile | `GET /api/auth/me` lấy hồ sơ khi đã đăng nhập; `PUT /api/auth/me` lưu thông tin cá nhân và bốn URL. `PUT /api/auth/avatar` tải ảnh lên, `GET /api/auth/avatar` hiển thị ảnh. Người chưa tải ảnh thấy chữ cái đầu tên. |

Cấu hình cầu nối MQTT cho firmware ESP32 và cách bật LED 3 nằm trong [hướng dẫn backend](../BE/README.md). Backend dùng các topic và khóa JSON của mã Arduino hiện tại.
