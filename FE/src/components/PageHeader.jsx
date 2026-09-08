import "../styles/PageHeader.css";

// Hiển thị tiêu đề và mô tả do trang hiện tại truyền vào.
function PageHeader({ title, description }) {
  return (
    <header className="page-header">
      <h1 className="page-title">{title}</h1>
      <p className="page-description">{description}</p>
    </header>
  );
}

export default PageHeader;
