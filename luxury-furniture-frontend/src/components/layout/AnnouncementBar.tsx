const ANNOUNCEMENTS = [
  "Secure online payment",
  "Free shipping over \u20B9500",
  "3-day easy returns",
  "Handmade by Indian artisans",
];

/**
 * Slim promise bar above the header.
 *
 * On wide screens all four promises sit side by side. On narrow screens
 * they become a CSS-only marquee, so there is no JS timer running.
 */
function AnnouncementBar() {
  return (
    <div className="announcement-bar">
      <div className="announcement-viewport">
        <ul className="announcement-list">
          {ANNOUNCEMENTS.map((item) => (
            <li key={item}>
              <span aria-hidden="true" className="announcement-dot" />
              {item}
            </li>
          ))}
        </ul>

        {/* Duplicated for a seamless marquee loop; hidden from AT. */}
        <ul aria-hidden="true" className="announcement-list is-clone">
          {ANNOUNCEMENTS.map((item) => (
            <li key={item}>
              <span className="announcement-dot" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default AnnouncementBar;
