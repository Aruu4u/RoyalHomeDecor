import { useCallback, useId, useRef, useState } from "react";

import {
  ACCEPTED_IMAGE_TYPES,
  validateOfferImage,
} from "../../services/offerImages";

interface ImageDropzoneProps {
  /** Current image, shown as a preview when present. */
  value: string | null;

  onUpload: (file: File) => Promise<void>;
  onClear: () => void;

  label?: string;
  hint?: string;
  isBusy?: boolean;
}

/**
 * Drag-and-drop image picker.
 *
 * Also works as a plain click-to-browse control and is reachable by
 * keyboard, because drag and drop alone excludes anyone using a
 * keyboard, a screen reader or a touch device. The visible drop area is
 * a label bound to a hidden file input, which gets that behaviour from
 * the browser rather than from custom key handling.
 */
function ImageDropzone({
  value,
  onUpload,
  onClear,
  label = "Background image",
  hint = "Drag an image here, or click to choose one. JPG, PNG, WebP or AVIF, up to 5 MB.",
  isBusy = false,
}: ImageDropzoneProps) {
  const inputId = useId();

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * dragenter and dragleave fire for every child element, so a simple
   * boolean flickers. Counting entries and exits is what keeps the
   * highlight stable while moving across the drop area.
   */
  const dragDepth = useRef(0);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) {
        return;
      }

      const validationError = validateOfferImage(file);

      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);

      try {
        await onUpload(file);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "That image could not be uploaded.",
        );
      }
    },
    [onUpload],
  );

  return (
    <div className="dropzone-field">
      <span className="dropzone-label">{label}</span>

      {value ? (
        <div className="dropzone-preview">
          <img alt="Selected background" src={value} />

          <div className="dropzone-preview-actions">
            <label className="dropzone-replace" htmlFor={inputId}>
              Replace
            </label>

            <button
              className="admin-delete-button"
              disabled={isBusy}
              onClick={() => {
                setError(null);
                onClear();
              }}
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          className={[
            "dropzone",
            isDragging ? "is-dragging" : "",
            isBusy ? "is-busy" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          htmlFor={inputId}
          onDragEnter={(event) => {
            event.preventDefault();
            dragDepth.current += 1;
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current -= 1;

            if (dragDepth.current <= 0) {
              dragDepth.current = 0;
              setIsDragging(false);
            }
          }}
          /* Without preventDefault the browser navigates to the file. */
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            dragDepth.current = 0;
            setIsDragging(false);

            void handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          <span aria-hidden="true" className="dropzone-icon">
            <svg
              fill="none"
              height="26"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              width="26"
            >
              <path d="M12 16V4" />
              <path d="M7.5 8.5 12 4l4.5 4.5" />
              <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
            </svg>
          </span>

          <span className="dropzone-text">
            {isBusy ? "Uploading..." : "Drag an image here"}
          </span>

          <span className="dropzone-hint">{hint}</span>
        </label>
      )}

      <input
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="dropzone-input"
        disabled={isBusy}
        id={inputId}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          /* Reset so choosing the same file twice still fires change. */
          event.currentTarget.value = "";

          void handleFile(file);
        }}
        type="file"
      />

      {error && <p className="dropzone-error">{error}</p>}
    </div>
  );
}

export default ImageDropzone;
