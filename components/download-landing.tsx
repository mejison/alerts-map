'use client';

import { Apple, ArrowDown, ArrowRight, ArrowUpRight, Bell, Check, ChevronDown, Crosshair, Download, Globe2, Layers, Map, Menu, Radio, Shield, Smartphone, Wifi, X } from 'lucide-react';
import { useState } from 'react';
import downloads from '@/lib/app-downloads.json';
import './download-landing.css';

function PlayIcon() {
  return <svg viewBox="0 0 24 26" width="23" height="25" aria-hidden="true"><path d="M2 1 15 13 2 25Z" fill="currentColor"/><path d="m4 0 14 9-3 3Z" fill="currentColor" opacity=".65"/><path d="m16 14 3-3 4 2-4 3Z" fill="currentColor" opacity=".8"/><path d="m4 26 11-11 3 3Z" fill="currentColor" opacity=".65"/></svg>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <a href="/download/" className={`dl-brand ${light ? 'dl-brand-light' : ''}`} aria-label="ВАРТА — застосунок"><span className="dl-brand-mark"><Shield size={32}/><i/></span><span>ВАРТА<small>ПОРУЧ. ЩОМИТІ.</small></span></a>;
}

function PhonePreview() {
  return <div className="dl-device-scene" aria-label="Демонстрація інтерфейсу мобільної ВАРТИ">
    <div className="dl-scene-ring dl-ring-one"/><div className="dl-scene-ring dl-ring-two"/>
    <div className="dl-phone">
      <div className="dl-phone-island"/>
      <div className="dl-phone-status"><b>9:41</b><span><Radio size={12}/><Wifi size={13}/><i/></span></div>
      <div className="dl-phone-header"><span><Shield size={22}/>ВАРТА</span><Bell size={19}/></div>
      <div className="dl-phone-map-heading"><span>СИТУАЦІЙНА КАРТА</span><b>Вся Україна <ChevronDown size={12}/></b></div>
      <div className="dl-phone-filters"><span className="selected">Усі загрози</span><span>БпЛА</span><span>Ракети</span></div>
      <img className="dl-phone-map" src="/illustrations/varta-map.svg" width="1100" height="800" alt="Карта всієї України з вибраною Київською областю"/>
      <div className="dl-phone-layers"><Layers size={15}/></div>
      <div className="dl-phone-region"><span><Crosshair size={18}/></span><div><small>ВАША ОБЛАСТЬ</small><b>Київська область</b></div><ArrowRight size={15}/></div>
      <div className="dl-phone-nav"><span className="active"><Map size={17}/>Карта</span><span><Radio size={17}/>Ситуація</span><span><Crosshair size={17}/>Регіони</span></div>
      <div className="dl-phone-home"/>
    </div>
    <div className="dl-floating-note"><span className="dl-note-icon"><Bell size={23}/></span><div><small>ПРИКЛАД СПОВІЩЕННЯ</small><strong>Важливе — одразу на екрані.</strong><p>Тривога та відбій для вашої області</p></div></div>
    <div className="dl-scene-caption"><span/>Демонстрація інтерфейсу</div>
  </div>;
}

const questions = [
  ['Чи можна користуватися ВАРТОЮ без встановлення?', 'Так. Відкрийте вебкарту — вона працює на телефоні, планшеті та комп’ютері. Встановлення вебзастосунку на головний екран дає окрему іконку й швидкий доступ.'],
  ['Коли застосунки будуть в App Store та Google Play?', 'Мобільні версії готуються до публікації. Щойно вони стануть доступними, на цій сторінці з’являться прямі посилання на магазини. До того часу можна користуватися вебзастосунком.'],
  ['Як працюють сповіщення?', 'Ви обираєте область і надаєте дозвіл на сповіщення. Сервер перевіряє стан тривог щохвилини та надсилає повідомлення при зміні стану. Доставка залежить від мережі й налаштувань пристрою. У тестовій Android-збірці нативні сповіщення ще готуються.'],
  ['Чому на iPhone вебзастосунок потрібно додати на головний екран?', 'Це вимога iOS для вебсповіщень: потрібна iOS 16.4 або новіша, а ВАРТУ слід відкрити з іконки на головному екрані. В окремому iOS-застосунку після його випуску буде звичайний системний запит дозволу.'],
  ['Звідки дані на карті?', 'ВАРТА використовує відкриті повідомлення моніторингу NEPTUN та показує джерело, час і достовірність. Координати загроз можуть бути орієнтовними. ВАРТА — незалежний інформаційний сервіс; під час тривоги дотримуйтеся офіційних вказівок.'],
];

