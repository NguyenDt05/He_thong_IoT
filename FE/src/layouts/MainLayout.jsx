import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import "./MainLayout.css";

// Khung dùng chung: sidebar, tiêu đề trang và vùng nội dung riêng của mỗi màn hình.
function MainLayout({ title, description, children, className = "", headerActions }) {
  return (
    <div className={`main-layout ${className}`.trim()}>
      <Sidebar />
      <main className="main-content">
        <PageHeader title={title} description={description} actions={headerActions} />
        <div className="page-body">{children}</div>
      </main>
    </div>
  );
}

export default MainLayout;
