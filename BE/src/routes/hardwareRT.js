const express = require("express");
const hardware = require("../repos/hardwareRP");
const alerts = require("../repos/alertRP");
const { isSensorStreamLive, publishThresholds } = require("../service/mqttBridge");

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
        const [thresholds, counts] = await Promise.all([alerts.getThresholds(), alerts.dailyAlertCounts()]);
        res.json({ thresholds, counts: Object.fromEntries(
            Object.keys(thresholds).map((type) => [type, counts[type] ?? 0]),
        ) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Không thể lấy số lần cảnh báo" });
    }
});

router.put("/alerts/thresholds", async (req, res) => {
    try {
        const thresholds = await alerts.updateThresholds(req.body?.thresholds);
        const brokerUpdated = await publishThresholds(thresholds);
        res.json({ thresholds, brokerUpdated });
    } catch (error) {
        if (error.code === "INVALID_THRESHOLDS") {
            res.status(400).json({ error: error.message });
            return;
        }
        console.error(error);
        res.status(500).json({ error: "Không thể lưu ngưỡng cảnh báo" });
    }
});

module.exports = router;
