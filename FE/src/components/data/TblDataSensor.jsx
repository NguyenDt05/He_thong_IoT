import { dinhdang } from "../../utils/formatDate";
import { formatSensorValue } from "../../utils/formatSensorValue";
import "./TblDataSensor.css";

// Bảng cảm biến hiển thị các bản ghi API, gồm trạng thái rỗng và đơn vị đo của từng loại.
function TblDataSensor({ data, emptyMessage }) {
  return (
    <table className="sensor-table">
      <thead>
        <tr>
          <th className="col-id">ID</th>
          <th className="col-name">Tên cảm biến</th>
          <th className="col-type">Loại cảm biến</th>
          <th className="col-value">Giá trị</th>
          <th className="col-time">Thời gian</th>
        </tr>
      </thead>

      <tbody>
        {/* Khi chưa có bản ghi, hiển thị thông báo tải/lỗi/không có kết quả trong bảng. */}
        {data.length === 0 && (
          <tr className="empty-row">
            <td colSpan="5">{emptyMessage}</td>
          </tr>
        )}
        {/* Dữ liệu thời gian ưu tiên chuỗi từ API để khớp với cách tìm kiếm theo thời gian. */}
        {data.map((item) => (
          <tr key={item.dataId}>
            <td className="col-id">{item.dataId}</td>
            <td className="col-name">{item.sensorName}</td>
            <td className="col-type">{item.sensorType}</td>
            <td className="col-value">{formatSensorValue(item.value)}
                {item.unit ? ` ${item.unit}` : ""}
            </td>
            <td className="col-time">{item.createdAtText || dinhdang(item.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default TblDataSensor;
