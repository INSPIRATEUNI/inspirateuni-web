/** Mensaje de error bajo un control; enlázalo con aria-describedby={id}. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm font-semibold text-magenta-deep">
      {message}
    </p>
  );
}
