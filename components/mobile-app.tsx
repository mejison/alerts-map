'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check, Download, Info, Send, Smartphone, X } from 'lucide-react';
import { useNotifications } from '@/lib/use-notifications';

export function MobileApp({ open, onClose, selected, regions }: { open: boolean; onClose: () => void; selected: string; regions: { key: string; name: string }[] }) {
  const push = useNotifications();
  const [choice, setChoice] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  const active = push.region && push.region === choice;
  useEffect(() => {
    if (open && !wasOpen.current) setChoice(selected || push.region || '');
    wasOpen.current = open;
  }, [open, selected, push.region]);
  useEffect(() => { if (open && !choice && push.region) setChoice(push.region); }, [open, choice, push.region]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const needsIosInstall = !push.native && push.ios && !push.installed;
  const canSubscribe = push.supported && push.config?.enabled && !!choice && !needsIosInstall && (push.native || push.permission !== 'denied');
  return <div className="modal-backdrop" onClick={onClose}>
    <section ref={dialog} className="modal app-modal" role="dialog" aria-modal="true" aria-labelledby="app-title" onClick={event => event.stopPropagation()}>
      <div className="panel-heading"><span className="eyebrow">ВАША ВАРТА · ЗАВЖДИ ПОРУЧ</span><button className="icon-button" onClick={onClose} aria-label="Закрити налаштування сповіщень"><X size={20}/></button></div>
      <div className="app-modal-icon"><Smartphone size={27}/></div>
      <h2 id="app-title">{push.native ? 'Ваша область.' : 'Карта як застосунок.'}<br/>Сповіщення для вас.</h2>
      <p className="modal-intro">{push.native ? 'Оберіть область і дозвольте сповіщення, щоб отримувати тривогу та відбій — навіть коли застосунок закритий.' : 'Встановіть ВАРТУ на головний екран і отримуйте тривогу та відбій для своєї області — навіть коли карта закрита.'}</p>
      {!push.native && <><div className="install-card"><div><b>{push.installed ? 'ВАРТУ вже встановлено' : 'ВАРТА на головному екрані'}</b><p>{push.installed ? 'Відкривайте карту одним дотиком.' : push.ios ? 'У Safari натисніть «Поширити» → «На початковий екран». Відкрийте ВАРТУ з нової іконки, щоб увімкнути сповіщення.' : push.canInstall ? 'Окреме вікно, швидкий запуск і більше місця для карти.' : 'У меню браузера оберіть «Установити застосунок» або «Додати на головний екран».'}</p></div>{push.installed ? <Check size={23}/> : push.canInstall && <button className="install-action" onClick={push.install}><Download size={16}/>Встановити</button>}</div><a className="native-download-link" href="/download/">ВАРТА для iPhone та Android <Download size={14}/></a></>}
      <label className="notification-label" htmlFor="notification-region">Область для сповіщень</label>
      <select id="notification-region" className="notification-select" value={choice} onChange={event => setChoice(event.target.value)} disabled={push.busy}><option value="">Оберіть область</option>{regions.map(region => <option key={region.key} value={region.name}>{region.name}</option>)}</select>
      {push.region && <p className="notification-current"><span className="green-dot"/>Підписка на цьому пристрої: {push.region}</p>}
      <div className="notification-actions"><button className="notification-primary" disabled={push.busy || (!active && !canSubscribe)} onClick={() => active ? push.unsubscribe() : push.subscribe(choice)}>{active ? <BellOff size={17}/> : <Bell size={17}/>} {push.busy ? 'Зачекайте…' : active ? 'Вимкнути сповіщення' : push.region ? 'Змінити область підписки' : 'Увімкнути сповіщення'}</button>{push.region && <button className="notification-test" disabled={push.busy} onClick={push.test}><Send size={16}/>Перевірити</button>}</div>
      {push.region && !active && <button className="notification-unsubscribe" disabled={push.busy} onClick={push.unsubscribe}>Вимкнути поточну підписку</button>}
      <div className="notification-feedback" role="status" aria-live="polite">{push.error ? <p className="notification-error">{push.error}</p> : push.message ? <p className="notification-success">{push.message}</p> : needsIosInstall ? <p>На iPhone сповіщення доступні у встановленій ВАРТІ з iOS 16.4.</p> : !push.supported ? <p>Цей браузер не підтримує push-сповіщення. Спробуйте актуальний Safari, Chrome, Edge або Firefox.</p> : push.config === null ? <p>Перевіряємо доступність сповіщень…</p> : !push.config.enabled ? <p>{push.native ? 'Сповіщення в цій тестовій версії ще готуються. Актуальна ситуація доступна на карті.' : 'Сповіщення тимчасово недоступні. Встановити карту на головний екран можна вже зараз.'}</p> : push.permission === 'denied' ? <p>{push.native ? 'Сповіщення заблоковано. Натисніть кнопку, щоб перейти до системних налаштувань ВАРТИ.' : 'Сповіщення заблоковано. Дозвольте їх у налаштуваннях цього сайту в браузері.'}</p> : <p>Дозвіл на сповіщення запитаємо після натискання кнопки. Можна відписатися будь-коли.</p>}</div>
      <div className="modal-note"><Info size={18}/><p>Перевірка стану — щохвилини. Доставка залежить від мережі та налаштувань телефона. Сповіщення ВАРТИ не замінюють офіційні сигнали тривоги.</p></div>
    </section>
  </div>;
}
