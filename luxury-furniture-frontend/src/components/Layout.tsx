// import { Outlet } from "react-router-dom";

// import Header from "./Header";

// function Layout() {
//   return (
//     <>
//       <Header />
//       <Outlet />

//       <footer className="site-footer">
//         <p>© 2026 Royal Home Decor</p>
//         <p>Luxury furniture and décor for elegant homes.</p>
//       </footer>
//     </>
//   );
// }

// export default Layout;
import {
  Outlet,
  useLocation,
} from "react-router-dom";
import "../styles/StorefrontRefinements.css";
import "../styles/LuxuryPerformance.css";
import Header from "./Header";
import LuxuryExperience from "./luxury/LuxuryExperience";
import LuxuryFooter from "./luxury/LuxuryFooter";
import "./luxury/luxury-theme.css";

function Layout() {
  const location = useLocation();

  const isAdminPage =
    location.pathname.startsWith("/admin");

  return (
    <>
      {!isAdminPage && (
        <LuxuryExperience />
      )}

      <Header />

      <div
        className={
          isAdminPage
            ? undefined
            : "luxury-site"
        }
      >
        <Outlet />
      </div>

      {!isAdminPage && (
        <LuxuryFooter />
      )}
    </>
  );
}

export default Layout;