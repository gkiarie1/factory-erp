import { PlantIcon, SafetyIcon, ConveyorIcon } from './FactoryIcons';
import React, { useEffect, useRef } from 'react';
import { FiArrowUpRight, FiCheck, FiX } from 'react-icons/fi';

export function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <span className="brand-mark">
        <PlantIcon />
      </span>
      <div>
        factory<span>CONTROL ROOM</span>
      </div>
    </div>
  );
}
export function Avatar({ name = '', size = '' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  const tone = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
  return (
    <span aria-hidden="true" className={`avatar tone-${tone} ${size}`}>
      {initials || 'FT'}
    </span>
  );
}
export function Field({ label, hint, ...props }) {
  return (
    <label>
      {label}
      <input {...props} />
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
export function Status({ value }) {
  const positive = ['Clocked In', 'approved', 'Active'].includes(value);
  const pending = value === 'pending';
  const negative = ['rejected', 'Inactive'].includes(value);
  return (
    <span
      className={`status ${positive ? 'positive' : pending ? 'pending' : negative ? 'negative' : ''}`}
    >
      <i />
      {value === 'Clocked In'
        ? 'On shift'
        : value === 'Not Clocked In'
          ? 'Off shift'
          : value}
    </span>
  );
}
export function Empty({ title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ConveyorIcon />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function PanelHeading({ title, subtitle, action }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stat({ label, value, hint, icon: Icon, tone = 'green' }) {
  return (
    <section className={`stat ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </section>
  );
}
export function ActionLink({ children, ...props }) {
  return (
    <button className="text-button" {...props}>
      {children}
      <FiArrowUpRight />
    </button>
  );
}
export function Modal({ title, children, onClose, busy }) {
  const ref = useRef(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const focusable = () =>
      Array.from(
        node.querySelectorAll('button:not(:disabled), input, textarea, select'),
      );
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    focusable()[0]?.focus();
    function keydown(event) {
      if (event.key === 'Escape' && !busyRef.current) onClose();
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    node.addEventListener('keydown', keydown);
    return () => {
      node.removeEventListener('keydown', keydown);
      document.body.style.overflow = originalOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">FACTORY OPERATIONS</p>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            disabled={busy}
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <FiX />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Feedback({ message, error = false, onClose }) {
  if (!message) return null;
  return (
    <div
      className={`notice ${error ? 'error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {error ? <SafetyIcon /> : <FiCheck />}
      <span>{message}</span>
      {onClose && (
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Dismiss message"
        >
          <FiX />
        </button>
      )}
    </div>
  );
}
export const shortDate = (value) =>
  new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
export function relativeTime(value) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value)) / 60000),
  );
  return minutes < 1
    ? 'Just now'
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
