import "./PageHeader.css";

// Hiển thị tiêu đề và mô tả do trang hiện tại truyền vào.
function PageHeader({ title, description, actions }) {
  return (
    <header className={`page-header${actions ? " has-actions" : ""}`}>
      <h1 className="page-title">{title}</h1>
      <p className="page-description">{description}</p>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
