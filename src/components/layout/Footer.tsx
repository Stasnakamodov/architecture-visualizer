export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
            <span className="font-medium">Architecture Visualizer</span>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Built with{' '}
            <a
              href="https://reactflow.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              React Flow
            </a>{' '}
            |{' '}
            <a
              href="https://jsoncanvas.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              JSON Canvas
            </a>{' '}
            compatible
          </div>
        </div>
      </div>
    </footer>
  );
}
