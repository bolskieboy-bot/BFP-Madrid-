import { useEffect } from 'react';
import { Bell, X, ShieldAlert, Navigation } from 'lucide-react';
import { PushNotificationItem } from '../../types';

interface AndroidPushToastProps {
  notification: PushNotificationItem | null;
  onDismiss: () => void;
  onTap: (notification: PushNotificationItem) => void;
}

export default function AndroidPushToast({
  notification,
  onDismiss,
  onTap,
}: AndroidPushToastProps) {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-96 z-[700] animate-in slide-in-from-top-4 duration-300">
      <div
        onClick={() => onTap(notification)}
        className="bg-slate-900/95 backdrop-blur-md border-2 border-rose-500/80 rounded-2xl p-3.5 shadow-2xl text-slate-100 flex items-start gap-3 cursor-pointer hover:bg-slate-800 transition group"
      >
        <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg mt-0.5">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span className="font-bold text-rose-400 uppercase tracking-wider">
              MADRID EMERGENCY PUSH
            </span>
            <span className="font-mono">{notification.timestamp}</span>
          </div>
          <div className="text-xs font-black text-white truncate">{notification.title}</div>
          <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">{notification.body}</p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
