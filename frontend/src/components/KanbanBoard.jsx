import React, { useState, useEffect } from 'react';
import { apiFetch, formatLabel } from '../utils';

export default function KanbanBoard({ applications, students, auth, onRefresh, setGlobalError }) {
  const [draggedApp, setDraggedApp] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  // We should try to load workflow stages from the API, falling back to default statuses
  useEffect(() => {
      async function loadStages() {
          try {
             // In a real app we'd fetch tenant workflows. For simplicity and as a fallback
             // we'll fetch workflows or just use the extracted unique statuses from the apps if workflow fetch fails.
             const wfData = await apiFetch('/api/admin/settings/workflows?module_name=applications').catch(()=>null);
             if (wfData && wfData.length > 0 && wfData[0].stages && wfData[0].stages.length > 0) {
                 setStages(wfData[0].stages.sort((a,b) => a.sort_order - b.sort_order).map(s => ({ key: s.stage_key, label: s.name })));
             } else {
                 // Fallback: extract unique statuses
                 const unique = Array.from(new Set(applications.map(a => a.application_status)));
                 setStages(unique.map(s => ({ key: s, label: formatLabel(s) })));
             }
          } catch(e) {
             console.error(e);
             const unique = Array.from(new Set(applications.map(a => a.application_status)));
             setStages(unique.map(s => ({ key: s, label: formatLabel(s) })));
          } finally {
              setLoading(false);
          }
      }
      loadStages();
  }, [applications]);

  const canEdit = auth.role === 'admin' || auth.role === 'counsellor' || auth.role === 'platform_super_admin'; // Simplified role check

  const handleDragStart = (e, app) => {
    if (!canEdit) {
        e.preventDefault();
        return;
    }
    setDraggedApp(app);
    e.dataTransfer.effectAllowed = 'move';
    // This is required for Firefox
    e.dataTransfer.setData('text/plain', app.id);

    // Optional: make it look slightly transparent while dragging
    setTimeout(() => {
        e.target.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('opacity-50');
    setDraggedApp(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, stageKey) => {
    e.preventDefault();
    if (!draggedApp || draggedApp.application_status === stageKey) return;

    const oldStatus = draggedApp.application_status;

    try {
      // Optimistic update could go here if we lifted state, but since we receive `applications` as props,
      // we'll just trigger the API and then onRefresh
      await apiFetch(`/api/students/${draggedApp.student_id}/applications/${draggedApp.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ application_status: stageKey })
      });
      onRefresh();
    } catch(err) {
      setGlobalError?.(err.message || 'Failed to update application status');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading pipeline...</div>;

  return (
    <div className="flex h-[calc(100vh-220px)] overflow-x-auto gap-4 pb-4">
      {stages.map(stage => {
        const columnApps = applications.filter(a => a.application_status === stage.key);

        return (
          <div
            key={stage.key}
            className="flex-shrink-0 w-80 bg-gray-50/80 rounded-lg flex flex-col border border-gray-200"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.key)}
          >
            <div className="p-3 border-b border-gray-200 bg-gray-100/50 rounded-t-lg flex justify-between items-center sticky top-0">
                <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wider">{stage.label}</h3>
                <span className="bg-white border text-xs font-bold px-2 py-0.5 rounded-full text-gray-600">{columnApps.length}</span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {columnApps.map(app => {
                 const student = students.find(s => s.id === app.student_id) || {};
                 const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student #${app.student_id}`;

                 return (
                   <div
                     key={app.id}
                     draggable={canEdit}
                     onDragStart={(e) => handleDragStart(e, app)}
                     onDragEnd={handleDragEnd}
                     className={`bg-white p-3 rounded shadow-sm border border-gray-200 ${canEdit ? 'cursor-grab active:cursor-grabbing hover:border-blue-300' : ''}`}
                   >
                       <div className="font-semibold text-gray-800 text-sm mb-1">{studentName}</div>
                       <div className="text-xs text-gray-600 mb-2 truncate" title={`${app.university?.name || 'Unknown'} - ${app.course_name || 'No course'}`}>
                           🏫 {app.university?.name || 'Unknown Uni'} <br/>
                           🎓 {app.course_name || 'No course'}
                       </div>
                       <div className="flex justify-between items-center text-[10px] text-gray-500 mt-3 pt-2 border-t border-gray-100">
                           <span>📅 {app.intake_month || ''} {app.intake_year || ''}</span>
                           <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">ID: {app.id}</span>
                       </div>
                   </div>
                 );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
