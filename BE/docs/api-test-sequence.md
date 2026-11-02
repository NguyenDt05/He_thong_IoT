# Kiểm thử toàn bộ HTTP API theo thứ tự

Chạy PowerShell trong thư mục `BE`. Backend dùng `http://localhost:3001`; frontend Vite dùng proxy `/api`. Trước lần test đầu tiên, chạy `npm run db:migrate:auth`, `npm run db:migrate:alerts`, `npm run db:migrate:required-auth` khi backend đã dừng, rồi chạy `npm start`. Tài khoản test được tạo ở bước 2 sẽ còn trong database.

```powershell
$base = 'http://localhost:3001/api'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
```

## 1. Kiểm tra chặn truy cập chưa đăng nhập

Mở `GET $base/auth/me`, `GET $base/data-sensor`, `GET $base/devices`, `GET $base/history`, `GET $base/hardware/status`, `GET $base/hardware/alerts` mà không gửi cookie. Tất cả phải trả `401` với `{"error":"Vui lòng đăng nhập"}`. `PUT /api/auth/me`, `GET/PUT /api/auth/avatar`, `POST /api/history`, `PUT /api/hardware/alerts/thresholds` cũng phải trả `401`.

Ví dụ một yêu cầu:

```powershell
try { Invoke-RestMethod "$base/devices" } catch { [int]$_.Exception.Response.StatusCode }
```

## 2. Đăng ký, đọc hồ sơ, đăng xuất, đăng nhập

```powershell
$username = 'iot_test_' + (Get-Date -Format 'yyyyMMddHHmmss')
$password = 'TestPassword123!'
$registerBody = @{ fullName = 'Người dùng kiểm thử'; username = $username; password = $password } | ConvertTo-Json
$registered = Invoke-RestMethod "$base/auth/register" -Method Post -ContentType 'application/json' -Body $registerBody -WebSession $session
$registered | Format-List
```

Kỳ vọng `201`, có `userId`, `username`; response không chứa `passwordHash`. Cookie `iot_session_v2` được lưu trong `$session`.

```powershell
Invoke-RestMethod "$base/auth/me" -WebSession $session
Invoke-RestMethod "$base/auth/logout" -Method Post -WebSession $session
try { Invoke-RestMethod "$base/auth/me" -WebSession $session } catch { [int]$_.Exception.Response.StatusCode }
$loginBody = @{ username = $username; password = $password } | ConvertTo-Json
$loggedIn = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body $loginBody -WebSession $session
$loggedIn | Format-List
```

Kỳ vọng: `GET /me` đầu tiên trả hồ sơ, sau logout trả `401`, login trả `200` và cookie phiên mới. Thử mật khẩu sai với `POST /auth/login`: kỳ vọng `401`.

## 3. Cập nhật và đọc lại hồ sơ

```powershell
$profile = @{
  fullName = 'Người dùng kiểm thử cập nhật'
  email = 'iot-test@example.com'
  studentId = 'TEST001'
  phone = '0123456789'
  githubUrl = 'https://github.com/example'
  figmaUrl = ''
  reportUrl = ''
  postmanUrl = ''
} | ConvertTo-Json
Invoke-RestMethod "$base/auth/me" -Method Put -ContentType 'application/json' -Body $profile -WebSession $session
Invoke-RestMethod "$base/auth/me" -WebSession $session
```

Kỳ vọng `200` ở cả hai; tên, email và các trường khác phản ánh dữ liệu vừa lưu. Tài khoản khác không thể truyền `userId` để sửa hồ sơ này; backend dùng `userId` từ cookie.

## 4. Tải và đọc ảnh đại diện

Đặt `$avatarPath` thành đường dẫn tới một ảnh PNG thật, nhỏ hơn 2 MB. Có thể thay `image/png` bằng `image/jpeg` hoặc `image/webp` đúng với tệp.

```powershell
$avatarPath = 'C:\duong-dan\avatar.png'
Invoke-RestMethod "$base/auth/avatar" -Method Put -ContentType 'image/png' -InFile $avatarPath -WebSession $session
Invoke-WebRequest "$base/auth/avatar" -WebSession $session -OutFile "$env:TEMP\iot-avatar-test.png"
```

Kỳ vọng upload `200` với `avatarFile`, đọc ảnh `200` và tệp tải về mở được. Trước khi upload, `GET /auth/avatar` có thể trả `404`.

