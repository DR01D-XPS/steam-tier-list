interface LoaderProps {
  label?: string;
}

export default function Loader({ label = "Загружаю игры..." }: LoaderProps) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="loaderRing" />
      <span>{label}</span>
    </div>
  );
}
