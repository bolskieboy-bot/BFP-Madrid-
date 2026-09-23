import { useState, useEffect } from 'react';
import { Bell, X, Check, Flame, Car, HeartPulse, ExternalLink } from 'lucide-react';
import { PushNotificationItem } from '../../types';

interface PushNotificationsTrayProps {
  notifications: PushNotificationItem[];
  onMarkAllRead: () => void;
  onSelectNotification: (item: PushNotificationItem) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function PushNotificationsTray({
  notifications,
  onMarkAllRead,
  onSelectNotification,
  isOpen,
  onClose,
}: PushNotificationsTrayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[650] flex justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-sm bg-slate-900 border-l border-slate-700/80 h-full flex flex-col text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="font-black text-sm text-white">PUSH NOTIFICATIONS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
            >
              Mark read
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No new alerts or status updates.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectNotification(item);
                  onClose();
                }}
                className={`p-3 rounded-2xl border transition cursor-pointer text-left ${
                  item.read
                    ? 'border-slate-800 bg-slate-950/40 opacity-70'
                    : 'border-amber-500/60 bg-amber-950/30 shadow-md'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-white flex items-center gap-1">
                    {!item.read && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>}
                    {item.title}
                  </span>
                  <span className="font-mono text-slate-400 text-[10px]">{item.timestamp}</span>
                </div>
                <p className="text-xs text-slate-300">{item.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
