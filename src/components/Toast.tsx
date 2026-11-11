import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<(message: string, action?: ToastItem['action']) => void>(() => {});

/** Petites confirmations en bas d'écran, avec « Annuler » quand l'action est réversible. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, action?: ToastItem['action']) => {
      const id = ++next.current;
      setToasts((t) => [...t.slice(-2), { id, message, action }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts no-print" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span className="toast-icon"><Icon name="check" size={14} /></span>
            <span>{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
