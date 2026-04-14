import React, { useState, useEffect, useRef } from 'react';
import './StyledSelect.css';

/**
 * Кастомный выпадающий список: панель в DOM, полностью стилизуем (нативный select не даёт оформить список).
 */
const StyledSelect = ({
  id,
  className = '',
  triggerClassName = '',
  value,
  onChange,
  options = [],
  disabled = false,
  required = false,
  placeholder,
  'aria-label': ariaLabel
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const stringVal = value != null && value !== '' ? String(value) : '';
  const current = options.find((o) => String(o.value) === stringVal);
  const displayLabel =
    current?.label ??
    (stringVal === '' && placeholder ? placeholder : '—');

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`styled-select${open ? ' styled-select--open' : ''} ${className}`.trim()}
      data-required={required ? 'true' : undefined}
    >
      <button
        type="button"
        id={id}
        className={`styled-select__trigger ${triggerClassName}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="styled-select__value">{displayLabel}</span>
        <span className="styled-select__chevron" aria-hidden />
      </button>
      {open && (
        <ul
          className="styled-select__list"
          role="listbox"
          id={id ? `${id}-listbox` : undefined}
        >
          {options.map((o) => {
            const selected = String(o.value) === stringVal;
            return (
              <li
                key={String(o.value)}
                role="option"
                aria-selected={selected}
                className={
                  'styled-select__option' +
                  (selected ? ' styled-select__option--active' : '')
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(String(o.value));
                  setOpen(false);
                }}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default StyledSelect;
