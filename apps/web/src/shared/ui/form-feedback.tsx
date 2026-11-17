import type { ReactNode } from 'react';

type FormFeedbackProps = {
  message?: ReactNode;
  kind?: 'error' | 'success';
  id?: string;
};

export function FormFeedback({ message, kind = 'error', id }: FormFeedbackProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role={kind === 'error' ? 'alert' : 'status'}
      className={kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-foreground'}
    >
      {message}
    </p>
  );
}