## 5. Đọc dữ liệu hệ thống

```powershell
$status = Invoke-RestMethod "$base/hardware/status" -WebSession $session
$alerts = Invoke-RestMethod "$base/hardware/alerts" -WebSession $session
$sensors = Invoke-RestMethod "$base/data-sensor?page=1&limit=20&criterion=all" -WebSession $session
$devices = Invoke-RestMethod "$base/devices" -WebSession $session
$history = Invoke-RestMethod "$base/history?page=1&limit=20" -WebSession $session
$status; $alerts; $sensors; $devices; $history
```

Kỳ vọng cả 5 API trả `200`. `data-sensor` và `history` có `data`, `page`, `limit`, `total`; `devices` là mảng. Nếu chưa có dữ liệu cảm biến, `data` có thể rỗng.

## 6. Cập nhật ngưỡng cảnh báo

Gửi giá trị mới rồi khôi phục giá trị cũ. Việc đổi ngưỡng có thể ảnh hưởng cảnh báo trên ESP32 trong lúc test.

```powershell
$old = $alerts.thresholds
$newTemperature = if ($old.TEMPERATURE -lt 125) { [math]::Round($old.TEMPERATURE + 0.01, 2) } else { 124.99 }
$newThresholds = @{ TEMPERATURE = $newTemperature; HUMIDITY = $old.HUMIDITY; LIGHT = $old.LIGHT }
$newBody = @{ thresholds = $newThresholds } | ConvertTo-Json -Depth 3
Invoke-RestMethod "$base/hardware/alerts/thresholds" -Method Put -ContentType 'application/json' -Body $newBody -WebSession $session
Invoke-RestMethod "$base/hardware/alerts" -WebSession $session
$restoreBody = @{ thresholds = $old } | ConvertTo-Json -Depth 3
Invoke-RestMethod "$base/hardware/alerts/thresholds" -Method Put -ContentType 'application/json' -Body $restoreBody -WebSession $session
```

Kỳ vọng `200`, lần đọc giữa chừng thấy nhiệt độ mới, lần đọc cuối trở về giá trị cũ. `brokerUpdated: false` chỉ có nghĩa MQTT đang ngắt; giá trị vẫn được lưu và sẽ gửi lại khi kết nối.

## 7. Gửi lệnh thiết bị và kiểm tra lịch sử

Cần ESP32/MQTT đang gửi số đo: `$status.connected` phải là `True`. Chọn một thiết bị trong `$devices`, rồi gửi trạng thái ngược với trạng thái hiện tại.

```powershell
$status = Invoke-RestMethod "$base/hardware/status" -WebSession $session
$devices = Invoke-RestMethod "$base/devices" -WebSession $session
$device = $devices | Select-Object -First 1
$action = if ($device.status -eq 'ON') { 'OFF' } else { 'ON' }
$commandBody = @{ deviceId = $device.deviceId; action = $action } | ConvertTo-Json
$command = Invoke-RestMethod "$base/history" -Method Post -ContentType 'application/json' -Body $commandBody -WebSession $session
$command
Start-Sleep -Seconds 3
Invoke-RestMethod "$base/history?page=1&limit=20" -WebSession $session
```

Kỳ vọng `POST` trả `201` với trạng thái `PENDING`, sau phản hồi từ mạch chuyển thành `SUCCESS` hoặc `FAILED`; dòng mới có tên người dùng kiểm thử, không có `username: null`. Nếu mạch chưa kết nối, API trả `503`; nếu thiết bị đang chờ lệnh khác, trả `409`.

## 8. Kiểm tra đăng xuất và ràng buộc database

```powershell
Invoke-RestMethod "$base/auth/logout" -Method Post -WebSession $session
try { Invoke-RestMethod "$base/history" -WebSession $session } catch { [int]$_.Exception.Response.StatusCode }
```

Kỳ vọng logout `204`; API lịch sử sau đó trả `401`. Trong MySQL, chạy:

```sql
SELECT COUNT(*) AS null_user_rows FROM action_history WHERE user_id IS NULL;
SHOW COLUMNS FROM action_history LIKE 'user_id';
```

Kỳ vọng `null_user_rows = 0` và `Null = NO`. Các sự kiện cũ không có người dùng thật được gắn với `Khách trước đây`; sự kiện tự phát từ mạch được gắn với `Hệ thống IoT`.
