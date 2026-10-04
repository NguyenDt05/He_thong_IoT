import MainLayout from "../layouts/MainLayout";
import avatarImage from "../assets/avt.jpg";
import "../styles/Profile.css";

// Trang hồ sơ gồm khung avatar bên trái và các nhóm chi tiết bên phải.
function Profile() {
  return (
    <MainLayout
      title="Hồ sơ cá nhân"
      description="Thông tin cá nhân của người dùng"
    >
      <div className="profile">
        <div className="profile-frame">
          {/* Cụm ảnh đại diện và tên người dùng. */}
          <div className="avatar">
            <img className="avatar-img" src={avatarImage} alt="Ảnh đại diện của Đặng Thảo Nguyên" />
            <h2>Đặng Thảo Nguyên</h2>
          </div>

          <div className="profile-details">
            {/* Cụm thông tin cá nhân: mã sinh viên và email. */}
            <section className="profile-info">
              <h2>Thông tin cá nhân</h2>
              <div className="profile-info-list">
                <div className="profile-info-row">
                  <span>Mã sinh viên</span>
                  <strong>B23DCCN609</strong>
                </div>
                <div className="profile-info-row">
                  <span>Email</span>
                  <strong><a href="mailto:NguyenDt.B23DCCN609@stu.ptit.edu.vn">NguyenDt.B23DCCN609@stu.ptit.edu.vn</a></strong>
                </div>
              </div>
            </section>

            {/* Cụm liên kết tới mã nguồn, thiết kế và báo cáo. */}
            <section className="profile-links">
              <h2>Liên kết</h2>
              <div className="profile-link-list">
                <a className="profile-link" href="https://github.com/NguyenDt05/He_thong_IoT" target="_blank" rel="noopener noreferrer">
                  <h3>Github</h3>
                  <span>He_thong_IoT</span>
                </a>
                <a className="profile-link" href="https://www.figma.com/design/a697q3sxoIkKP7aHhtxGHe/IoT?node-id=1-4195&t=3aREkYWGoDZ9DBz0-0" target="_blank" rel="noopener noreferrer">
                  <h3>Figma</h3>
                  <span>IoT-Design</span>
                </a>
                <a className="profile-link" href="https://docs.google.com/document/d/1lgN4qU-nC3XX1EEsEnCts9SywMMvujR5bhiocwNPsfk/edit?tab=t.0" target="_blank" rel="noopener noreferrer">
                  <h3>Báo cáo</h3>
                  <span>BaoCaoIoT</span>
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default Profile;
