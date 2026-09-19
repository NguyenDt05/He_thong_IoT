// Đổi tham số trang thành số nguyên dương, dùng mặc định khi không hợp lệ.
function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

// Giới hạn số trang và số bản ghi mỗi trang trước khi truy vấn.
function normalizePagination(page, limit) {
    return {
        page: Math.min(positiveInteger(page, 1), 100_000),
        limit: Math.min(positiveInteger(limit, 10), 100),
    };
}

module.exports = { normalizePagination };
