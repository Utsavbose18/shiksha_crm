import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils';

export default function AdditionalSettingsView({ setGlobalError }) {
  const [activeTab, setActiveTab] = useState('roles');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">CRM Settings</h1>
      
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'roles' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('roles')}
        >
          Roles & Permissions
        </button>
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'workflows' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('workflows')}
        >
          Workflows
        </button>
        <button
          className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'fields' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('fields')}
        >
          Custom Fields
        </button>
      </div>

      <div>
        {activeTab === 'roles' && <p className="text-gray-600">Role & Permission management interface coming soon.</p>}
        {activeTab === 'workflows' && <p className="text-gray-600">Dynamic Workflow builder interface coming soon.</p>}
        {activeTab === 'fields' && <p className="text-gray-600">Custom Field builder interface coming soon.</p>}
      </div>
    </div>
  );
}
