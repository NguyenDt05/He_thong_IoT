import { useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import { NavigationLink } from "../../router";
import { useAuth } from "../../authContext";
import Avatar from "../../components/Avatar";
import "./Profile.css";

const links = [
  { key: "githubUrl", label: "Github" },
  { key: "figmaUrl", label: "Figma" },
  { key: "reportUrl", label: "Báo cáo" },
  { key: "postmanUrl", label: "Postman" },
];

function profileForm(user) {
  return {
    fullName: user.fullName || "",
    email: user.email || "",
    studentId: user.studentId || "",
    phone: user.phone || "",
    githubUrl: user.githubUrl || "",
    figmaUrl: user.figmaUrl || "",
    reportUrl: user.reportUrl || "",
    postmanUrl: user.postmanUrl || "",
  };
}

function Profile() {
  const { user, loading, updateProfile, uploadAvatar } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Chỉ nhận ảnh JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Ảnh không được vượt quá 2 MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
    } catch (cause) {
      setAvatarError(cause.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateProfile(form);
      setEditing(false);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout title="Hồ sơ cá nhân" description="Thông tin cá nhân của người dùng" className="profile-layout">
      {loading ? (
        <div className="profile-message">Đang tải thông tin tài khoản...</div>
      ) : !user ? (
        <div className="profile-message">
          <p>Đăng nhập để xem trang cá nhân của bạn.</p>
          <NavigationLink to="/login">Đăng nhập</NavigationLink>
        </div>
      ) : (
        <div className="profile">
          <div className="profile-frame">
            <div className="avatar">
              <Avatar user={user} className="avatar-img" />
              <h2>{user.fullName}</h2>
              <span>@{user.username}</span>
              <label className="avatar-upload">
                {uploadingAvatar ? "Đang tải ảnh..." : "Tải ảnh từ máy"}
                <input
                  className="avatar-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  aria-label="Chọn ảnh đại diện"
                />
              </label>
              {avatarError && <p className="avatar-upload-error" role="alert">{avatarError}</p>}
            </div>

            <div className="profile-details">
              {editing && form ? (
                <form className="profile-edit-form" onSubmit={handleSave}>
                  <div className="profile-section-heading">
                    <h2>Chỉnh sửa thông tin</h2>
                  </div>
                  <div className="profile-edit-grid">
                    {[
                      ["fullName", "Họ và tên", "text"], ["email", "Email", "email"],
                      ["studentId", "Mã sinh viên", "text"], ["phone", "Số điện thoại", "tel"],
                      ["githubUrl", "GitHub URL", "url"], ["figmaUrl", "Figma URL", "url"],
                      ["reportUrl", "Báo cáo URL", "url"], ["postmanUrl", "Postman URL", "url"],
                    ].map(([name, label, type]) => (
                      <label className="profile-edit-field" key={name}>
                        <span>{label}</span>
                        <input name={name} type={type} value={form[name]} onChange={handleChange} required={name === "fullName"} />
                      </label>
                    ))}
                  </div>
                  {error && <p className="profile-error" role="alert">{error}</p>}
                  <div className="profile-edit-actions">
                    <button type="button" onClick={() => { setEditing(false); setError(""); }}>Hủy</button>
                    <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu thông tin"}</button>
                  </div>
                </form>
              ) : (
                <>
                  <section className="profile-info">
                    <div className="profile-section-heading">
                      <h2>Thông tin cá nhân</h2>
                      <button type="button" onClick={() => { setForm(profileForm(user)); setEditing(true); }}>Chỉnh sửa</button>
                    </div>
                    <div className="profile-info-list">
                      <div className="profile-info-row"><span>Họ và tên</span><strong>{user.fullName}</strong></div>
                      <div className="profile-info-row"><span>Tên đăng nhập</span><strong>{user.username}</strong></div>
                      <div className="profile-info-row"><span>Mã sinh viên</span><strong>{user.studentId || "..."}</strong></div>
                      <div className="profile-info-row"><span>Email</span><strong>{user.email || "..."}</strong></div>
                      <div className="profile-info-row"><span>Phone</span><strong>{user.phone || "..."}</strong></div>
                    </div>
                  </section>

                  <section className="profile-links">
                    <h2>Liên kết</h2>
                    <div className="profile-link-list">
                      {links.map(({ key, label }) => user[key] ? (
                        <a className="profile-link" href={user[key]} title={user[key]} target="_blank" rel="noopener noreferrer" key={key}>
                          <h3>{label}</h3>
                          <span>{user[key]}</span>
                        </a>
                      ) : (
                        <div className="profile-link profile-link-empty" key={key}>
                          <h3>{label}</h3>
                          <span>Trống</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

export default Profile;
