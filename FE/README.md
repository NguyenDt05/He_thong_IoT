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
| Dashboard: thẻ cảm biến và biểu đồ | Gọi `GET /api/data-sensor` riêng cho `TEMPERATURE`, `HUMIDITY`, `LIGHT` mỗi 2 giây. Trước khi có phản hồi thành công hoặc trang cảm biến đã lưu, hiển thị chuỗi mô phỏng từ `src/pages/Dashboard/mockData.js`. Service có thể trả trang API đã lưu trong `localStorage` khi mất kết nối. Giá trị mới nhất còn được Dashboard lưu riêng trong `localStorage`. Khi ít nhất một truy vấn trả về (kể cả trang rỗng hoặc trang đã lưu), Dashboard chuyển sang biểu đồ dữ liệu API/cache; loại cảm biến thiếu dữ liệu có thể hiện `--` hoặc giá trị cũ. |
| Dashboard: danh sách đèn | Gọi `GET /api/devices` một lần khi mở trang. Trong lúc chờ và khi gọi lỗi, hiển thị ba đèn mẫu từ `mockData.js`; khi thành công, thay bằng danh sách thiết bị từ BE. |
| Dashboard: công tắc đèn | Trạng thái bật/tắt chỉ nằm trên giao diện và trong `localStorage`, không đọc/cập nhật `devices.status`. Đèn thật trong danh sách BE gửi `POST /api/history` để ghi thao tác; đèn mẫu không gửi. Nếu POST lỗi, trạng thái trên giao diện vẫn đã đổi. Không có lệnh điều khiển phần cứng. |
| Dữ liệu cảm biến | Gọi `GET /api/data-sensor` khi mở trang hoặc đổi phân trang/bộ lọc. Trang API đã tải được lưu trong `localStorage` theo truy vấn; bản đã lưu có thể hiện ngay hoặc khi API lỗi. Không dùng `mockData.js`. |
| Lịch sử hoạt động | Gọi `GET /api/history` khi mở trang hoặc đổi phân trang/bộ lọc; danh sách cho bộ lọc thiết bị đến từ `GET /api/devices`. Không dùng mock ở FE. BE hiện tạo tên người dùng minh họa `thaonguyen` hoặc `nguyễn văn a` từ tính chẵn lẻ của ID bản ghi, không đọc người dùng thật từ DB. |
| Profile | Thông tin cá nhân và liên kết ghi cố định trong `Profile.jsx`; không gọi API. |

`mockData.js` chỉ được Dashboard dùng. Nó là dữ liệu mô phỏng trên giao diện, không được ghi vào MySQL. File `chartData.js` không có trong cây mã nguồn hiện tại.
