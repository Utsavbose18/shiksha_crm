import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function MultiTenantLogin({ onLogin, error: externalError, loading: externalLoading }) {
  const [tenants, setTenants] = useState([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch active tenants for the dropdown
    fetch('/api/public/tenants')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
            setTenants(data);
            if (data.length > 0) setSelectedTenantSlug(data[0].slug);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load tenants", err);
        setLoading(false);
        // Fallback for dev environment if API not ready
        setTenants([{ slug: 'demo', name: 'Demo Tenant' }]);
        setSelectedTenantSlug('demo');
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!selectedTenantSlug && !email.includes('superadmin')) {
      setLocalError("Please select an organization.");
      return;
    }
    
    // For super admin, we might bypass tenant selection, but let's pass it anyway
    onLogin({ 
      username: email, 
      password, 
      client_id: selectedTenantSlug // Using client_id field from OAuth2 spec for tenant_slug
    });
  };

  const selectedTenant = tenants.find(t => t.slug === selectedTenantSlug);
  const primaryColor = selectedTenant?.primary_color || '#2563eb'; // blue-600 default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          {selectedTenant?.logo_url ? (
            <img src={selectedTenant.logo_url} alt="Logo" className="mx-auto h-16 w-auto" />
          ) : (
             <div className="mx-auto h-16 w-16 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                🎓
             </div>
          )}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {selectedTenant ? `Welcome to ${selectedTenant.name}` : 'EduCRM Platform'}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <select
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={selectedTenantSlug}
                onChange={e => setSelectedTenantSlug(e.target.value)}
                disabled={loading}
              >
                {tenants.map(t => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
                <option value="">-- Platform Super Admin --</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {(localError || externalError) && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {localError || externalError}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || externalLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: primaryColor }}
            >
              {(loading || externalLoading) ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
        
        <div className="text-center mt-4">
            <button 
                onClick={() => navigate('/')} 
                className="text-sm text-gray-500 hover:text-gray-900"
            >
                ← Back to Home
            </button>
        </div>
      </div>
    </div>
  );
}

export default MultiTenantLogin;
