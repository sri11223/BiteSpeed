import { FormEvent, useState } from 'react';
import { Button, Input, Card } from './ui';
import type { IdentifyRequest } from '../types';

interface IdentifyFormProps {
  onSubmit: (data: IdentifyRequest) => Promise<unknown>;
  loading: boolean;
}

export function IdentifyForm({ onSubmit, loading }: IdentifyFormProps) {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!email.trim() && !phoneNumber.trim()) {
      setValidationError('Please provide at least an email or phone number');
      return;
    }

    await onSubmit({
      email: email.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
    });
  };

  const handleQuickFill = (preset: IdentifyRequest & { label?: string }) => {
    setEmail(preset.email || '');
    setPhoneNumber(preset.phoneNumber || '');
    setValidationError('');
  };

  return (
    <Card title="Identify Contact" subtitle="Enter email and/or phone to test the API">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="mcfly@hillvalley.edu"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setValidationError(''); }}
          hint="Optional if phone number is provided"
        />

        <Input
          label="Phone Number"
          type="text"
          placeholder="123456"
          value={phoneNumber}
          onChange={(e) => { setPhoneNumber(e.target.value); setValidationError(''); }}
          hint="Optional if email is provided"
        />

        {validationError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {validationError}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Identify
        </Button>
      </form>

      {/* Quick-fill presets */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Quick Test Presets
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { email: 'lorraine@hillvalley.edu', phoneNumber: '123456' },
            { email: 'mcfly@hillvalley.edu', phoneNumber: '123456' },
            { email: 'george@hillvalley.edu', phoneNumber: '717171' },
            { email: 'biffsucks@hillvalley.edu', phoneNumber: '919191' },
            { email: 'doc@hillvalley.edu', phoneNumber: '' },
            { email: '', phoneNumber: '123456' },
          ].map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleQuickFill(preset)}
              className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
            >
              {preset.email || '(no email)'} / {preset.phoneNumber || '(no phone)'}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
