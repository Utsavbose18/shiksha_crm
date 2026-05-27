import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils';

export default function BirthdayCard() {
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/dashboard/birthdays')
      .then(data => {
        setBirthdays(data || []);
        setLoading(false);
      })
      .catch(() => {
        setBirthdays([]);
        setLoading(false);
      });
  }, []);

  // 🔹 Don't render anything if no birthdays
  if (!loading && birthdays.length === 0) return null;

  return (
    <div style={{
      background: '#fff7ed',
      border: '1px solid #fed7aa',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16
    }}>
      
      {/* Header */}
      <div style={{
        fontSize: 15,
        fontWeight: 700,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        🎂 Today’s Birthdays
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Loading birthdays...
        </div>
      )}

      {/* Birthday list */}
      {!loading && birthdays.map(b => (
        <div key={b.id} style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: '#fff',
          border: '1px solid #fde68a',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              {b.name}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Don’t forget to wish them 🎉
            </div>
          </div>

          {/* Optional badge */}
          <div style={{
            fontSize: 11,
            background: '#fef3c7',
            color: '#92400e',
            padding: '3px 8px',
            borderRadius: 20,
            fontWeight: 600
          }}>
            Today
          </div>
        </div>
      ))}
    </div>
  );
}