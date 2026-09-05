import { useCallback, useRef, useState } from "react";

import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../hooks/useAuth";
import { friendlyMessage } from "../../lib/errors";
import { reviewService } from "../../services/reviews";
import { uploadReviewPhoto } from "../../services/reviewImages";
import {
  MAX_REVIEW_PHOTOS,
  type ProductReview,
  type ProductReviewList,
} from "../../types/review";
import SmartImage from "../ui/SmartImage";
import StarRatingInput from "./StarRatingInput";
import StarRating from "./StarRating";

interface ProductReviewsProps {
  productSlug: string;
  productName: string;

  /** Called after a successful submission so the page can refresh totals. */
  onReviewPublished?: () => void;
}

const PAGE_SIZE = 5;

const MIN_BODY_LENGTH = 10;
const MAX_BODY_LENGTH = 4000;

interface FormState {
  rating: number;

  /*
   * Null means the customer has not typed in the field yet, so whatever the
   * account already holds is offered instead. An empty string is different:
   * it means they deliberately cleared it.
   */
  authorName: string | null;
  authorEmail: string | null;

  title: string;
  body: string;
}

const emptyForm: FormState = {
  rating: 0,
  authorName: null,
  authorEmail: null,
  title: "",
  body: "",
};

/** Reviews are shown by month and year, not to the minute. */
function formatReviewDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The reviews block on a product page: the aggregate score, the reviews
 * themselves, and the form to add one.
 *
 * Signing in is not required. That is a deliberate trade: it means the
 * form has to ask for a name and an email, and it means reviews are not
 * all tied to accounts, but requiring an account is the single largest
 * reason product reviews go unwritten. A signed-in customer gets their
 * details prefilled, a one-per-product limit, and a verified-purchase
 * badge the server works out from their orders.
 */
