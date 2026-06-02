import React from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-8 flex justify-between items-center">
        <div className="text-2xl font-bold text-blue-600 flex items-center">
          <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 8.56l-1.222.524a1 1 0 000 1.838l7 3a1 1 0 00.788 0l7-3a1 1 0 000-1.838H16.8l-1.223.524a1 1 0 000 1.838l-4 1.714L10 12l-1.577-.677-4-1.714a1 1 0 000-1.838z" />
          </svg>
          EduCRM SaaS
        </div>
        <nav className="space-x-6">
          <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
          <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
          <button 
            onClick={() => navigate('/login')}
            className="px-5 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition"
          >
            Login / Demo
          </button>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-blue-50 to-white">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-6 max-w-4xl">
          The All-in-One Education CRM for Consultancies and Agencies
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl">
          Manage leads, students, applications, documents, and finances with a fully white-labeled, scalable SaaS platform designed for the education industry.
        </p>
        <div className="space-x-4">
          <button 
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-blue-600 text-white text-lg rounded-md font-medium hover:bg-blue-700 transition shadow-lg"
          >
            Start Free Trial
          </button>
          <button 
            className="px-8 py-3 bg-white text-blue-600 text-lg rounded-md font-medium border border-blue-200 hover:bg-blue-50 transition shadow-sm"
          >
            Book a Demo
          </button>
        </div>
        
        {/* Abstract Product UI preview */}
        <div className="mt-16 w-full max-w-5xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden bg-white">
           <div className="h-8 bg-gray-100 border-b flex items-center px-4">
              <div className="flex space-x-2">
                 <div className="w-3 h-3 rounded-full bg-red-400"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                 <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
           </div>
           <div className="p-8 grid grid-cols-3 gap-6 opacity-80">
              <div className="col-span-1 space-y-4">
                 <div className="h-24 bg-blue-50 rounded-lg"></div>
                 <div className="h-48 bg-gray-50 rounded-lg"></div>
              </div>
              <div className="col-span-2 space-y-4">
                 <div className="h-16 bg-gray-50 rounded-lg"></div>
                 <div className="h-64 bg-blue-50/50 rounded-lg"></div>
              </div>
           </div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Built for Education Professionals</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4 text-xl">🚀</div>
              <h3 className="text-xl font-bold mb-2">Multi-Tenant Architecture</h3>
              <p className="text-gray-600">Complete data isolation. Every agency gets their own customizable workspace, branding, and custom domain.</p>
            </div>
            <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4 text-xl">⚙️</div>
              <h3 className="text-xl font-bold mb-2">Dynamic Workflows</h3>
              <p className="text-gray-600">Build custom stages for leads, applications, and visas. Tailor the CRM exactly to your business process.</p>
            </div>
            <div className="p-6 border rounded-xl shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4 text-xl">📝</div>
              <h3 className="text-xl font-bold mb-2">Form & Field Builder</h3>
              <p className="text-gray-600">Create custom fields and build dynamic forms to capture exactly the information you need from students.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 text-center">
        <p>© {new Date().getFullYear()} EduCRM SaaS Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
