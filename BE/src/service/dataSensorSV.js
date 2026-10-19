const dataSensorRP = require('../repos/dataSensorRP');
const { normalizePagination } = require('./pagination');

// Chuyển số trang thành offset, lấy dữ liệu và tổng số bản ghi cùng bộ lọc.
async function layDuLieuCB_sv(key, criterion, requestedPage, requestedLimit){
    const { page, limit } = normalizePagination(requestedPage, requestedLimit);
    const offset = (page - 1) * limit;

    const data = await dataSensorRP.layDuLieuCB_rp(key, criterion, limit, offset);
    const total = await dataSensorRP.countDuLieuCB_rp(key, criterion);

    const totalPages = Math.ceil(total / limit);

    return {
        data,
        page, 
        limit,
        total,
        totalPages
    }; 
}

// Xuất nghiệp vụ danh sách cảm biến cho controller.
module.exports = {
    layDuLieuCB_sv
};
