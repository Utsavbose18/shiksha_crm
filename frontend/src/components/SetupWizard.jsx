import React, { useState } from 'react';
import { apiFetch, storage } from '../utils';

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => chars[value % chars.length]).join('');
}

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 State
  const [logoFile, setLogoFile] = useState(null);
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#1e40af');

  // Step 2 State
  const [branch, setBranch] = useState({ name: '', city: '', country: '', phone: '', email: '' });

  // Step 3 State
  const [staff, setStaff] = useState({ full_name: '', email: '', role: 'counsellor' });
  const [tempPassword, setTempPassword] = useState('');

  const nextStep = () => setStep(s => s + 1);

  const handleSkip = () => {
    nextStep();
  };

  const saveBranding = async () => {
    setLoading(true);
    setError('');
    try {
      if (storage.tenantId) {
        await apiFetch(`/api/tenants/${storage.tenantId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            primary_color: primaryColor,
            secondary_color: secondaryColor,
          }),
        });
      }
      nextStep();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveBranch = async () => {
    if (!branch.name) return nextStep();
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/admin/settings/branches', {
        method: 'POST',
        body: JSON.stringify(branch)
      });
      nextStep();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inviteStaff = async () => {
    if (!staff.email) return nextStep();
    setLoading(true);
    setError('');
    try {
      const password = generateTempPassword();
      await apiFetch('/api/users/', {
        method: 'POST',
        body: JSON.stringify({
          ...staff,
          password,
        })
      });
      setTempPassword(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const finishWizard = () => {
    localStorage.setItem('setup_wizard_complete', 'true');
    // Also might want to tell backend via a PATCH
    onComplete();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sap-page)' }}>
      <div className="bg-white p-8 rounded-xl shadow-lg" style={{ width: 600 }}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Workspace Setup</h2>
          <span className="text-sm text-gray-500">Step {step} of 5</span>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Branding</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Primary Color</label>
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-20" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secondary Color</label>
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="h-10 w-20" />
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={handleSkip} className="text-gray-500 hover:text-gray-700">Skip for now</button>
              <button onClick={saveBranding} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">First Branch/Office</h3>
            <input type="text" placeholder="Branch Name" className="w-full border p-2 rounded" value={branch.name} onChange={e => setBranch({...branch, name: e.target.value})} />
            <input type="text" placeholder="City" className="w-full border p-2 rounded" value={branch.city} onChange={e => setBranch({...branch, city: e.target.value})} />
            <input type="text" placeholder="Country" className="w-full border p-2 rounded" value={branch.country} onChange={e => setBranch({...branch, country: e.target.value})} />
            <div className="flex justify-between mt-6">
              <button onClick={handleSkip} className="text-gray-500 hover:text-gray-700">Skip for now</button>
              <button onClick={saveBranch} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Invite First Staff Member</h3>
            {!tempPassword ? (
              <>
                <input type="text" placeholder="Full Name" className="w-full border p-2 rounded" value={staff.full_name} onChange={e => setStaff({...staff, full_name: e.target.value})} />
                <input type="email" placeholder="Email" className="w-full border p-2 rounded" value={staff.email} onChange={e => setStaff({...staff, email: e.target.value})} />
                <select className="w-full border p-2 rounded" value={staff.role} onChange={e => setStaff({...staff, role: e.target.value})}>
                  <option value="counsellor">Counsellor</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex justify-between mt-6">
                  <button onClick={handleSkip} className="text-gray-500 hover:text-gray-700">Skip for now</button>
                  <button onClick={inviteStaff} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">Invite & Next</button>
                </div>
              </>
            ) : (
              <div className="bg-green-50 p-4 rounded text-center border border-green-200">
                <p className="text-green-800 font-semibold">Staff invited!</p>
                <p className="mt-2">Temporary Password: <strong className="text-lg bg-white px-2 py-1 border rounded">{tempPassword}</strong></p>
                <p className="text-sm text-gray-600 mt-2">Please copy this and share it with them securely.</p>
                <button onClick={nextStep} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded w-full">Continue</button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Review Default Workflow</h3>
            <p className="text-sm text-gray-600">These are the default stages an application will go through.</p>
            <div className="flex flex-wrap gap-2 my-4">
              {['Applied', 'Under Review', 'Conditional Offer', 'Unconditional Offer', 'Visa Applied', 'Done'].map(s => (
                 <span key={s} className="px-3 py-1 bg-gray-100 border rounded-full text-sm">{s}</span>
              ))}
            </div>
            <div className="flex justify-between mt-6 items-center">
              <span className="text-sm text-gray-500 italic">You can customize this later in Settings</span>
              <button onClick={nextStep} className="bg-blue-600 text-white px-4 py-2 rounded">Looks good, continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold">Your workspace is ready</h3>
            <p className="text-gray-600 mb-6">You've successfully configured your EduCRM instance.</p>
            <button onClick={finishWizard} className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-green-700 transition">
              Go to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
