require("dotenv").config();

const express = require("express");
const cors = require("cors");

const dataSensorRoute = require("./routes/dataSensorRT");
const deviceRoute = require("./routes/deviceRT");
const historyRoute = require("./routes/historyRT");

// Khởi tạo API: nhận JSON, cho phép CORS và gắn ba nhóm đường dẫn.
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/data-sensor", dataSensorRoute);
app.use("/api/devices", deviceRoute);
app.use("/api/history", historyRoute);

// Chỉ mở cổng khi chạy trực tiếp; test có thể dùng app mà không mở cổng cố định.
if (require.main === module) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.log(`Server dang chay tai http://localhost:${port}`);
    });
}

module.exports = app;
