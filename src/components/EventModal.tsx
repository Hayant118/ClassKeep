import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CalendarEvent } from '../types';

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayKey(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type EventPayload = Omit<CalendarEvent, 'id' | 'userId' | 'createdAt'>;

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: EventPayload) => void;
  onUpdate: (id: string, updates: Partial<CalendarEvent>) => void;
  onDelete: (id: string) => void;
  editingEvent?: CalendarEvent | null;
}

const TYPE_OPTIONS: { value: CalendarEvent['type']; label: string }[] = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'travel', label: 'Travel' },
  { value: 'event', label: 'Event' },
];

const COLOR_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  editingEvent,
}: EventModalProps) {
  const isEditing = !!editingEvent;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEvent['type']>('event');
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [color, setColor] = useState('#3b82f6');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingEvent) {
      setTitle(editingEvent.title);
      setType(editingEvent.type);
      setStartDate(editingEvent.startDate);
      setEndDate(editingEvent.endDate);
      setColor(editingEvent.color ?? '#3b82f6');
      setNotes(editingEvent.notes ?? '');
    } else {
      setTitle('');
      setType('event');
      setStartDate(todayKey());
      setEndDate(todayKey());
      setColor('#3b82f6');
      setNotes('');
    }
  }, [isOpen, editingEvent]);

  const handleTypeChange = (value: CalendarEvent['type']) => {
    setType(value);
    // Keep the range end in sync when it is still a single-day event.
    if (value !== type && endDate === startDate) {
      setEndDate(startDate);
    }
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate < value) setEndDate(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      toast.error('Please enter valid dates');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }

    const payload: EventPayload = {
      title: title.trim(),
      type,
      color: type === 'event' ? color : null,
      notes: notes.trim() || null,
      startDate,
      endDate,
    };

    try {
      if (editingEvent) {
        await onUpdate(editingEvent.id, payload);
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save event');
    }
  };

  const handleDelete = () => {
    if (!editingEvent) return;
    if (confirm('Delete this event?')) {
      onDelete(editingEvent.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National Day holiday"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as CalendarEvent['type'])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
          </div>

          {type === 'event' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">{isEditing ? 'Save Changes' : 'Add Event'}</button>
            {isEditing && <button type="button" onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">Delete</button>}
            <button type="button" onClick={onClose} className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
