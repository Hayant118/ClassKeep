// src/components/TimePicker.tsx
import { useEffect, useRef, useState } from 'react';

interface TimePickerProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  quickPicks?: string[]; // e.g. ['18:30', '19:30', '20:00']
  minuteStep?: number; // wheel step, default 5
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const ROW = 40; // px height of one wheel row

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Accepts "1830", "18:30", "6:30", "18.30", "9" and returns "HH:mm" or null. */
function parseTyped(raw: string): string | null {
  const s = raw.trim().replace(/[.\s]/g, ':');
  let h: number;
  let m: number;
  if (s.includes(':')) {
    const [hs, ms = '0'] = s.split(':');
    h = parseInt(hs, 10);
    m = parseInt(ms, 10);
  } else if (/^\d{3,4}$/.test(s)) {
    h = parseInt(s.slice(0, -2), 10);
    m = parseInt(s.slice(-2), 10);
  } else if (/^\d{1,2}$/.test(s)) {
    h = parseInt(s, 10);
    m = 0;
  } else {
    return null;
  }
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

function Wheel({
  items,
  selected,
  onSelect,
}: {
  items: number[];
  selected: number;
  onSelect: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Scroll to the selected item when the wheel opens or the value changes from outside.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, items.indexOf(selected));
    el.scrollTop = idx * ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handleScroll = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (items[idx] !== selected) onSelect(items[idx]);
    }, 80);
  };

  return (
    <div style={{ position: 'relative', height: ROW * 5, width: 72 }}>
      {/* highlight band */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: ROW * 2,
          height: ROW,
          borderRadius: 10,
          background: 'rgba(99,102,241,0.25)',
          border: '1px solid #6366f1',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          paddingTop: ROW * 2,
          paddingBottom: ROW * 2,
          boxSizing: 'content-box',
        }}
      >
        {items.map((n) => (
          <div
            key={n}
            onClick={() => onSelect(n)}
            style={{
              height: ROW,
              lineHeight: `${ROW}px`,
              textAlign: 'center',
              scrollSnapAlign: 'center',
              fontSize: 20,
              fontWeight: n === selected ? 700 : 400,
              color: n === selected ? '#ffffff' : '#94a3b8',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {pad(n)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimePicker({
  value,
  onChange,
  quickPicks,
  minuteStep = 5,
  disabled,
  className,
  'aria-label': ariaLabel,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);

  // Keep the text box in sync when the value changes from outside (wheel, chips, reset).
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);

  const [hStr, mStr] = (value || '08:00').split(':');
  const hour = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
  // If the current minute isn't on the step grid (e.g. typed 18:32), include it so it can display.
  if (!minutes.includes(minute)) minutes.push(minute);
  minutes.sort((a, b) => a - b);

  const commitTyped = () => {
    const parsed = parseTyped(text);
    if (parsed) {
      setInvalid(false);
      setText(parsed);
      if (parsed !== value) onChange(parsed);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel ?? 'Time'}
          placeholder="HH:mm"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTyped();
            }
          }}
          className="w-full rounded-lg border bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ borderColor: invalid ? '#ef4444' : undefined }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-label="Open time wheel"
          className="px-3 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 text-sm"
        >
          🕒
        </button>
      </div>

      {quickPicks && quickPicks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {quickPicks.map((q) => (
            <button
              key={q}
              type="button"
              disabled={disabled}
              onClick={() => onChange(q)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                q === value
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-400'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          style={{
            marginTop: 8,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <Wheel items={hours} selected={hour} onSelect={(h) => onChange(`${pad(h)}:${pad(minute)}`)} />
            <span style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>:</span>
            <Wheel items={minutes} selected={minute} onSelect={(m) => onChange(`${pad(hour)}:${pad(m)}`)} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}