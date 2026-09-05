import { useId, useState } from "react";

export interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];

  /** Index open on first render, or null for all closed. */
  defaultOpenIndex?: number | null;
}

/**
 * Single-open accordion.
 *
 * The panel animates with grid-template-rows rather than max-height so
 * the transition is smooth regardless of content length, and it collapses
 * to exactly the right size without magic numbers.
 */
function Accordion({ items, defaultOpenIndex = 0 }: AccordionProps) {
  const baseId = useId();

  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  return (
    <div className="accordion">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <div
            className={isOpen ? "accordion-item is-open" : "accordion-item"}
            key={item.question}
          >
            <h3 className="accordion-heading">
              <button
                aria-controls={panelId}
                aria-expanded={isOpen}
                className="accordion-trigger"
                id={buttonId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                type="button"
              >
                <span>{item.question}</span>

                <span aria-hidden="true" className="accordion-icon">
                  <svg
                    fill="none"
                    height="14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                    viewBox="0 0 14 14"
                    width="14"
                  >
                    <path d="M1 7h12" />
                    <path className="accordion-icon-bar" d="M7 1v12" />
                  </svg>
                </span>
              </button>
            </h3>

            <div
              aria-labelledby={buttonId}
              className="accordion-panel"
              id={panelId}
              role="region"
            >
              <div className="accordion-panel-inner">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Accordion;
