interface Props {
  message: string | null;
  onClose: () => void;
}

export default function ErrorBanner({ message, onClose }: Props) {
  if (!message) return null;

  return (
    <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded mb-6 animate-pulse" role="alert">
      <div className="flex items-center justify-between">
        <span className="block sm:inline font-medium">⚠ Connection Error:</span>
        <span className="block sm:inline ml-2">{message}</span>
        <button onClick={onClose} className="ml-4 text-red-600 dark:text-red-300 hover:text-red-800 font-bold" aria-label="Close">×</button>
      </div>
    </div>
  );
}
