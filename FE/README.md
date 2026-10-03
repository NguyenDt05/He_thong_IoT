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

- **Dashboard:** thẻ cảm biến lấy bản ghi mới nhất theo từng loại từ DB và làm mới mỗi 15 giây. Giá trị cuối cùng được lưu trong trình duyệt để vẫn xem được sau khi ngắt kết nối. Biểu đồ dùng chuỗi dữ liệu minh họa cố định.
- **Dữ liệu cảm biến:** chọn tiêu chí Tất cả, Loại cảm biến, Ngày giờ hoặc Giá trị, nhập từ khóa rồi nhấn Tìm kiếm để lọc bảng từ DB; Loại bỏ lọc đưa bảng về danh sách đầy đủ. Trang đã tải thành công được lưu trong trình duyệt theo bộ lọc và số trang; khi API lỗi, trang hiển thị lại bản đã lưu kèm thông báo.
- **Lịch sử hoạt động:** bảng, bộ lọc và phân trang lấy từ DB. Cột Người dùng hiển thị xen kẽ `thaonguyen` và `nguyễn văn a` theo ID bản ghi.
- **Công tắc đèn:** chỉ đổi trạng thái trên giao diện và gửi một bản ghi thao tác vào lịch sử; không điều khiển phần cứng hay cập nhật trạng thái thiết bị trong DB.
- **Profile:** thông tin cá nhân của Đặng Thảo Nguyên.
