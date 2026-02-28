import { Card, Badge, Button } from './ui';
import type { HistoryEntry, IdentifyRequest } from '../types';

interface RequestHistoryProps {
  history: HistoryEntry[];
  onReplay: (request: IdentifyRequest) => void;
  onClear: () => void;
}

export function RequestHistory({ history, onReplay, onClear }: RequestHistoryProps) {
  return (
    <Card
      title="Request History"
      subtitle={history.length > 0 ? `${history.length} request${history.length > 1 ? 's' : ''}` : undefined}
    >
      {history.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          <svg className="mx-auto h-10 w-10 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No requests yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onReplay(entry.request)}
                className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={entry.error ? 'danger' : 'success'}>
                    {entry.error ? 'Error' : `ID: ${entry.response?.contact.primaryContatctId}`}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  {entry.request.email && (
                    <div className="truncate">
                      <span className="text-gray-400">email:</span> {entry.request.email}
                    </div>
                  )}
                  {entry.request.phoneNumber && (
                    <div className="truncate">
                      <span className="text-gray-400">phone:</span> {entry.request.phoneNumber}
                    </div>
                  )}
                </div>
                <div className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                  Click to replay &rarr;
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Button variant="ghost" size="sm" onClick={onClear} className="w-full">
              Clear History
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
