import { WifiOff, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react';
import { IncidentReport } from '../../types';
import { createDirectSmsUri, getStationRecipient } from '../../services/smsService';

interface OfflineBannerProps {
  isOnline: boolean;
  queuedCount: number;
  onSyncQueue: () => void;
  isSyncing: boolean;
  lastQueuedReport?: IncidentReport | null;
}

export default function OfflineBanner({
  isOnline,
  queuedCount,
  onSyncQueue,
  isSyncing,
  lastQueuedReport,
}: OfflineBannerProps) {
  if (isOnline && queuedCount === 0) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-lg z-50">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>OFFLINE ACCESS ACTIVE: Limited signal in Madrid. Distress reports will queue locally & offer direct SMS.</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Back Online! {queuedCount} offline emergency report(s) ready to sync.</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {queuedCount > 0 && isOnline && (
          <button
            onClick={onSyncQueue}
            disabled={isSyncing}
            className="bg-slate-950 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 hover:bg-slate-900 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync {queuedCount} Incident(s)</span>
          </button>
        )}

        {lastQueuedReport && !isOnline && (
          <a
            href={createDirectSmsUri(
              getStationRecipient(lastQueuedReport.category).phone,
              `OFFLINE EMERGENCY SOS [${lastQueuedReport.incidentNumber}]: ${lastQueuedReport.category.toUpperCase()} at Brgy ${lastQueuedReport.location.barangay} Madrid SDS.`
            )}
            className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 shadow"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Send Queued Alert via SMS</span>
          </a>
        )}
      </div>
    </div>
  );
}
