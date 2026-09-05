import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import { formatPrice } from "../../lib/currency";
import { loadProducts } from "../../services/catalogueCache";
import type { Product } from "../../types/product";
import SmartImage from "../ui/SmartImage";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 260;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 6;

const SUGGESTIONS = [
  "Marble coffee table",
  "Wall mirror",
  "Metal wall art",
  "Nesting tables",
  "Epoxy resin",
];

/**
 * Search dialog backed by the API's `search` parameter, which matches
 * name, short description, material, colour and style.
 */
function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTerm = term.trim();
  const isQueryReady = trimmedTerm.length >= MIN_QUERY_LENGTH;

  /* Focus the field and lock page scroll while the dialog is open. */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.body.dataset.scrollLocked = "true";

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      delete document.body.dataset.scrollLocked;
    };
  }, [isOpen, onClose]);

  /* Reset when the dialog closes so it always opens clean. */
  useEffect(() => {
    if (!isOpen) {
      setTerm("");
      setResults([]);
      setError(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  /* Debounced search. Each run aborts the previous one. */
  useEffect(() => {
    if (!isOpen || !isQueryReady) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;

    setIsSearching(true);
    setError(null);

    const timer = window.setTimeout(() => {
      loadProducts(
        { search: trimmedTerm, limit: RESULT_LIMIT },
        controller.signal,
      )
        .then((products) => {
          if (isCurrent) {
            setResults(products);
          }
        })
        .catch((requestError: unknown) => {
          if (
            !isCurrent ||
            (requestError instanceof DOMException &&
              requestError.name === "AbortError")
          ) {
            return;
          }

          setError(
            requestError instanceof Error
              ? requestError.message
              : "Search is unavailable right now.",
          );
        })
        .finally(() => {
          if (isCurrent) {
            setIsSearching(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isOpen, isQueryReady, trimmedTerm]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!isQueryReady) {
        return;
      }

      navigate(`/shop?search=${encodeURIComponent(trimmedTerm)}`);
      onClose();
    },
    [isQueryReady, navigate, onClose, trimmedTerm],
  );

  const status = useMemo(() => {
    if (!isQueryReady) {
      return `Type at least ${MIN_QUERY_LENGTH} characters.`;
    }

    if (isSearching) {
      return "Searching...";
    }

    if (results.length === 0) {
      return `No pieces match "${trimmedTerm}".`;
    }

    return `${results.length} match${results.length === 1 ? "" : "es"}`;
  }, [isQueryReady, isSearching, results.length, trimmedTerm]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="search-overlay">
      <button
        aria-label="Close search"
        className="search-overlay-backdrop"
        onClick={onClose}
        type="button"
      />

      <div
        aria-label="Search products"
        aria-modal="true"
        className="search-panel"
        role="dialog"
      >
        <form className="search-form" onSubmit={handleSubmit}>
          <svg
            aria-hidden="true"
            className="search-form-icon"
            fill="none"
            height="19"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
            width="19"
          >
            <circle cx="11" cy="11" r="7.5" />
            <path d="M20 20l-4-4" />
          </svg>

          <input
            aria-label="Search products"
            className="search-input"
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search marble tables, mirrors, wall art..."
            ref={inputRef}
            type="search"
            value={term}
          />

          <button
            aria-label="Close search"
            className="search-close"
            onClick={onClose}
            type="button"
          >
            Esc
          </button>
        </form>

        <div className="search-body">
          {!isQueryReady && (
            <div className="search-suggestions">
              <p className="eyebrow">Popular searches</p>

              <div className="search-suggestion-chips">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    className="search-chip"
                    key={suggestion}
                    onClick={() => setTerm(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p aria-live="polite" className="search-status">
            {error ?? status}
          </p>

          {results.length > 0 && (
            <ul className="search-results">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    className="search-result"
                    onClick={onClose}
                    to={`/products/${product.slug}`}
                  >
                    <SmartImage
                      alt={product.name}
                      className="search-result-image"
                      ratio="1 / 1"
                      src={product.thumbnail_url}
                    />

                    <span className="search-result-body">
                      <span className="search-result-name">
                        {product.name}
                      </span>

                      <span className="search-result-price">
                        {formatPrice(product.base_price_paise)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {isQueryReady && results.length > 0 && (
            <button
              className="btn btn-outline btn-block"
              onClick={() => {
                navigate(`/shop?search=${encodeURIComponent(trimmedTerm)}`);
                onClose();
              }}
              type="button"
            >
              See all results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchOverlay;
