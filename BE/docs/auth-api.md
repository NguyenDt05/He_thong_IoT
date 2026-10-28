# API xác thực và hồ sơ

Base URL khi chạy local: `http://localhost:3001`. Các API bên dưới dùng tiền tố `/api/auth`.

Backend lưu người dùng trong MySQL và lưu phiên trong `auth_sessions`. Đăng ký và đăng nhập trả cookie `iot_session_v2` với `HttpOnly`, `SameSite=Lax`, thời hạn 30 ngày; môi trường production bật thêm `Secure`. Client cần gửi cookie này khi gọi API hồ sơ và ảnh đại diện. Phản hồi tài khoản không chứa mật khẩu hay hash mật khẩu.

## Đăng ký

`POST /api/auth/register` với `Content-Type: application/json`.

```json
{
  "fullName": "Nguyễn Văn A",
  "username": "nguyenvana",
  "password": "mat-khau-tu-8-ky-tu",
  "email": "a@example.com",
  "studentId": "B23DCCN001",
  "phone": "0123456789",
  "githubUrl": "https://github.com/example",
  "figmaUrl": "",
  "reportUrl": "",
  "postmanUrl": ""
}
```

`fullName`, `username`, `password` là bắt buộc. `username` gồm 3–50 ký tự chữ Latin, số, `_`, `.` hoặc `-`; mật khẩu dài 8–128 ký tự. Các trường còn lại tùy chọn; URL phải dùng HTTP hoặc HTTPS. Thành công trả `201 Created`, đối tượng người dùng và cookie phiên. Dữ liệu sai trả `400`; username trùng trả `409`.

## Đăng nhập

`POST /api/auth/login` với `Content-Type: application/json`.

```json
{ "username": "nguyenvana", "password": "mat-khau-tu-8-ky-tu" }
```

Backend lấy hash từ MySQL và kiểm tra mật khẩu bằng scrypt. Thành công trả `200 OK`, đối tượng người dùng và cookie phiên. Sai tên đăng nhập hoặc mật khẩu trả `401`.

## Lấy hồ sơ hiện tại

`GET /api/auth/me` yêu cầu cookie phiên. Thành công trả `200 OK`:

```json
{
  "userId": 1,
  "fullName": "Nguyễn Văn A",
  "username": "nguyenvana",
  "email": "a@example.com",
  "avatarFile": null,
  "studentId": "B23DCCN001",
  "phone": "0123456789",
  "githubUrl": "https://github.com/example",
  "figmaUrl": null,
  "reportUrl": null,
  "postmanUrl": null
}
```

Chưa đăng nhập hoặc phiên hết hạn trả `401`.

## Cập nhật hồ sơ

`PUT /api/auth/me` yêu cầu cookie phiên và `Content-Type: application/json`. Body chứa `fullName` và các trường tùy chọn `email`, `studentId`, `phone`, `githubUrl`, `figmaUrl`, `reportUrl`, `postmanUrl` như ví dụ đăng ký. Trường tùy chọn bị bỏ qua hoặc để rỗng sẽ thành `null`; `username` và mật khẩu không được cập nhật qua API này. Thành công trả `200 OK` cùng đối tượng người dùng sau cập nhật. Dữ liệu sai trả `400`; chưa đăng nhập trả `401`.

## Đăng xuất

`POST /api/auth/logout` xóa phiên hiện tại và cookie, trả `204 No Content`. Có thể gọi khi cookie đã hết hạn.

## Tải ảnh đại diện lên

`PUT /api/auth/avatar` yêu cầu cookie phiên. Body là **nội dung file ảnh trực tiếp**, với `Content-Type: image/jpeg`, `image/png` hoặc `image/webp`; giới hạn 2 MB. Thành công trả `200 OK` cùng đối tượng người dùng có `avatarFile` mới. Loại ảnh hoặc nội dung sai trả `400`; chưa đăng nhập trả `401`; ảnh vượt giới hạn trả `413`.

## Lấy ảnh đại diện

`GET /api/auth/avatar` yêu cầu cookie phiên, trả `200 OK` với file ảnh và `Content-Type` tương ứng. Chưa đăng nhập trả `401`; tài khoản chưa có ảnh trả `404`. Frontend có thể thêm `?v=<avatarFile>` để làm mới cache khi ảnh thay đổi.
