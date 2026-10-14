const express = require("express");
const hardware = require("../repos/hardwareRP");
const { isSensorStreamLive } = require("../service/mqttBridge");

const router = express.Router();

router.get("/status", async (_req, res) => {
    try {
        res.json(hardware.hardwareStatus(await hardware.latestReadings(), Date.now(), isSensorStreamLive()));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Không thể kiểm tra kết nối phần cứng" });
    }
});

module.exports = router;
