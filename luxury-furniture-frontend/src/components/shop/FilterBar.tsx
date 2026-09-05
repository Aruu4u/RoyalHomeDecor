import type { Collection } from "../../types/collection";

export interface FilterValues {
  collectionId: string | null;
  topMaterial: string | null;
  baseMaterial: string | null;
  finish: string | null;
  colour: string | null;
  style: string | null;
  search: string | null;
  recommendedOnly: boolean;

  /** Only pieces discounted right now. Expired offers do not count. */
  inOfferOnly: boolean;

  sort: string;
}

interface FilterBarProps {
  /** Omitted when browsing a single collection, where it is redundant. */
  collections: Collection[] | null;
  showCollectionFilter: boolean;

  topMaterials: string[];
  baseMaterials: string[];
  finishes: string[];
  colours: string[];
  styles: string[];

  sortLabels: Record<string, string>;

  values: FilterValues;
  resultCount: number;
  isIndicative: boolean;

  onChange: (key: string, value: string | null) => void;
  onClear: () => void;
}

interface Chip {
  key: string;
  label: string;
  value: string;
}

/** Builds the removable chips for whatever is currently narrowing results. */
function buildChips(
  values: FilterValues,
  collections: Collection[] | null,
  showCollectionFilter: boolean,
): Chip[] {
  const chips: Chip[] = [];

  if (showCollectionFilter && values.collectionId) {
    const collection = (collections ?? []).find(
      (candidate) => candidate.id === values.collectionId,
    );

    chips.push({
      key: "collection",
      label: "Collection",
      value: collection?.name ?? "Selected",
    });
  }

  if (values.topMaterial) {
    chips.push({
      key: "top_material",
      label: "Top material",
      value: values.topMaterial,
    });
  }

  if (values.baseMaterial) {
    chips.push({
      key: "base_material",
      label: "Base material",
      value: values.baseMaterial,
    });
  }

  if (values.finish) {
    chips.push({ key: "finish", label: "Finish", value: values.finish });
  }

  if (values.colour) {
    chips.push({ key: "colour", label: "Colour", value: values.colour });
  }

  if (values.style) {
    chips.push({ key: "style", label: "Style", value: values.style });
  }

  if (values.search) {
    chips.push({ key: "search", label: "Search", value: values.search });
  }

  if (values.recommendedOnly) {
    chips.push({ key: "recommended", label: "Showing", value: "Recommended only" });
  }

  if (values.inOfferOnly) {
    chips.push({ key: "offers", label: "Showing", value: "On offer only" });
  }

  return chips;
}

/**
 * Filter and sort controls for the catalogue.
 *
 * Fixed in place at the top of the results. It deliberately does not
 * follow the scroll: a translucent bar tracking down the page sat over
 * the product grid and made card titles read through it.
 */
