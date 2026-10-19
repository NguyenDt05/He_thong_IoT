const service = require('../service/dataSensorSV');

// Đọc tham số truy vấn, gọi service lấy danh sách rồi trả JSON hoặc mã lỗi HTTP.
async function layDuLieuCB_ctrl(req,res){
    try {
        // Một tiêu chí mô tả đúng lựa chọn trên giao diện; thiếu hoặc sai thì tìm trên tất cả các trường.
        const key = typeof req.query.key === 'string' ? req.query.key.trim() : null;
        const requestedCriterion = typeof req.query.criterion === 'string'
            ? req.query.criterion.trim().toLowerCase() : 'all';
        const criterion = ['all', 'temperature', 'humidity', 'light', 'datetime'].includes(requestedCriterion)
            ? requestedCriterion : 'all';
        const page = req.query.page;
        const limit = req.query.limit;

        const result = await service.layDuLieuCB_sv(key, criterion, page, limit);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Loi' });
    }
}

// Xuất handler cho lớp định tuyến.
module.exports = {
    layDuLieuCB_ctrl
};
