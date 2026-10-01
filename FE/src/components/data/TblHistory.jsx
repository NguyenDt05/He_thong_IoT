import { dinhdang } from "../../configs/appConfig";
import "../../styles/TblHistory.css";

// Nhãn trạng thái được tách khỏi mã trạng thái dùng trong bộ lọc.
const statusLabels = { SUCCESS: "Success", FAILED: "Failed", PENDING: "Pending" };

function displayUsername(id) {
    return Number(id) % 2 === 0 ? "nguyễn văn a" : "thaonguyen";
}

// Bảng lịch sử nhận danh sách đã lọc từ trang cha và trình bày từng sự kiện.
function TblHistory({ data, emptyMessage = "Không có dữ liệu phù hợp." }) {
    return (
        <table className="history-table">
            <thead>
                <tr>
                    <th className = "col-id">ID</th>
                    <th className = "col-name">Tên thiết bị</th>
                    <th className ="col-username"> Người dùng</th>
                    <th className = "col-action" style={{textAlign: 'center'}}>Hành động</th>
                    <th className = "col-status" style={{textAlign: 'center'}}>Trạng thái</th>
                    <th className = "col-time">Thời gian</th>
                </tr>
            </thead>
            <tbody>
                {/* Thông báo ngay trong vùng bảng khi không có sự kiện nào khớp. */}
                {data.length === 0 && (
                    <tr className="empty-row">
                        <td colSpan="6">{emptyMessage}</td>
                    </tr>
                )}
                {/* Ánh xạ mã hành động/trạng thái sang nhãn người dùng nhìn thấy. */}
                {data.map((item) => (
                    <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.deviceName}</td>
                        <td>{displayUsername(item.id)}</td>
                        <td style={{textAlign: 'center'}}>{item.action === "ON" ? "Bật" : "Tắt"}</td>
                        <td className="status">
                            <span className={`status-badge status-badge-${item.status.toLowerCase()}`}>
                                {statusLabels[item.status]}
                            </span>
                        </td>
                        <td>{item.time?.replace(/,\s*/, " ") || dinhdang(item.createdAt)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default TblHistory;
