import React from 'react';
import s from './auth.module.css';
import Logo from '../../components/common/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AuthShell({ title, sub, subtitle, portalLabel, children }) {
  const { lang, setLang } = useAuth();

  const portalSubtitle =
    portalLabel ||
    (lang === 'ar' ? 'أكاديمية الفضاء المصرية' : 'Space Academy • Mission Control');

  return (
    <div className={s.wrap}>
      {/* Left Visual Section — Aerospace Identity */}
      <section className={s.hero} aria-label="EGSA Aerospace Identity">
        <div className={s.ambientPattern} aria-hidden="true" />
        <div className={s.orbitalRing} aria-hidden="true" />

        <div className={s.brandCenter}>
          <div className={s.logoPlate}>
            <Logo size={96} />
          </div>
          <h1 className={s.agencyTitle}>
            {lang === 'ar' ? 'وكالة الفضاء المصرية' : 'Egyptian Space Agency'}
          </h1>
          <div className={s.academySubtitle}>{portalSubtitle}</div>
        </div>

        <div className={s.visualFooter}>
          <span className={s.statusDot} aria-hidden="true" />
          <span>EGSA // MISSION CONTROL</span>
        </div>
      </section>

      {/* Right Form Section — Clean Authentication */}
      <main className={s.panel}>
        <div className={s.formCard}>
          <div className={s.topBar}>
            <button
              className={s.langBtn}
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              type="button"
              aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
            >
              <i className="fa-solid fa-globe" aria-hidden="true" />
              <span>{lang === 'en' ? 'العربية' : 'English'}</span>
            </button>
          </div>

          <div className={s.formHeader}>
            <h2 className={s.formTitle}>{title}</h2>
            {(sub || subtitle) && <p className={s.formSubtitle}>{sub || subtitle}</p>}
          </div>

          {children}

          <div className={s.formFooter}>
            Egyptian Space Agency • Space Academy
          </div>
        </div>
      </main>
    </div>
  );
}
