const service = require('../service/dataSensorSV');

// Đọc tham số truy vấn, gọi service lấy danh sách rồi trả JSON hoặc mã lỗi HTTP.
async function layDuLieuCB_ctrl(req,res){
    try {
        // Chỉ chấp nhận chuỗi cho từ khóa/loại/tiêu chí; thiếu page, limit thì dùng mặc định.
        const key = typeof req.query.key === 'string' ? req.query.key.trim() : null;
        const type = typeof req.query.type === 'string' ? req.query.type : null;
        const field = ['all', 'type', 'datetime', 'value'].includes(req.query.field)
            ? req.query.field : 'all';
        const page = req.query.page;
        const limit = req.query.limit;

        const result = await service.layDuLieuCB_sv(key, type, field, page, limit);
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
