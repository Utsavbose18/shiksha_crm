import React from 'react';
import { useNavigate } from 'react-router-dom';
import heroImage from '../../assets/hero.png';

const lifecycleSteps = [
  {
    step: '01',
    title: 'Capture and qualify leads',
    text: 'Track enquiries, sources, owners, follow-ups, and lead status from one clean workspace.',
  },
  {
    step: '02',
    title: 'Build complete student records',
    text: 'Keep profile details, documents, notes, priorities, and custom tenant data tied to each student.',
  },
  {
    step: '03',
    title: 'Manage applications end to end',
    text: 'Coordinate deadlines, course dates, tuition details, scholarships, and application decisions.',
  },
  {
    step: '04',
    title: 'Standardize operations',
    text: 'Tenant admins can add custom pages, sections, and typed fields as business requirements change.',
  },
];

const capabilities = [
  {
    title: 'Tenant-ready workspaces',
    text: 'Separate data, settings, roles, and workflows for each education agency or consultancy.',
    accent: 'teal',
  },
  {
    title: 'Dynamic student pages',
    text: 'Create custom pages beside Profile, Applications, Documents, and Notes without code changes.',
    accent: 'blue',
  },
  {
    title: 'Section and field builder',
    text: 'Add section headers, required fields, placeholders, and field types for tenant-specific forms.',
    accent: 'amber',
  },
  {
    title: 'Application tracking',
    text: 'Track courses, priorities, fees, currencies, start dates, end dates, and deadlines in context.',
    accent: 'green',
  },
  {
    title: 'Document operations',
    text: 'Keep student documents linked to the right record so teams can review faster and miss less.',
    accent: 'rose',
  },
  {
    title: 'Role-based control',
    text: 'Give tenant admins configuration power while keeping day-to-day users focused on execution.',
    accent: 'navy',
  },
];

const tenantControls = [
  'Add a page to the student profile flow',
  'Create form sections for each business process',
  'Choose field types, labels, hints, and required rules',
  'Keep configuration limited to tenant administrators',
];