function ProductReviews({
  productSlug,
  productName,
  onReviewPublished,
}: ProductReviewsProps) {
  /*
   * Only used to prefill the form. Submitting does not require a session:
   * `apiClient` attaches the token when there is one, and the server treats
   * its absence as a guest review.
   */
  const { user } = useAuth();

  /*
   * Loaded through the shared hook, same as every other page in the app.
   * It handles aborting on unmount, discarding a superseded response, and
   * turning a failure into customer-safe wording.
   */
  const {
    data,
    isLoading,
    error: loadError,
    reload,
  } = useAsync<ProductReviewList>(
    useCallback(
      (signal: AbortSignal) =>
        reviewService.list(productSlug, { limit: 50, signal }),
      [productSlug],
    ),
    [productSlug],
    "Unable to load reviews just now.",
  );

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
   * What the shop already knows about a signed-in customer, so it need not
   * be retyped.
   *
   * Derived at render time rather than copied into state by an effect. The
   * session arrives after the first paint, and an effect that pushed it
   * into the form would either overwrite something the customer had already
   * started typing or need a flag to avoid doing so. Null in the form state
   * means "untouched", so the fallback applies until they type.
   */
  const suggestedName =
    (user?.user_metadata?.full_name as string | undefined) ?? "";

  const suggestedEmail = user?.email ?? "";

  const authorName = form.authorName ?? suggestedName;
  const authorEmail = form.authorEmail ?? suggestedEmail;

  const handleAddPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }

      const room = MAX_REVIEW_PHOTOS - photoUrls.length;

      if (room <= 0) {
        setFormError(
          `You can add up to ${MAX_REVIEW_PHOTOS} photos.`,
        );
        return;
      }

      setIsUploading(true);
      setFormError(null);

      try {
        /*
         * Sequential rather than parallel. These are phone photos on a
         * phone connection, and several large uploads at once tend to make
         * all of them slower and one of them fail.
         */
        const uploaded: string[] = [];

        for (const file of Array.from(files).slice(0, room)) {
          uploaded.push(await uploadReviewPhoto(file));
        }

        setPhotoUrls((current) => [...current, ...uploaded]);
      } catch (error) {
        setFormError(friendlyMessage(error, "Unable to upload that photo."));
      } finally {
        setIsUploading(false);

        /* Lets the same file be chosen again after a failure. */
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [photoUrls.length],
  );

  function validate(): string | null {
    if (form.rating < 1) {
      return "Please choose a star rating.";
    }

    if (authorName.trim().length < 2) {
      return "Please tell us your name.";
    }

    if (form.body.trim().length < MIN_BODY_LENGTH) {
      return `Please write at least ${MIN_BODY_LENGTH} characters about the piece.`;
    }

    return null;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const validationError = validate();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await reviewService.create(productSlug, {
        rating: form.rating,
        author_name: authorName.trim(),
        author_email: authorEmail.trim() || null,
        title: form.title.trim() || null,
        body: form.body.trim(),
        photo_urls: photoUrls,
      });

      setForm(emptyForm);
      setPhotoUrls([]);
      setIsFormOpen(false);
      setSuccessMessage("Thank you. Your review is now on this page.");

      /* Re-reads the list and the aggregate so the new review appears. */
      reload();

      onReviewPublished?.();
    } catch (error) {
      setFormError(
        friendlyMessage(error, "Unable to publish your review just now."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const summary = data?.summary ?? null;
  const reviews = data?.reviews ?? [];

  const visibleReviews = reviews.slice(0, visibleCount);

  const totalForBars = summary?.review_count ?? 0;

  return (
    <section
      aria-labelledby="product-reviews-heading"
      className="product-reviews"
    >
      <div className="product-reviews-head">
        <div>
          <p className="eyebrow">Reviews</p>

          <h2 className="product-reviews-title" id="product-reviews-heading">
            What buyers say
          </h2>
        </div>

        <button
          className="btn btn-outline"
          onClick={() => {
            setIsFormOpen((open) => !open);
            setSuccessMessage(null);
          }}
          type="button"
        >
          {isFormOpen ? "Close" : "Write a review"}
        </button>
      </div>

      {successMessage && (
        <p aria-live="polite" className="notice notice-success" role="status">
          {successMessage}
        </p>
      )}

      {/* ================= AGGREGATE ================= */}

      {summary && summary.review_count > 0 && (
        <div className="review-summary">
          <div className="review-summary-score">
            <span className="review-summary-value">
              {(summary.average_rating ?? 0).toFixed(1)}
            </span>

            <StarRating
              count={summary.review_count}
              value={summary.average_rating ?? 0}
            />
          </div>

          <ul className="review-bars">
            {/* Highest rating first, which is how people read these. */}
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.breakdown[String(star)] ?? 0;

              const percent =
                totalForBars > 0 ? (count / totalForBars) * 100 : 0;

              return (
                <li className="review-bar" key={star}>
                  <span className="review-bar-label">
                    {star} star{star === 1 ? "" : "s"}
                  </span>

                  <span
                    aria-hidden="true"
                    className="review-bar-track"
                  >
                    <span
                      className="review-bar-fill"
                      style={{ width: `${percent}%` }}
                    />
                  </span>

                  <span className="review-bar-count">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ================= FORM ================= */}

      {isFormOpen && (
        <form className="review-form" onSubmit={(e) => void handleSubmit(e)}>
          <p className="review-form-intro">
            Reviewing <strong>{productName}</strong>. No account needed.
          </p>

          <div className="review-form-field">
            <span className="field-label">Your rating</span>

            <StarRatingInput
              disabled={isSubmitting}
              onChange={(rating) =>
                setForm((current) => ({ ...current, rating }))
              }
              value={form.rating}
            />
          </div>

          <div className="review-form-field">
            <label className="field-label" htmlFor="review-title">
              Headline <span className="field-optional">(optional)</span>
            </label>

            <input
              id="review-title"
              maxLength={150}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Exactly as photographed"
              type="text"
              value={form.title}
            />
          </div>

          <div className="review-form-field">
            <label className="field-label" htmlFor="review-body">
              Your review
            </label>

            <textarea
              id="review-body"
              maxLength={MAX_BODY_LENGTH}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              placeholder="How does it look in your room? How was the delivery and the finish?"
              required
              rows={5}
              value={form.body}
            />

            <small className="review-form-counter">
              {form.body.trim().length} / {MAX_BODY_LENGTH}
            </small>
          </div>

          <div className="review-form-row">
            <div className="review-form-field">
              <label className="field-label" htmlFor="review-name">
                Name
              </label>

              <input
                autoComplete="name"
                id="review-name"
                maxLength={120}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    authorName: event.target.value,
                  }))
                }
                required
                type="text"
                value={authorName}
              />
            </div>

            <div className="review-form-field">
              <label className="field-label" htmlFor="review-email">
                Email <span className="field-optional">(optional)</span>
              </label>

              <input
                autoComplete="email"
                id="review-email"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    authorEmail: event.target.value,
                  }))
                }
                type="email"
                value={authorEmail}
              />

              {/*
                Stated plainly rather than buried, because people are
                reasonably wary of handing over an address to a review box.
              */}
              <small className="review-form-note">
                Never shown on this page. Only so we can reply if something
                is wrong.
              </small>
            </div>
          </div>

          {/* ---------- Photos ---------- */}

          <div className="review-form-field">
            <span className="field-label">
              Photos <span className="field-optional">(optional)</span>
            </span>

            {photoUrls.length > 0 && (
              <ul className="review-photo-list">
                {photoUrls.map((url) => (
                  <li className="review-photo" key={url}>
                    <SmartImage alt="" ratio="1 / 1" src={url} />

                    <button
                      aria-label="Remove this photo"
                      className="review-photo-remove"
                      onClick={() =>
                        setPhotoUrls((current) =>
                          current.filter((entry) => entry !== url),
                        )
                      }
                      type="button"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="review-photo-add">
              <input
                accept="image/*"
                disabled={
                  isUploading || photoUrls.length >= MAX_REVIEW_PHOTOS
                }
                multiple
                onChange={(event) => void handleAddPhotos(event.target.files)}
                ref={fileInputRef}
                type="file"
              />

              <span>
                {isUploading
                  ? "Uploading..."
                  : photoUrls.length >= MAX_REVIEW_PHOTOS
                    ? `Maximum ${MAX_REVIEW_PHOTOS} photos`
                    : "Add photos"}
              </span>
            </label>
          </div>

          {formError && (
            <p className="notice notice-error" role="alert">
              {formError}
            </p>
          )}

          <div className="review-form-actions">
            <button
              className="btn btn-primary"
              disabled={isSubmitting || isUploading}
              type="submit"
            >
              {isSubmitting ? "Publishing..." : "Publish review"}
            </button>

            <button
              className="btn-quiet"
              disabled={isSubmitting}
              onClick={() => {
                setIsFormOpen(false);
                setFormError(null);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ================= LIST ================= */}

      {isLoading && !data ? (
        <p className="muted-text">Loading reviews...</p>
      ) : loadError ? (
        <p className="notice notice-error">{loadError}</p>
      ) : reviews.length === 0 ? (
        <div className="review-empty">
          <p>No reviews yet for this piece.</p>

          {!isFormOpen && (
            <button
              className="btn-quiet"
              onClick={() => setIsFormOpen(true)}
              type="button"
            >
              Be the first to write one
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="review-list">
            {visibleReviews.map((review) => (
              <ReviewEntry key={review.id} review={review} />
            ))}
          </ul>

          {visibleCount < reviews.length && (
            <div className="review-list-more">
              <button
                className="btn btn-outline"
                onClick={() =>
                  setVisibleCount((count) => count + PAGE_SIZE)
                }
                type="button"
              >
                Show more reviews ({reviews.length - visibleCount} left)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** One review in the list. */
function ReviewEntry({ review }: { review: ProductReview }) {
  return (
    <li className="review-entry">
      <div className="review-entry-head">
        <span aria-hidden="true" className="review-entry-avatar">
          {review.author_name.charAt(0).toUpperCase()}
        </span>

        <div className="review-entry-meta">
          <p className="review-entry-name">
            {review.author_name}

            {review.is_verified_purchase && (
              <span className="review-entry-verified">Verified purchase</span>
            )}
          </p>

          <p className="review-entry-date">
            {formatReviewDate(review.created_at)}
          </p>
        </div>

        <StarRating value={review.rating} />
      </div>

      {review.title && <h3 className="review-entry-title">{review.title}</h3>}

      <p className="review-entry-body">{review.body}</p>

      {review.photo_urls.length > 0 && (
        <ul className="review-entry-photos">
          {review.photo_urls.map((url) => (
            <li key={url}>
              {/*
                Opens the full image in a new tab rather than in a lightbox.
                A customer photo is worth seeing at full size, and the
                browser's own viewer already does zoom and rotate properly.
              */}
              <a
                href={url}
                rel="noreferrer noopener"
                target="_blank"
                title="Open this photo full size"
              >
                <SmartImage
                  alt={`Photo from ${review.author_name}'s review`}
                  ratio="1 / 1"
                  src={url}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default ProductReviews;