function FilterBar({
  collections,
  showCollectionFilter,
  topMaterials,
  baseMaterials,
  finishes,
  colours,
  styles,
  sortLabels,
  values,
  resultCount,
  isIndicative,
  onChange,
  onClear,
}: FilterBarProps) {
  const chips = buildChips(values, collections, showCollectionFilter);

  /*
   * Each select is rendered from this list so they stay consistent.
   *
   * A facet with only one distinct value is left out: offering "Any
   * material" alongside a single option narrows nothing and just adds a
   * control to scan past.
   */
  const selects = [
    showCollectionFilter
      ? {
          key: "collection",
          label: "Collection",
          placeholder: "All collections",
          value: values.collectionId ?? "",
          options: (collections ?? []).map((collection) => ({
            value: collection.id,
            label: collection.name,
          })),
        }
      : null,
    topMaterials.length > 1
      ? {
          key: "top_material",
          label: "Top material",
          placeholder: "Any top material",
          value: values.topMaterial ?? "",
          options: topMaterials.map((item) => ({ value: item, label: item })),
        }
      : null,
    baseMaterials.length > 1
      ? {
          key: "base_material",
          label: "Base material",
          placeholder: "Any base material",
          value: values.baseMaterial ?? "",
          options: baseMaterials.map((item) => ({ value: item, label: item })),
        }
      : null,
    finishes.length > 1
      ? {
          key: "finish",
          label: "Finish",
          placeholder: "Any finish",
          value: values.finish ?? "",
          options: finishes.map((item) => ({ value: item, label: item })),
        }
      : null,
    colours.length > 1
      ? {
          key: "colour",
          label: "Colour",
          placeholder: "Any colour",
          value: values.colour ?? "",
          options: colours.map((item) => ({ value: item, label: item })),
        }
      : null,
    styles.length > 1
      ? {
          key: "style",
          label: "Style",
          placeholder: "Any style",
          value: values.style ?? "",
          options: styles.map((item) => ({ value: item, label: item })),
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    placeholder: string;
    value: string;
    options: Array<{ value: string; label: string }>;
  }>;

  return (
    <section aria-label="Filter and sort" className="filter-bar">
      <div className="filter-bar-head">
          <div className="filter-bar-heading">
            <span aria-hidden="true" className="filter-bar-icon">
              <svg
                fill="none"
                height="15"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.7"
                viewBox="0 0 16 16"
                width="15"
              >
                <path d="M2 4h12M4.5 8h7M6.5 12h3" />
              </svg>
            </span>

            <p className="filter-bar-title">Refine</p>

            <span className="filter-bar-count">
              {resultCount} piece{resultCount === 1 ? "" : "s"}
              {isIndicative ? "+" : ""}
            </span>
          </div>

          <div className="filter-bar-actions">
            {/*
              Switches rather than checkboxes: both are modes that change
              what the grid contains, not attributes of a single piece.
            */}
            <button
              aria-pressed={values.inOfferOnly}
              className={
                values.inOfferOnly
                  ? "filter-switch is-offer is-on"
                  : "filter-switch is-offer"
              }
              onClick={() =>
                onChange("offers", values.inOfferOnly ? null : "true")
              }
              type="button"
            >
              <span aria-hidden="true" className="filter-switch-track">
                <span className="filter-switch-knob" />
              </span>
              On offer only
            </button>

            <button
              aria-pressed={values.recommendedOnly}
              className={
                values.recommendedOnly
                  ? "filter-switch is-on"
                  : "filter-switch"
              }
              onClick={() =>
                onChange("recommended", values.recommendedOnly ? null : "true")
              }
              type="button"
            >
              <span aria-hidden="true" className="filter-switch-track">
                <span className="filter-switch-knob" />
              </span>
              Recommended only
            </button>

            <button
              className={
                chips.length > 0
                  ? "filter-clear is-visible"
                  : "filter-clear"
              }
              disabled={chips.length === 0}
              onClick={onClear}
              type="button"
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="filter-bar-fields">
          {selects.map((select, index) => (
            <label
              className="filter-field"
              key={select.key}
              /* Staggered entrance so the row assembles rather than snaps. */
              style={{ ["--field-delay" as string]: `${index * 45}ms` }}
            >
              <span className="filter-field-label">{select.label}</span>

              <span className="filter-field-control">
                <select
                  onChange={(event) =>
                    onChange(select.key, event.target.value || null)
                  }
                  value={select.value}
                >
                  <option value="">{select.placeholder}</option>

                  {select.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <svg
                  aria-hidden="true"
                  className="filter-field-chevron"
                  fill="none"
                  height="7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                  viewBox="0 0 11 7"
                  width="11"
                >
                  <path d="M1 1l4.5 4.5L10 1" />
                </svg>
              </span>
            </label>
          ))}

          <label
            className="filter-field is-sort"
            style={{
              ["--field-delay" as string]: `${selects.length * 45}ms`,
            }}
          >
            <span className="filter-field-label">Sort by</span>

            <span className="filter-field-control">
              <select
                onChange={(event) =>
                  onChange(
                    "sort",
                    event.target.value === "curated" ? null : event.target.value,
                  )
                }
                value={values.sort}
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <svg
                aria-hidden="true"
                className="filter-field-chevron"
                fill="none"
                height="7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
                viewBox="0 0 11 7"
                width="11"
              >
                <path d="M1 1l4.5 4.5L10 1" />
              </svg>
            </span>
          </label>
        </div>

        {chips.length > 0 && (
          <ul className="filter-chips">
            {chips.map((chip, index) => (
              <li
                className="filter-chip"
                key={chip.key}
                style={{ ["--chip-delay" as string]: `${index * 40}ms` }}
              >
                <span className="filter-chip-label">{chip.label}</span>
                <span className="filter-chip-value">{chip.value}</span>

                <button
                  aria-label={`Remove ${chip.label} filter`}
                  className="filter-chip-remove"
                  onClick={() => onChange(chip.key, null)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.9"
                    viewBox="0 0 10 10"
                    width="9"
                  >
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

export default FilterBar;