function LandingPage() {
  const navigate = useNavigate();

  const handleAnchorClick = (id) => (event) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="landing-page">
      <style>{`
        .landing-page,
        .landing-page * {
          box-sizing: border-box;
          letter-spacing: 0;
        }

        .landing-page {
          min-height: 100vh;
          color: #101827;
          background: #f5f7fb;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .lp-header {
          position: sticky;
          top: 0;
          z-index: 30;
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 0 clamp(20px, 5vw, 72px);
          background: rgba(255, 255, 255, 0.96);
          border-bottom: 1px solid #dfe7f2;
          backdrop-filter: blur(14px);
        }

        .lp-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: #101827;
          text-decoration: none;
          font-weight: 800;
          font-size: 18px;
          white-space: nowrap;
        }

        .lp-brand-mark {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: #ffffff;
          background: #0f766e;
          font-size: 13px;
          font-weight: 900;
        }

        .lp-nav {
          display: flex;
          align-items: center;
          gap: 26px;
          font-size: 14px;
          font-weight: 650;
        }

        .lp-nav a {
          color: #4a5568;
          text-decoration: none;
        }

        .lp-nav a:hover {
          color: #0f766e;
        }

        .lp-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lp-button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 0 18px;
          font: inherit;
          font-weight: 750;
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease;
        }

        .lp-button:hover {
          transform: translateY(-1px);
        }

        .lp-button-primary {
          color: #ffffff;
          background: #0f766e;
          box-shadow: 0 16px 36px rgba(15, 118, 110, 0.28);
        }

        .lp-button-primary:hover {
          background: #115e59;
        }

        .lp-button-secondary {
          color: #0f172a;
          background: #ffffff;
          border-color: #dbe4ef;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
        }

        .lp-button-secondary:hover {
          border-color: #9fb2c8;
          background: #f8fbff;
        }

        .lp-hero {
          position: relative;
          min-height: calc(100vh - 132px);
          overflow: hidden;
          display: flex;
          align-items: center;
          padding: clamp(74px, 9vw, 120px) clamp(20px, 6vw, 84px) clamp(82px, 9vw, 118px);
          color: #ffffff;
          background-color: #08111f;
          background-image: var(--hero-asset);
          background-repeat: no-repeat;
          background-position: right clamp(20px, 9vw, 150px) top 58px;
          background-size: clamp(210px, 28vw, 410px);
        }

        .lp-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(5, 12, 24, 0.72);
          z-index: 0;
        }

        .lp-hero-content {
          position: relative;
          z-index: 2;
          width: min(650px, 100%);
        }

        .lp-eyebrow {
          margin: 0 0 16px;
          color: #8be0d8;
          font-size: 14px;
          font-weight: 800;
        }

        .lp-hero h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(48px, 8vw, 88px);
          line-height: 0.98;
          font-weight: 900;
        }

        .lp-hero-copy {
          width: min(610px, 100%);
          margin: 24px 0 0;
          color: #d7e3f1;
          font-size: clamp(18px, 2vw, 22px);
          line-height: 1.58;
        }

        .lp-hero-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 34px;
        }

        .lp-proof-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          width: min(620px, 100%);
          margin-top: 44px;
        }

        .lp-proof-item {
          border-left: 3px solid #2dd4bf;
          padding-left: 14px;
        }

        .lp-proof-value {
          display: block;
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
        }

        .lp-proof-label {
          display: block;
          margin-top: 8px;
          color: #aebfd2;
          font-size: 13px;
          line-height: 1.4;
        }

        .lp-hero-scene {
          position: absolute;
          z-index: 1;
          right: clamp(20px, 6vw, 90px);
          bottom: clamp(34px, 8vw, 90px);
          width: min(570px, 44vw);
          color: #0f172a;
          background: #ffffff;
          border: 1px solid rgba(219, 229, 241, 0.55);
          border-radius: 8px;
          box-shadow: 0 32px 90px rgba(0, 0, 0, 0.42);
          overflow: hidden;
        }

        .lp-scene-top {
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          border-bottom: 1px solid #e5edf7;
          background: #f8fafc;
        }

        .lp-scene-dots {
          display: flex;
          gap: 7px;
        }

        .lp-scene-dots span {
          width: 8px;
          height: 8px;
          border-radius: 8px;
          background: #94a3b8;
        }

        .lp-scene-label {
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
        }

        .lp-scene-body {
          display: grid;
          grid-template-columns: 132px 1fr;
          min-height: 338px;
        }

        .lp-scene-rail {
          padding: 18px 14px;
          background: #f1f5f9;
          border-right: 1px solid #e2e8f0;
        }

        .lp-rail-item {
          height: 34px;
          display: flex;
          align-items: center;
          padding: 0 11px;
          margin-bottom: 8px;
          border-radius: 8px;
          color: #475569;
          font-size: 12px;
          font-weight: 750;
        }

        .lp-rail-item.is-active {
          color: #0f766e;
          background: #d9f6f0;
        }

        .lp-scene-main {
          padding: 18px;
        }

        .lp-scene-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
        }

        .lp-scene-title {
          font-size: 15px;
          font-weight: 900;
        }

        .lp-scene-status {
          padding: 7px 10px;
          border-radius: 8px;
          color: #713f12;
          background: #fef3c7;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .lp-scene-tabs {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 16px;
        }

        .lp-scene-tab {
          min-height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid #dbe4ef;
          border-radius: 8px;
          color: #475569;
          background: #ffffff;
          font-size: 11px;
          font-weight: 850;
        }

        .lp-scene-tab.is-active {
          color: #ffffff;
          border-color: #0f766e;
          background: #0f766e;
        }

        .lp-scene-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .lp-scene-field {
          min-height: 52px;
          padding: 9px 10px;
          border: 1px solid #dbe4ef;
          border-radius: 8px;
          background: #ffffff;
        }

        .lp-scene-field span {
          display: block;
          margin-bottom: 6px;
          color: #8090a5;
          font-size: 10px;
          font-weight: 900;
        }

        .lp-scene-field strong {
          display: block;
          height: 10px;
          width: 72%;
          border-radius: 8px;
          background: #c7d2fe;
        }

        .lp-section {
          padding: clamp(68px, 9vw, 110px) clamp(20px, 6vw, 84px);
          background: #ffffff;
        }

        .lp-section-muted {
          background: #f5f7fb;
        }

        .lp-section-inner {
          width: min(1160px, 100%);
          margin: 0 auto;
        }

        .lp-section-header {
          width: min(720px, 100%);
          margin-bottom: 36px;
        }

        .lp-section-header.center {
          margin-left: auto;
          margin-right: auto;
          text-align: center;
        }

        .lp-section-kicker {
          margin: 0 0 10px;
          color: #0f766e;
          font-size: 14px;
          font-weight: 900;
        }

        .lp-section-title {
          margin: 0;
          color: #111827;
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1.08;
          font-weight: 900;
        }

        .lp-section-copy {
          margin: 16px 0 0;
          color: #56657a;
          font-size: 17px;
          line-height: 1.7;
        }

        .lp-lifecycle-grid,
        .lp-capability-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .lp-capability-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .lp-card {
          min-height: 100%;
          border: 1px solid #dfe7f2;
          border-radius: 8px;
          padding: 24px;
          background: #ffffff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.06);
        }

        .lp-step {
          display: inline-grid;
          place-items: center;
          width: 42px;
          height: 34px;
          margin-bottom: 22px;
          border-radius: 8px;
          color: #0f766e;
          background: #d9f6f0;
          font-size: 13px;
          font-weight: 900;
        }

        .lp-card h3 {
          margin: 0;
          color: #101827;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
        }

        .lp-card p {
          margin: 12px 0 0;
          color: #59687d;
          font-size: 15px;
          line-height: 1.65;
        }

        .lp-capability-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 900;
        }

        .lp-capability-icon.teal {
          color: #0f766e;
          background: #d9f6f0;
        }

        .lp-capability-icon.blue {
          color: #1d4ed8;
          background: #dbeafe;
        }

        .lp-capability-icon.amber {
          color: #92400e;
          background: #fef3c7;
        }

        .lp-capability-icon.green {
          color: #166534;
          background: #dcfce7;
        }

        .lp-capability-icon.rose {
          color: #be123c;
          background: #ffe4e6;
        }

        .lp-capability-icon.navy {
          color: #172554;
          background: #e0e7ff;
        }

        .lp-builder {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: clamp(28px, 5vw, 70px);
          align-items: center;
        }

        .lp-builder-list {
          display: grid;
          gap: 12px;
          margin: 28px 0 0;
          padding: 0;
          list-style: none;
        }

        .lp-builder-list li {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 12px;
          align-items: start;
          color: #354052;
          font-size: 16px;
          line-height: 1.55;
        }

        .lp-check {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: #ffffff;
          background: #0f766e;
          font-size: 14px;
          font-weight: 900;
        }

        .lp-builder-panel {
          border: 1px solid #cfd9e7;
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 26px 70px rgba(15, 23, 42, 0.12);
        }

        .lp-builder-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          border-bottom: 1px solid #dfe7f2;
          background: #f8fafc;
        }

        .lp-builder-panel-head strong {
          font-size: 15px;
          font-weight: 900;
        }

        .lp-add-button {
          width: 34px;
          height: 34px;
          border: 1px solid #0f766e;
          border-radius: 8px;
          color: #0f766e;
          background: #ffffff;
          font-size: 22px;
          line-height: 1;
          font-weight: 700;
        }

        .lp-builder-panel-body {
          padding: 20px;
        }

        .lp-builder-tabs {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 20px;
        }

        .lp-builder-tab {
          min-height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid #dbe4ef;
          border-radius: 8px;
          color: #475569;
          background: #ffffff;
          font-size: 12px;
          font-weight: 850;
          text-align: center;
        }

        .lp-builder-tab.is-active {
          color: #ffffff;
          border-color: #2563eb;
          background: #2563eb;
        }

        .lp-form-section {
          border: 1px solid #dbe4ef;
          border-radius: 8px;
          overflow: hidden;
        }

        .lp-form-section-title {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 15px 16px;
          border-bottom: 1px solid #dbe4ef;
          background: #f8fafc;
          font-size: 14px;
          font-weight: 900;
        }

        .lp-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 16px;
        }

        .lp-form-field {
          min-height: 72px;
        }

        .lp-form-label {
          display: block;
          margin-bottom: 8px;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
        }

        .lp-form-input {
          height: 40px;
          border: 1px solid #dbe4ef;
          border-radius: 8px;
          background: #ffffff;
        }

        .lp-admin-strip {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 16px;
          padding: 14px 16px;
          border: 1px dashed #8aa4ff;
          border-radius: 8px;
          color: #243b85;
          background: #eef3ff;
          font-size: 13px;
          font-weight: 850;
        }

        .lp-security {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: clamp(28px, 5vw, 64px);
          align-items: start;
        }

        .lp-security-stack {
          display: grid;
          gap: 14px;
        }

        .lp-security-row {
          display: grid;
          grid-template-columns: 52px 1fr;
          gap: 16px;
          align-items: start;
          padding: 18px;
          border: 1px solid #dfe7f2;
          border-radius: 8px;
          background: #ffffff;
        }

        .lp-security-number {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          color: #ffffff;
          background: #111827;
          font-size: 13px;
          font-weight: 900;
        }

        .lp-security-row h3 {
          margin: 0;
          color: #101827;
          font-size: 18px;
          font-weight: 900;
        }

        .lp-security-row p {
          margin: 7px 0 0;
          color: #59687d;
          line-height: 1.6;
        }

        .lp-final {
          color: #ffffff;
          background-color: #0b1728;
          background-image: var(--hero-asset);
          background-repeat: no-repeat;
          background-position: right clamp(20px, 8vw, 130px) center;
          background-size: clamp(190px, 24vw, 330px);
        }

        .lp-final .lp-section-title,
        .lp-final .lp-section-copy {
          color: #ffffff;
        }

        .lp-final .lp-section-copy {
          color: #c7d5e8;
        }

        .lp-final-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 34px;
        }

        .lp-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 26px clamp(20px, 6vw, 84px);
          color: #617086;
          background: #ffffff;
          border-top: 1px solid #dfe7f2;
          font-size: 14px;
        }

        @media (max-width: 1080px) {
          .lp-hero {
            min-height: auto;
            display: block;
            padding-top: 76px;
          }

          .lp-hero-scene {
            position: relative;
            right: auto;
            bottom: auto;
            width: 100%;
            margin-top: 42px;
          }

          .lp-lifecycle-grid,
          .lp-capability-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lp-builder,
          .lp-security {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .lp-header {
            align-items: flex-start;
            flex-direction: column;
            padding-top: 14px;
            padding-bottom: 14px;
          }

          .lp-nav {
            width: 100%;
            gap: 14px;
            overflow-x: auto;
            padding-bottom: 4px;
          }

          .lp-actions {
            width: 100%;
          }

          .lp-actions .lp-button {
            width: 100%;
          }

          .lp-hero {
            min-height: auto;
            background-position: right -44px top 76px;
            background-size: 230px;
          }

          .lp-proof-row,
          .lp-lifecycle-grid,
          .lp-capability-grid,
          .lp-builder-tabs,
          .lp-scene-grid,
          .lp-form-grid {
            grid-template-columns: 1fr;
          }

          .lp-scene-body {
            grid-template-columns: 1fr;
          }

          .lp-scene-rail {
            display: none;
          }

          .lp-builder-tab {
            min-height: 34px;
          }

          .lp-admin-strip,
          .lp-final-inner,
          .lp-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .lp-final {
            background-position: right -50px bottom 20px;
          }
        }
      `}</style>

      <header className="lp-header">
        <a className="lp-brand" href="#top" onClick={handleAnchorClick('top')}>
          <span className="lp-brand-mark">S</span>
          <span>Shiksha</span>
        </a>

        <nav className="lp-nav" aria-label="Landing page navigation">
          <a href="#workflow" onClick={handleAnchorClick('workflow')}>Workflow</a>
          <a href="#capabilities" onClick={handleAnchorClick('capabilities')}>Features</a>
          <a href="#builder" onClick={handleAnchorClick('builder')}>Tenant Builder</a>
          <a href="#security" onClick={handleAnchorClick('security')}>Security</a>
        </nav>

        <div className="lp-actions">
          <button type="button" className="lp-button lp-button-secondary" onClick={() => navigate('/login')}>
            Login
          </button>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero" style={{ '--hero-asset': `url(${heroImage})` }}>
          <div className="lp-hero-content">
            <p className="lp-eyebrow">Education CRM for study abroad teams</p>
            <h1>Shiksha</h1>
            <p className="lp-hero-copy">
              A professional operating system for consultancies that need clean student records,
              configurable tenant workflows, application tracking, documents, and notes in one place.
            </p>
            <div className="lp-hero-buttons">
              <button type="button" className="lp-button lp-button-primary" onClick={() => navigate('/login')}>
                Request a demo
              </button>
              <button type="button" className="lp-button lp-button-secondary" onClick={() => navigate('/login')}>
                Sign in
              </button>
            </div>
            <div className="lp-proof-row" aria-label="Product highlights">
              <div className="lp-proof-item">
                <span className="lp-proof-value">Multi-tenant</span>
                <span className="lp-proof-label">Built for separate agency workspaces</span>
              </div>
              <div className="lp-proof-item">
                <span className="lp-proof-value">No-code</span>
                <span className="lp-proof-label">Tenant admins can adapt student pages</span>
              </div>
              <div className="lp-proof-item">
                <span className="lp-proof-value">End-to-end</span>
                <span className="lp-proof-label">Lead, profile, application, and document flow</span>
              </div>
            </div>
          </div>

          <div className="lp-hero-scene" aria-hidden="true">
            <div className="lp-scene-top">
              <div className="lp-scene-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="lp-scene-label">Student workspace</span>
            </div>
            <div className="lp-scene-body">
              <div className="lp-scene-rail">
                <div className="lp-rail-item is-active">Students</div>
                <div className="lp-rail-item">Applications</div>
                <div className="lp-rail-item">Documents</div>
                <div className="lp-rail-item">Reports</div>
              </div>
              <div className="lp-scene-main">
                <div className="lp-scene-heading">
                  <span className="lp-scene-title">Student profile</span>
                  <span className="lp-scene-status">Tenant Admin</span>
                </div>
                <div className="lp-scene-tabs">
                  <div className="lp-scene-tab is-active">Profile</div>
                  <div className="lp-scene-tab">Apps</div>
                  <div className="lp-scene-tab">Docs</div>
                  <div className="lp-scene-tab">Notes</div>
                  <div className="lp-scene-tab">+</div>
                </div>
                <div className="lp-scene-grid">
                  <div className="lp-scene-field"><span>FIRST NAME</span><strong /></div>
                  <div className="lp-scene-field"><span>EMAIL</span><strong /></div>
                  <div className="lp-scene-field"><span>LEAD STATUS</span><strong /></div>
                  <div className="lp-scene-field"><span>DATE OF BIRTH</span><strong /></div>
                  <div className="lp-scene-field"><span>CUSTOM PAGE</span><strong /></div>
                  <div className="lp-scene-field"><span>FIELD TYPE</span><strong /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="lp-section">
          <div className="lp-section-inner">
            <div className="lp-section-header">
              <p className="lp-section-kicker">Operating model</p>
              <h2 className="lp-section-title">One CRM for the full student journey.</h2>
              <p className="lp-section-copy">
                Shiksha keeps the team focused on outcomes: every lead, student,
                application, document, and note lives in a workflow your tenant can actually maintain.
              </p>
            </div>

            <div className="lp-lifecycle-grid">
              {lifecycleSteps.map((item) => (
                <article className="lp-card" key={item.step}>
                  <span className="lp-step">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="lp-section lp-section-muted">
          <div className="lp-section-inner">
            <div className="lp-section-header center">
              <p className="lp-section-kicker">Product depth</p>
              <h2 className="lp-section-title">Built for agencies that outgrow spreadsheets.</h2>
              <p className="lp-section-copy">
                The product is structured for real education operations, not generic sales tracking.
              </p>
            </div>

            <div className="lp-capability-grid">
              {capabilities.map((capability, index) => (
                <article className="lp-card" key={capability.title}>
                  <span className={`lp-capability-icon ${capability.accent}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3>{capability.title}</h3>
                  <p>{capability.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="builder" className="lp-section">
          <div className="lp-section-inner lp-builder">
            <div>
              <p className="lp-section-kicker">Tenant admin builder</p>
              <h2 className="lp-section-title">Let each tenant shape the student record.</h2>
              <p className="lp-section-copy">
                Tenant admins can add their own page to the student navigation, then define
                the sections and fields inside that page. This keeps the core CRM stable while
                giving every agency room for its own requirements.
              </p>

              <ul className="lp-builder-list">
                {tenantControls.map((control) => (
                  <li key={control}>
                    <span className="lp-check">OK</span>
                    <span>{control}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-builder-panel" aria-label="Dynamic page builder preview">
              <div className="lp-builder-panel-head">
                <strong>Student Pages</strong>
                <button className="lp-add-button" type="button" aria-label="Add page">+</button>
              </div>
              <div className="lp-builder-panel-body">
                <div className="lp-builder-tabs">
                  <div className="lp-builder-tab">1 Profile</div>
                  <div className="lp-builder-tab">2 Apps</div>
                  <div className="lp-builder-tab">3 Docs</div>
                  <div className="lp-builder-tab">4 Notes</div>
                  <div className="lp-builder-tab is-active">5 Visa</div>
                </div>

                <div className="lp-form-section">
                  <div className="lp-form-section-title">
                    <span>Visa Readiness</span>
                    <span>+ Add Field</span>
                  </div>
                  <div className="lp-form-grid">
                    <div className="lp-form-field">
                      <span className="lp-form-label">PASSPORT NUMBER</span>
                      <div className="lp-form-input" />
                    </div>
                    <div className="lp-form-field">
                      <span className="lp-form-label">IELTS SCORE</span>
                      <div className="lp-form-input" />
                    </div>
                    <div className="lp-form-field">
                      <span className="lp-form-label">FUNDS VERIFIED</span>
                      <div className="lp-form-input" />
                    </div>
                    <div className="lp-form-field">
                      <span className="lp-form-label">INTERVIEW DATE</span>
                      <div className="lp-form-input" />
                    </div>
                  </div>
                </div>

                <div className="lp-admin-strip">
                  <span>Only tenant admins can customize fields</span>
                  <span>Text, date, number, select, checkbox</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="lp-section lp-section-muted">
          <div className="lp-section-inner lp-security">
            <div className="lp-section-header">
              <p className="lp-section-kicker">Control and trust</p>
              <h2 className="lp-section-title">Designed for clean ownership at tenant scale.</h2>
              <p className="lp-section-copy">
                Dynamic configuration is powerful only when it is governed. The product should keep
                tenant data isolated, configuration permissions narrow, and operational screens fast.
              </p>
            </div>

            <div className="lp-security-stack">
              <article className="lp-security-row">
                <span className="lp-security-number">01</span>
                <div>
                  <h3>Admin-only configuration</h3>
                  <p>Page and field customization stays in the tenant admin view, away from normal staff workflows.</p>
                </div>
              </article>
              <article className="lp-security-row">
                <span className="lp-security-number">02</span>
                <div>
                  <h3>Tenant-aware records</h3>
                  <p>Student records, application data, custom fields, and values are scoped to the right tenant.</p>
                </div>
              </article>
              <article className="lp-security-row">
                <span className="lp-security-number">03</span>
                <div>
                  <h3>Operational clarity</h3>
                  <p>Teams see the fields they need on the pages they use, reducing noise and repeated admin work.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-section lp-final" style={{ '--hero-asset': `url(${heroImage})` }}>
          <div className="lp-section-inner lp-final-inner">
            <div className="lp-section-header">
              <p className="lp-section-kicker">Ready for a better CRM</p>
              <h2 className="lp-section-title">Run student operations with structure from day one.</h2>
              <p className="lp-section-copy">
                Give each tenant the flexibility they need while keeping the platform professional,
                maintainable, and ready for growth.
              </p>
            </div>
            <button type="button" className="lp-button lp-button-primary" onClick={() => navigate('/login')}>
              Open Shiksha
            </button>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <strong>Shiksha</strong>
        <span>Access to abroad studies, backed by a configurable CRM platform.</span>
      </footer>
    </div>
  );
}

export default LandingPage;
