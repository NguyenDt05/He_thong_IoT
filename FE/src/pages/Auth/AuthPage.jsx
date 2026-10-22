import { useState } from "react";
import { NavigationLink } from "../../router";
import { useNavigation } from "../../navigationContext";
import { useAuth } from "../../authContext";
import "./AuthPage.css";

const initialForm = {
  fullName: "", username: "", password: "",
};

function Field({ label, name, type = "text", value, onChange, required = false, autoComplete }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
      />
    </label>
  );
}

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { login, register, user } = useAuth();
  const { navigate } = useNavigation();

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (isRegister) {
        await register(form);
      } else {
        await login({ username: form.username, password: form.password });
      }
      navigate("/profile");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>{isRegister ? "Đăng ký" : "Đăng nhập"}</h1>
        </div>

        {user ? (
          <div className="auth-already-signed-in">
            <p>Bạn đang đăng nhập với tài khoản <strong>{user.username}</strong>.</p>
            <NavigationLink to="/profile" className="auth-primary-link">Xem trang cá nhân</NavigationLink>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <Field label="Họ và tên" name="fullName" value={form.fullName} onChange={handleChange} required autoComplete="name" />
            )}
            <Field label="Tên đăng nhập" name="username" value={form.username} onChange={handleChange} required autoComplete="username" />
            <Field label="Mật khẩu" name="password" type="password" value={form.password} onChange={handleChange} autoComplete={isRegister ? "new-password" : "current-password"} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" disabled={submitting} type="submit">
              {submitting ? "Đang xử lý..." : isRegister ? "Tạo tài khoản" : "Đăng nhập"}
            </button>
          </form>
        )}

        <div className="auth-footer">
          {isRegister
            ? <span>Đã có tài khoản? <NavigationLink to="/login">Đăng nhập</NavigationLink></span>
            : <span>Chưa có tài khoản? <NavigationLink to="/register">Đăng ký</NavigationLink></span>}
          <NavigationLink to="/">Tiếp tục với tư cách khách</NavigationLink>
        </div>
      </div>
    </div>
  );
}
