const express = require("express");
const hardware = require("../repos/hardwareRP");
const alerts = require("../repos/alertRP");
const { ALERT_THRESHOLDS } = require("../service/alertThresholds");
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

router.get("/alerts", async (_req, res) => {
    try {
        const counts = await alerts.dailyAlertCounts();
        res.json({ thresholds: ALERT_THRESHOLDS, counts: Object.fromEntries(
            Object.keys(ALERT_THRESHOLDS).map((type) => [type, counts[type] ?? 0]),
        ) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Không thể lấy số lần cảnh báo" });
    }
});

module.exports = router;
