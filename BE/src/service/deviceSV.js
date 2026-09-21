const deviceRP = require("../repos/deviceRP");

// Nghiệp vụ lấy danh sách thiết bị cho controller.
async function listDevices() {
    return deviceRP.listDevices();
}

module.exports = { listDevices };
