import { Card, Badge } from './ui';
import type { IdentifyResponse } from '../types';

interface ResponseViewerProps {
  response: IdentifyResponse | null;
  error: string | null;
}

export function ResponseViewer({ response, error }: ResponseViewerProps) {
  if (error) {
    return (
      <Card title="Error" className="border-red-200">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </Card>
    );
  }

  if (!response) {
    return (
      <Card title="Response">
        <div className="text-center py-8 text-gray-400">
          <svg className="mx-auto h-12 w-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Submit a request to see the response</p>
        </div>
      </Card>
    );
  }

  const { contact } = response;

  return (
    <div className="space-y-4">
      {/* Visual Card */}
      <Card title="Contact Cluster">
        <div className="space-y-4">
          {/* Primary Contact */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">Primary Contact</span>
                <Badge variant="primary">ID: {contact.primaryContatctId}</Badge>
              </div>
            </div>
          </div>

          {/* Emails */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Emails</h4>
            <div className="flex flex-wrap gap-2">
              {contact.emails.length > 0 ? (
                contact.emails.map((email, i) => (
                  <Badge key={email} variant={i === 0 ? 'primary' : 'secondary'}>
                    {i === 0 && '★ '}{email}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-gray-400 italic">None</span>
              )}
            </div>
          </div>

          {/* Phone Numbers */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Phone Numbers</h4>
            <div className="flex flex-wrap gap-2">
              {contact.phoneNumbers.length > 0 ? (
                contact.phoneNumbers.map((phone, i) => (
                  <Badge key={phone} variant={i === 0 ? 'info' : 'secondary'}>
                    {i === 0 && '★ '}{phone}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-gray-400 italic">None</span>
              )}
            </div>
          </div>

          {/* Secondary IDs */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Secondary Contact IDs</h4>
            <div className="flex flex-wrap gap-2">
              {contact.secondaryContactIds.length > 0 ? (
                contact.secondaryContactIds.map((id) => (
                  <Badge key={id} variant="warning">#{id}</Badge>
                ))
              ) : (
                <span className="text-sm text-gray-400 italic">No secondaries</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Contact Graph Visualization */}
      <ContactGraph contact={contact} />

      {/* Raw JSON */}
      <Card title="Raw JSON Response">
        <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 overflow-x-auto font-mono leading-relaxed">
          {JSON.stringify(response, null, 2)}
        </pre>
      </Card>
    </div>
  );
}

/** Simple SVG visualization of the contact cluster */
function ContactGraph({ contact }: { contact: IdentifyResponse['contact'] }) {
  const secondaries = contact.secondaryContactIds;
  const totalNodes = 1 + secondaries.length;
  const svgWidth = Math.max(400, totalNodes * 140);
  const svgHeight = secondaries.length > 0 ? 200 : 100;

  const primaryX = svgWidth / 2;
  const primaryY = 45;
  const secondaryY = 150;

  const secondaryPositions = secondaries.map((_, i) => {
    const spacing = svgWidth / (secondaries.length + 1);
    return { x: spacing * (i + 1), y: secondaryY };
  });

  return (
    <Card title="Link Visualization">
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="mx-auto">
          {/* Lines from primary to secondaries */}
          {secondaryPositions.map((pos, i) => (
            <line
              key={`line-${i}`}
              x1={primaryX}
              y1={primaryY + 20}
              x2={pos.x}
              y2={pos.y - 20}
              stroke="#a5b4fc"
              strokeWidth={2}
              strokeDasharray="6,3"
            />
          ))}

          {/* Primary node */}
          <g>
            <circle cx={primaryX} cy={primaryY} r={24} fill="#4f46e5" />
            <text x={primaryX} y={primaryY + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={11} fontWeight="bold">
              #{contact.primaryContatctId}
            </text>
            <text x={primaryX} y={primaryY - 36} textAnchor="middle" fill="#4f46e5" fontSize={11} fontWeight={600}>
              Primary
            </text>
          </g>

          {/* Secondary nodes */}
          {secondaryPositions.map((pos, i) => (
            <g key={`node-${i}`}>
              <circle cx={pos.x} cy={pos.y} r={20} fill="#fbbf24" />
              <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fill="#78350f" fontSize={11} fontWeight="bold">
                #{secondaries[i]}
              </text>
              <text x={pos.x} y={pos.y + 34} textAnchor="middle" fill="#92400e" fontSize={10}>
                Secondary
              </text>
            </g>
          ))}

          {/* No secondaries message */}
          {secondaries.length === 0 && (
            <text x={primaryX} y={primaryY + 40} textAnchor="middle" fill="#9ca3af" fontSize={12}>
              No secondary contacts linked
            </text>
          )}
        </svg>
      </div>
    </Card>
  );
}
