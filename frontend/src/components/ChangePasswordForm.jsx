import { useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export default function ChangePasswordForm({
  auth,
  onLogout,
  onPasswordChanged,
  forceChange = false,
}) {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const endpoint = useMemo(() => {
    return `${API_BASE_URL}/api/auth/change-password`;
  }, [auth]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setMessage("");
    setError("");
  };

  const validate = () => {
    if (!form.current_password.trim()) {
      return "Current password is required";
    }
    if (!form.new_password.trim()) {
      return "New password is required";
    }
    if (form.new_password.length < 8) {
      return "New password must be at least 8 characters";
    }
    if (form.new_password !== form.confirm_password) {
      return "New password and confirm password do not match";
    }
    if (form.current_password === form.new_password) {
      return "New password must be different from current password";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.accessToken || ""}`,
        },
        body: JSON.stringify({
          current_password: form.current_password,
          new_password: form.new_password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to change password");
      }

      setMessage(data?.message || "Password changed successfully");

      setForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      // FIRST LOGIN FLOW
      if (forceChange && typeof onPasswordChanged === "function") {
        setTimeout(() => {
          onPasswordChanged();
        }, 1200);
        return;
      }

      // NORMAL MANUAL CHANGE FLOW
      setTimeout(() => {
        if (typeof onLogout === "function") {
          onLogout();
        }
      }, 1200);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crm-page">
      <div className="page-header">
        <div>
          <h1>{forceChange ? "Set New Password" : "Change Password"}</h1>
          <p>
            {forceChange
              ? "For security reasons, you must change your password before continuing."
              : "Update your account password securely."}
          </p>
        </div>
      </div>

      <div className="card password-card">
        <div className="card-header-row">
          <div>
            <h3>Security Settings</h3>
            <span>
              {forceChange
                ? "This is required on your first login"
                : "Keep your account protected with a strong password"}
            </span>
          </div>
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        <form className="password-form" onSubmit={handleSubmit}>
          <div className="form-grid single">
            <div className="form-group">
              <label htmlFor="current_password">Current Password</label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                value={form.current_password}
                onChange={handleChange}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="new_password">New Password</label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                value={form.new_password}
                onChange={handleChange}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <small className="field-hint">
                Password must be at least 8 characters.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Confirm New Password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading
                ? "Updating..."
                : forceChange
                ? "Set Password & Continue"
                : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}