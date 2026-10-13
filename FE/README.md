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
| Dashboard: thẻ cảm biến và biểu đồ | Gọi `GET /api/data-sensor` riêng cho `TEMPERATURE`, `HUMIDITY`, `LIGHT` mỗi 2 giây. Mặc định `FE/.env` đặt `VITE_SENSOR_MODE=demo`: Dashboard phát lại tối đa 15 giá trị lấy từ BE; khi BE trả trang rỗng cho một loại cảm biến, dùng dãy cố định trong `mockData.js` cho loại đó. Nếu đặt `VITE_SENSOR_MODE=real`, Dashboard hiển thị bản ghi thật, giữ tối đa 10 bản ghi mỗi loại trên biểu đồ và lưu giá trị mới nhất trong `localStorage`. Service có thể trả trang API đã lưu khi mất kết nối, nhưng Dashboard báo lỗi nếu không lấy được dữ liệu mới. |
| Dashboard: danh sách đèn | Gọi `GET /api/devices` một lần khi mở trang. Trong lúc chờ hoặc khi API lỗi, hiển thị thông báo tương ứng; không tạo đèn mẫu. |
| Dashboard: công tắc đèn | Trạng thái bật/tắt chỉ nằm trên giao diện và trong `localStorage`, không đọc/cập nhật `devices.status`. Mỗi thao tác gửi `POST /api/history` để ghi lịch sử. Nếu POST lỗi, trạng thái trên giao diện vẫn đã đổi. Không có lệnh điều khiển phần cứng. |
| Dữ liệu cảm biến | Gọi `GET /api/data-sensor` khi mở trang hoặc đổi phân trang/bộ lọc. Trang API đã tải được lưu trong `localStorage` theo truy vấn; bản đã lưu có thể hiện ngay hoặc khi API lỗi. Không dùng `mockData.js`. |
| Lịch sử hoạt động | Gọi `GET /api/history` khi mở trang hoặc đổi phân trang/bộ lọc; danh sách cho bộ lọc thiết bị đến từ `GET /api/devices`. Không dùng mock ở FE. BE hiện tạo tên người dùng minh họa `thaonguyen` hoặc `nguyễn văn a` từ tính chẵn lẻ của ID bản ghi, không đọc người dùng thật từ DB. |
| Profile | Thông tin cá nhân và liên kết ghi cố định trong `Profile.jsx`; không gọi API. |

`mockData.js` chỉ được Dashboard dùng khi chạy chế độ demo. Dữ liệu mô phỏng trên giao diện không được ghi vào MySQL.
