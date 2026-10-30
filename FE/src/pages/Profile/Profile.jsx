import { useState } from "react";
import MainLayout from "../../layouts/MainLayout";
import { NavigationLink } from "../../router";
import { useAuth } from "../../authContext";
import Avatar from "../../components/Avatar";
import { ArrowUpRight, AtSign, Braces, Camera, Check, CodeXml, FileText, IdCard, Link2, LogIn, Mail, Pencil, PenTool, Phone, Save, UserRound, X } from "lucide-react";
import "./Profile.css";

const links = [
  { key: "githubUrl", label: "GitHub", icon: CodeXml },
  { key: "figmaUrl", label: "Figma", icon: PenTool },
  { key: "reportUrl", label: "Báo cáo", icon: FileText },
  { key: "postmanUrl", label: "API Docs", icon: Braces },
];

const personalFields = [
  { key: "fullName", label: "Họ và tên", type: "text", icon: UserRound, autoComplete: "name" },
  { key: "email", label: "Email", type: "email", icon: Mail, autoComplete: "email" },
  { key: "studentId", label: "Mã sinh viên", type: "text", icon: IdCard, autoComplete: "off" },
  { key: "phone", label: "Số điện thoại", type: "tel", icon: Phone, autoComplete: "tel" },
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
  const [success, setSuccess] = useState("");

  function beginEdit() {
    setForm(profileForm(user));
    setError("");
    setSuccess("");
    setEditing(true);
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarError("");
    setSuccess("");
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
      setSuccess("Đã cập nhật ảnh đại diện.");
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
      setSuccess("Đã lưu thông tin hồ sơ.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout title="Hồ sơ cá nhân" description="Quản lý thông tin và các liên kết của bạn" className="profile-layout">
      {loading ? (
        <div className="profile-message" role="status">Đang tải thông tin tài khoản...</div>
      ) : !user ? (
        <div className="profile-message">
          <span className="profile-message-icon"><UserRound size={28} aria-hidden="true" /></span>
          <h2>Hồ sơ của bạn</h2>
          <p>Đăng nhập để quản lý thông tin, ảnh đại diện và các liên kết cá nhân.</p>
          <NavigationLink to="/login"><LogIn size={16} aria-hidden="true" /> Đăng nhập</NavigationLink>
        </div>
      ) : (
        <div className="profile">
            <aside className="profile-identity">
              <div className="profile-identity-cover" aria-hidden="true"><UserRound size={70} strokeWidth={1} /></div>
              <div className="profile-identity-body">
              <Avatar user={user} className="avatar-img" />
              <h2>{user.fullName}</h2>
              <p className="profile-username">@{user.username}</p>
              <span className="profile-account-label"><UserRound size={13} aria-hidden="true" /> Tài khoản cá nhân</span>
              <label className="avatar-upload">
                <Camera size={16} aria-hidden="true" />
                {uploadingAvatar ? "Đang tải ảnh..." : "Đổi ảnh đại diện"}
                <input
                  className="avatar-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  aria-label="Chọn ảnh đại diện"
                />
              </label>
              <p className="profile-avatar-hint">JPG, PNG hoặc WebP · Tối đa 2 MB</p>
              {avatarError && <p className="avatar-upload-error" role="alert">{avatarError}</p>}
              <div className="profile-identity-summary"><Link2 size={16} aria-hidden="true" /><span>Liên kết đã thêm</span><strong>{links.filter(({ key }) => user[key]).length}<span> / 4</span></strong></div>
              </div>
            </aside>

            <div className="profile-details">
              {success && <p className="profile-success" role="status"><Check size={17} aria-hidden="true" />{success}</p>}
              {editing && form ? (
                <form className="profile-edit-form" onSubmit={handleSave} aria-busy={saving}>
                  <section className="profile-section">
                    <div className="profile-section-heading"><div><h2>Chỉnh sửa thông tin</h2><p>Cập nhật thông tin liên hệ của bạn.</p></div></div>
                    <fieldset className="profile-edit-grid" disabled={saving}>
                    {personalFields.map(({ key: name, label, type, autoComplete }) => (
                      <label className="profile-edit-field" key={name}>
                        <span>{label}</span>
                        <input name={name} type={type} autoComplete={autoComplete} value={form[name]} onChange={handleChange} required={name === "fullName"} />
                      </label>
                    ))}
                    </fieldset>
                  </section>
                  <section className="profile-section">
                    <div className="profile-section-heading"><div><h2>Liên kết cá nhân</h2><p>Thêm địa chỉ đầy đủ, bắt đầu bằng https://.</p></div></div>
                    <fieldset className="profile-edit-grid" disabled={saving}>
                      {links.map(({ key, label }) => <label className="profile-edit-field" key={key}><span>{label}</span><input name={key} type="url" placeholder="https://…" value={form[key]} onChange={handleChange} /></label>)}
                    </fieldset>
                  </section>
                  {error && <p className="profile-error" role="alert">{error}</p>}
                  <div className="profile-edit-actions">
                    <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(""); }}><X size={16} aria-hidden="true" />Hủy</button>
                    <button type="submit" disabled={saving}><Save size={16} aria-hidden="true" />{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
                  </div>
                </form>
              ) : (
                <>
                  <section className="profile-section profile-info">
                    <div className="profile-section-heading">
                      <div><h2>Thông tin cá nhân</h2><p>Thông tin nhận diện và liên hệ của bạn.</p></div>
                      <button type="button" onClick={beginEdit}><Pencil size={15} aria-hidden="true" />Chỉnh sửa</button>
                    </div>
                    <dl className="profile-info-list">
                      {[personalFields[0], { key: "username", label: "Tên đăng nhập", icon: AtSign }, ...personalFields.slice(1)].map(({ key, label, icon: Icon }) => (
                        <div className="profile-info-row" key={key}>
                          <dt><Icon size={16} aria-hidden="true" /><span>{label}</span></dt>
                          <dd className={user[key] ? "" : "profile-value-empty"}>{user[key] || "Chưa cập nhật"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="profile-section profile-links">
                    <div className="profile-section-heading"><div><h2>Liên kết cá nhân</h2><p>Lối tắt đến dự án và tài liệu của bạn.</p></div><span className="profile-link-count">{links.filter(({ key }) => user[key]).length}/4</span></div>
                    <div className="profile-link-list">
                      {links.map(({ key, label, icon: Icon }) => user[key] ? (
                        <a className="profile-link" href={user[key]} title={user[key]} target="_blank" rel="noopener noreferrer" key={key}>
                          <span className="profile-link-icon"><Icon size={20} aria-hidden="true" /></span>
                          <span className="profile-link-copy"><strong>{label}</strong><span>{user[key]}</span></span>
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </a>
                      ) : (
                        <button type="button" className="profile-link profile-link-empty" key={key} onClick={beginEdit} aria-label={`Thêm liên kết ${label}`}>
                          <span className="profile-link-icon"><Icon size={20} aria-hidden="true" /></span>
                          <span className="profile-link-copy"><strong>{label}</strong><span>Thêm liên kết</span></span><Pencil size={14} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
        </div>
      )}
    </MainLayout>
  );
}

export default Profile;
