import { Link } from "react-router-dom";

import "./auth/auth.css";

function NotFoundPage() {
  return (
    <div className="shell not-found page-enter">
      <p className="not-found-code">404</p>

      <h1>We could not find that page</h1>

      <p>
        The link may be out of date, or the piece you were looking for is no
        longer listed.
      </p>

      <div className="not-found-actions">
        <Link className="btn btn-primary" to="/">
          Back to home
        </Link>

        <Link className="btn btn-outline" to="/shop">
          Browse the collection
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