export function DownloadLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<'ios' | 'android'>('ios');
  return <div className="download-page">
    <a className="dl-skip" href="#main">До вмісту</a>
    <header className="dl-header"><div className="dl-container dl-header-inner"><Brand/>
      <nav aria-label="Навігація лендінгу" className={menuOpen ? 'dl-menu is-open' : 'dl-menu'}><a href="#features" onClick={() => setMenuOpen(false)}>Можливості</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>Як це працює</a><a href="#faq" onClick={() => setMenuOpen(false)}>Запитання</a></nav>
      <a className="dl-web-link" href="/">Відкрити карту <ArrowUpRight size={16}/></a><button className="dl-menu-toggle" aria-label={menuOpen ? 'Закрити меню' : 'Відкрити меню'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
    </div></header>
    <main id="main">
      <section className="dl-hero dl-container">
        <div className="dl-hero-copy"><span className="dl-eyebrow"><span className="dl-status-dot"/>УКРАЇНА. ВАШ РЕГІОН. ВАША ВАРТА.</span>
          <h1>Важливе поруч.<br/><span>Де б ви не були.</span></h1>
          <p className="dl-hero-description">Повітряна ситуація на одній карті. Тривоги й відбої для вашої області. ВАРТА допомагає залишатися в курсі та дбати про близьких.</p>
          <div className="dl-hero-actions"><a className="dl-button dl-button-dark" href="#download">ВАРТА на ваш телефон <ArrowDown size={18}/></a><a className="dl-text-link" href="/">Переглянути карту <ArrowUpRight size={16}/></a></div>
          <div className="dl-hero-availability"><span><Apple size={16}/>iPhone</span><span><PlayIcon/>Android</span><span><Globe2 size={16}/>Веб</span></div>
          <p className="dl-hero-footnote">Вебверсія вже доступна. Застосунки для магазинів готуються.</p>
        </div>
        <PhonePreview/>
      </section>
      <div className="dl-principles"><div className="dl-container"><span><Check size={16}/>Без реєстрації</span><span><Check size={16}/>Українською</span><span><Check size={16}/>На телефоні та комп’ютері</span><span><Check size={16}/>Ваш регіон — під рукою</span></div></div>
      <section className="dl-section dl-container" id="features">
        <div className="dl-section-heading"><div><span className="dl-eyebrow">МЕНШЕ ПОШУКІВ. БІЛЬШЕ ЯСНОСТІ.</span><h2>Усе, щоб розуміти<br/>ситуацію навколо.</h2></div><p>Зручна карта й потрібні налаштування.<br/>Увага залишається на важливому.</p></div>
        <div className="dl-features"><article className="dl-feature dl-feature-map"><span className="dl-feature-icon"><Map size={24}/></span><h3>Країна на долоні</h3><p>Статуси областей, публічні повідомлення про загрози та більше населених пунктів при наближенні.</p><div className="dl-feature-map-art"><img src="/illustrations/varta-map.svg" width="1100" height="800" alt="Демонстраційна карта України у ВАРТІ" loading="lazy"/><span><Layers size={13}/>Зручні шари карти</span></div></article>
          <article className="dl-feature dl-feature-notifications"><span className="dl-feature-icon"><Bell size={24}/></span><h3>Ваша область. Ваші сповіщення.</h3><p>Оберіть регіон, щоб отримувати повідомлення про тривогу та відбій. Налаштування підписки — в одному місці.</p><div className="dl-sample-notification"><img src="/favicon.svg" width="34" height="34" alt=""/><div><small>ВАРТА · ПРИКЛАД</small><b>Відбій повітряної тривоги</b><span>Повідомлення для обраної області</span></div><Check size={17}/></div><div className="dl-notification-line"><span/><b>Ви обираєте, що важливо.</b><Bell size={15}/></div></article>
          <article className="dl-feature dl-feature-region"><span className="dl-feature-icon"><Crosshair size={24}/></span><h3>Ближче до свого</h3><p>Збережіть свою область, змінюйте масштаб і повертайтеся до потрібного регіону одним дотиком.</p><div className="dl-region-chip"><Crosshair size={18}/><span>Ваша область — під рукою</span><ArrowRight size={16}/></div></article>
        </div>
      </section>
      <section className="dl-how-section" id="how-it-works"><div className="dl-container dl-how"><div><span className="dl-eyebrow">КІЛЬКА ПРОСТИХ КРОКІВ</span><h2>Відкрити.<br/>Обрати.<br/><span>Бути в курсі.</span></h2><a className="dl-text-link" href="#download">Почати з ВАРТОЮ <ArrowRight size={17}/></a></div><ol className="dl-steps"><li><span>01</span><div><h3>Відкрийте ВАРТУ</h3><p>Почніть із вебкарти або встановіть вебзастосунок на головний екран телефона.</p></div><Smartphone size={24}/></li><li><span>02</span><div><h3>Оберіть свою область</h3><p>Збережіть регіон для швидкого доступу до місцевої ситуації.</p></div><Crosshair size={24}/></li><li><span>03</span><div><h3>Увімкніть сповіщення</h3><p>Надайте дозвіл і перевірте доставку тестовим повідомленням у налаштуваннях ВАРТИ.</p></div><Bell size={24}/></li></ol></div></section>
      <section className="dl-section dl-container dl-download" id="download"><span className="dl-eyebrow">ОДНА ВАРТА. ВАШ СПОСІБ БУТИ ПОРУЧ.</span><h2>Беріть ВАРТУ із собою.</h2><p className="dl-section-description">Почніть із вебзастосунку вже зараз.<br/>Тут з’являться й версії для App Store та Google Play.</p>
        <div className="dl-platforms"><article className="dl-platform"><Apple size={33}/><h3>Для iPhone</h3><p>Карта та нативні сповіщення<br/>у власному застосунку.</p>{downloads.iosStoreUrl ? <a className="dl-button dl-button-dark" href={downloads.iosStoreUrl}>Завантажити в App Store <ArrowUpRight size={17}/></a> : <div className="dl-store-status"><span/>Готуємо для App Store</div>}<small>iOS 15 або новіша</small></article>
          <article className="dl-platform"><PlayIcon/><h3>Для Android</h3><p>Звична ВАРТА.<br/>На головному екрані телефона.</p>{downloads.androidStoreUrl ? <a className="dl-button dl-button-dark" href={downloads.androidStoreUrl}>Завантажити в Google Play <ArrowUpRight size={17}/></a> : downloads.androidPreviewUrl ? <><a className="dl-button dl-button-dark" href={downloads.androidPreviewUrl}>Завантажити тестовий APK <Download size={17}/></a><span className="dl-preview-note">Тестова версія. Push ще готуються.</span></> : <div className="dl-store-status"><span/>Готуємо для Google Play</div>}<small>Android 7 або новіший</small></article>
          <article className="dl-platform dl-platform-web"><Globe2 size={33}/><span className="dl-ready-label">ВЖЕ ДОСТУПНО</span><h3>У вашому браузері</h3><p>Телефон, планшет чи комп’ютер.<br/>Без завантаження з магазину.</p><a className="dl-button dl-button-dark" href="/">Відкрити вебзастосунок <ArrowUpRight size={17}/></a><small>Safari, Chrome, Edge, Firefox</small></article></div>
        <div className="dl-install-guide"><div><span className="dl-eyebrow">ШВИДКИЙ ДОСТУП УЖЕ ЗАРАЗ</span><h3>Додайте вебВАРТУ<br/>на головний екран.</h3></div><div className="dl-install-guide-body"><div className="dl-platform-tabs" role="group" aria-label="Інструкція для вашого телефона"><button aria-pressed={installPlatform === 'ios'} onClick={() => setInstallPlatform('ios')}><Apple size={15}/>iPhone</button><button aria-pressed={installPlatform === 'android'} onClick={() => setInstallPlatform('android')}><PlayIcon/>Android</button></div><p>{installPlatform === 'ios' ? 'Відкрийте карту в Safari → «Поширити» → «На початковий екран». Запустіть ВАРТУ з нової іконки. Для вебсповіщень потрібна iOS 16.4 або новіша.' : 'Відкрийте карту в Chrome → меню ⋮ → «Додати на головний екран» або «Встановити застосунок». Запустіть ВАРТУ з нової іконки й налаштуйте сповіщення.'}</p><a className="dl-text-link" href="/">Перейти до карти <ArrowRight size={16}/></a></div></div>
      </section>
      <section className="dl-faq-section" id="faq"><div className="dl-container dl-faq"><div><span className="dl-eyebrow">ЗАЛИШИЛИСЯ ЗАПИТАННЯ?</span><h2>Розберімося.</h2><p>Просто про те,<br/>як працює ВАРТА.</p></div><div className="dl-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={19}/></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="dl-final dl-container"><Shield size={36}/><h2>Дбайте про себе.<br/><span>І про тих, хто поруч.</span></h2><a className="dl-button dl-button-light" href="/">Відкрити карту України <ArrowUpRight size={18}/></a><p>ВАРТА — інформаційний сервіс.<br/>Під час тривоги дотримуйтеся офіційних сигналів та прямуйте в укриття.</p></section>
    </main>
    <footer className="dl-footer"><div className="dl-container"><Brand/><span>Зроблено для України. Поруч щомиті.</span><div><a href="/privacy/">Приватність</a><a href="https://github.com/mejison/alerts-map/issues" target="_blank" rel="noreferrer">Підтримка <ArrowUpRight size={13}/></a></div></div></footer>
  </div>;
}
