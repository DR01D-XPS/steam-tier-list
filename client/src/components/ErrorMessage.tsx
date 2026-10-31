import { X } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
}

export default function ErrorMessage({ message, onClose }: ErrorMessageProps) {
  return (
    <div className="errorMessage" role="alert">
      <div>
        <strong>Не получилось загрузить данные</strong>
        <p>{message}</p>
      </div>
      {onClose ? (
        <button className="iconButton" type="button" onClick={onClose} aria-label="Закрыть ошибку">
          <X size={18} />
        </button>
      ) : null}
    </div>
  );
}
