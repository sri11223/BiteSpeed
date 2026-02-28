import { Header } from './components/Header';
import { IdentifyForm } from './components/IdentifyForm';
import { ResponseViewer } from './components/ResponseViewer';
import { RequestHistory } from './components/RequestHistory';
import { useIdentify } from './hooks/useIdentify';

function App() {
  const { identify, loading, response, error, history, clearHistory } = useIdentify();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero section */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Identity Reconciliation Tester
          </h2>
          <p className="mt-2 text-gray-500 max-w-2xl mx-auto">
            Test the <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-indigo-600">POST /identify</code> endpoint.
            Enter an email and/or phone number to see how contacts are linked together.
          </p>
        </div>

        {/* Main grid: 3-column on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Form + History */}
          <div className="lg:col-span-4 space-y-6">
            <IdentifyForm onSubmit={identify} loading={loading} />
            <RequestHistory
              history={history}
              onReplay={(req) => identify(req)}
              onClear={clearHistory}
            />
          </div>

          {/* Right: Response */}
          <div className="lg:col-span-8">
            <ResponseViewer response={response} error={error} />
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center text-sm text-gray-400">
          <p>
            Built with React + TypeScript + Tailwind CSS &bull;
            Backend: Express + Prisma + PostgreSQL &bull;
            <a href="/api-docs" target="_blank" className="text-indigo-500 hover:text-indigo-700 ml-1">
              API Docs
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
