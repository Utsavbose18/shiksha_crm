import { useEffect, useMemo, useState } from 'react';
import { SectionCard, TextInput } from './UI';
import { apiFetch } from '../utils';

export default function ProfileView({ profile: initialProfile, auth, setGlobalError }) {
  const [profile, setProfile] = useState(initialProfile || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const forcePasswordChange = sessionStorage.getItem('force_password_change') === 'true';
  const [passwordChanged, setPasswordChanged] = useState(!forcePasswordChange);
  const [activeSection, setActiveSection] = useState(forcePasswordChange ? 'security' : 'personal');

  const isStudent = auth.role === 'student';
  const profileLocked = forcePasswordChange && !passwordChanged;

  useEffect(() => {
    if (forcePasswordChange) {
      setActiveSection('security');
      setPasswordChanged(false);
    }
  }, [forcePasswordChange]);

  function update(field, value) {
    setProfile((p) => ({ ...p, [field]: value }));
    setSaved(false);
  }

  function updatePassword(field, value) {
    setPasswordForm((p) => ({ ...p, [field]: value }));
    setPasswordSaved(false);
  }

  async function save(e) {
    e.preventDefault();

    if (profileLocked) {
      setGlobalError('Please change your password first before updating profile details.');
      setActiveSection('security');
      return;
    }

    if (auth.role !== 'student') {
      setGlobalError('Staff profile is currently read-only from the backend.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        date_of_birth: profile.date_of_birth || null,
        gender: profile.gender || null,
        nationality: profile.nationality || null,
        phone: profile.phone || null,
        address: profile.address || null,
        city: profile.city || null,
        state: profile.state || null,
        country: profile.country || null,
        passport_number: profile.passport_number || null,
        passport_expiry: profile.passport_expiry || null,
        emergency_contact_name: profile.emergency_contact_name || null,
        emergency_contact_phone: profile.emergency_contact_phone || null,
        emergency_contact_relation: profile.emergency_contact_relation || null,
      };

      const data = await apiFetch('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();

    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setGlobalError('Please fill all password fields.');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setGlobalError('New password and confirm password do not match.');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setGlobalError('New password must be at least 8 characters.');
      return;
    }

    setPasswordSaving(true);

    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });

      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });

      setPasswordSaved(true);
      setPasswordChanged(true);
      sessionStorage.removeItem('force_password_change');
      setTimeout(() => setPasswordSaved(false), 3000);

      if (activeSection === 'security') {
        setActiveSection('personal');
      }
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  const sections = useMemo(() => ([
    { key: 'personal', label: 'Personal Info' },
    // { key: 'contact', label: 'Contact & Address' },
    // { key: 'passport', label: 'Passport' },
    // { key: 'emergency', label: 'Emergency Contact' },
    { key: 'security', label: 'Security' },
  ]), []);

  if (!profile || Object.keys(profile).length === 0) {
    return (
      <div className="view-loading">
        <div className="spinner-lg" />
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-layout">
      <div className="profile-sidebar">
        <div className="profile-avatar-card">
          <div className="profile-avatar-big">
            {((profile.full_name || profile.first_name || auth.fullName || 'U').charAt(0)).toUpperCase()}
          </div>
          <div className="profile-avatar-info">
            <strong>
              {profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—'}
            </strong>
            <span>{profile.email}</span>
            <span className="profile-role-badge">{auth.role}</span>
          </div>
        </div>

        {profileLocked && (
          <div className="profile-mandatory-card">
            <div className="profile-mandatory-badge">Action Required</div>
            <h4>Change temporary password</h4>
            <p>
              For security, you must change your temporary password before accessing the rest of your profile.
            </p>
          </div>
        )}

        <nav className="profile-nav">
          {sections.map((s) => {
            const lockedItem = profileLocked && s.key !== 'security';
            return (
              <button
                key={s.key}
                type="button"
                className={`profile-nav-item ${activeSection === s.key ? 'active' : ''} ${lockedItem ? 'locked' : ''}`}
                onClick={() => {
                  if (lockedItem) return;
                  setActiveSection(s.key);
                }}
                disabled={lockedItem}
              >
                <span>{s.label}</span>
                {lockedItem ? <span className="profile-nav-lock">Locked</span> : null}
              </button>
            );
          })}
        </nav>

        {isStudent && (
          <div className="profile-completeness">
            <div className="completeness-label">
              <span>Profile Completeness</span>
              <strong>{calcCompleteness(profile)}%</strong>
            </div>
            <div className="completeness-bar">
              <div className="completeness-fill" style={{ width: `${calcCompleteness(profile)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="profile-form-area">
        {profileLocked && (
          <div className="profile-force-banner">
            <div>
              <strong>First login detected</strong>
              <p>Please change your password to continue using the application.</p>
            </div>
          </div>
        )}

        <form onSubmit={save}>
          {activeSection === 'personal' && (
            <SectionCard
              title="Personal Information"
              subtitle={isStudent ? 'Update your personal details' : 'Staff profile is read-only'}
              actions={
                isStudent && (
                  <div className="actions-row">
                    {saved && <span className="saved-indicator">✓ Saved</span>}
                    <button className="btn-primary" disabled={saving || profileLocked}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )
              }
            >
              <div className="form-grid">
                <TextInput label="Full Name" value={profile.full_name || ''} disabled readOnly />
                <TextInput label="Email" type="email" value={profile.email || ''} disabled readOnly />
                <TextInput label="Role" value={profile.role || auth.role} disabled readOnly />
                {/* <TextInput
                  label="Phone"
                  value={profile.phone || ''}
                  onChange={(e) => update('phone', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'Enter phone number' : ''}
                /> */}
                {/* <TextInput
                  label="First Name"
                  value={profile.first_name || ''}
                  onChange={(e) => update('first_name', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'Enter first name' : ''}
                />
                <TextInput
                  label="Last Name"
                  value={profile.last_name || ''}
                  onChange={(e) => update('last_name', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'Enter last name' : ''}
                />
                <TextInput
                  label="Date of Birth"
                  type="date"
                  value={profile.date_of_birth || ''}
                  onChange={(e) => update('date_of_birth', e.target.value)}
                  disabled={!isStudent || profileLocked}
                />
                <label className="field">
                  <span className="field-label">Gender</span>
                  {isStudent ? (
                    <select
                      className="field-select"
                      value={profile.gender || ''}
                      onChange={(e) => update('gender', e.target.value)}
                      disabled={profileLocked}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  ) : (
                    <input className="field-input" value={profile.gender || ''} disabled readOnly />
                  )}
                </label>
                <TextInput
                  label="Nationality"
                  value={profile.nationality || ''}
                  onChange={(e) => update('nationality', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'e.g. Indian' : ''}
                /> */}
              </div>
            </SectionCard>
          )}

          {activeSection === 'contact' && (
            <SectionCard
              title="Contact & Address"
              subtitle={isStudent ? 'Your contact and address details' : 'Read-only'}
              actions={
                isStudent && (
                  <div className="actions-row">
                    {saved && <span className="saved-indicator">✓ Saved</span>}
                    <button className="btn-primary" disabled={saving || profileLocked}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )
              }
            >
              <div className="form-grid">
                <label className="field field-full">
                  <span className="field-label">Address</span>
                  <textarea
                    className="field-textarea"
                    rows={2}
                    value={profile.address || ''}
                    onChange={(e) => update('address', e.target.value)}
                    disabled={!isStudent || profileLocked}
                    placeholder={isStudent ? 'Street address' : ''}
                  />
                </label>
                <TextInput
                  label="City"
                  value={profile.city || ''}
                  onChange={(e) => update('city', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'City' : ''}
                />
                <TextInput
                  label="State"
                  value={profile.state || ''}
                  onChange={(e) => update('state', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'State' : ''}
                />
                <TextInput
                  label="Country"
                  value={profile.country || ''}
                  onChange={(e) => update('country', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'Country' : ''}
                />
              </div>
            </SectionCard>
          )}

          {activeSection === 'passport' && (
            <SectionCard
              title="Passport Information"
              subtitle={isStudent ? 'Your passport details for visa processing' : 'Read-only'}
              actions={
                isStudent && (
                  <div className="actions-row">
                    {saved && <span className="saved-indicator">✓ Saved</span>}
                    <button className="btn-primary" disabled={saving || profileLocked}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )
              }
            >
              <div className="form-grid">
                <TextInput
                  label="Passport Number"
                  value={profile.passport_number || ''}
                  onChange={(e) => update('passport_number', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'e.g. A1234567' : ''}
                />
                <TextInput
                  label="Passport Expiry"
                  type="date"
                  value={profile.passport_expiry || ''}
                  onChange={(e) => update('passport_expiry', e.target.value)}
                  disabled={!isStudent || profileLocked}
                />
              </div>
            </SectionCard>
          )}

          {activeSection === 'emergency' && (
            <SectionCard
              title="Emergency Contact"
              subtitle={isStudent ? 'Emergency contact details' : 'Read-only'}
              actions={
                isStudent && (
                  <div className="actions-row">
                    {saved && <span className="saved-indicator">✓ Saved</span>}
                    <button className="btn-primary" disabled={saving || profileLocked}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )
              }
            >
              <div className="form-grid">
                <TextInput
                  label="Contact Name"
                  value={profile.emergency_contact_name || ''}
                  onChange={(e) => update('emergency_contact_name', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'Full name' : ''}
                />
                <TextInput
                  label="Contact Phone"
                  value={profile.emergency_contact_phone || ''}
                  onChange={(e) => update('emergency_contact_phone', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'Phone number' : ''}
                />
                <TextInput
                  label="Relationship"
                  value={profile.emergency_contact_relation || ''}
                  onChange={(e) => update('emergency_contact_relation', e.target.value)}
                  disabled={!isStudent || profileLocked}
                  placeholder={isStudent ? 'e.g. Parent, Spouse' : ''}
                />
              </div>
            </SectionCard>
          )}
        </form>

        {activeSection === 'security' && (
          <SectionCard
            title="Security"
            subtitle={profileLocked ? 'Change your temporary password to unlock your profile' : 'Manage your password'}
            actions={
              passwordSaved && <span className="saved-indicator">✓ Password Updated</span>
            }
          >
            <div className="security-panel">
              <div className="security-intro">

                <div>
                  <h4>{profileLocked ? 'Password change required' : 'Update your password'}</h4>
                  <p>
                    {profileLocked
                      ? 'You are signed in with a temporary password. Set a new password before continuing.'
                      : 'Choose a strong password to keep your account secure.'}
                  </p>
                </div>
              </div>

              <form className="form-grid" onSubmit={changePassword}>
                <TextInput
                  label="Current Password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => updatePassword('current_password', e.target.value)}
                  placeholder="Enter current password"
                />
                <div />
                <TextInput
                  label="New Password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => updatePassword('new_password', e.target.value)}
                  placeholder="Enter new password"
                />
                <TextInput
                  label="Confirm New Password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => updatePassword('confirm_password', e.target.value)}
                  placeholder="Confirm new password"
                />

                <div className="field-full security-actions-row">
                  <div className="security-helper-text">
                    Use at least 8 characters. After success, the rest of the profile will unlock.
                  </div>
                  <button className="btn-primary" disabled={passwordSaving}>
                    {passwordSaving ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function calcCompleteness(profile) {
  const fields = [
    'first_name',
    'last_name',
    'phone',
    'date_of_birth',
    'gender',
    'nationality',
    'city',
    'state',
    'country',
    'passport_number',
    'passport_expiry',
    'emergency_contact_name',
  ];
  const filled = fields.filter((f) => profile[f]);
  return Math.round((filled.length / fields.length) * 100);
}