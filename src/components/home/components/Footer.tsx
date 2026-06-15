/* =========================================================
   FOOTER - verbatim from home.app.jsx
   ========================================================= */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-copy">© {new Date().getFullYear()} Muhammad Saad - Automation &amp; Software Developer. Hand-built with vanilla CSS.
          <span className="react-badge" title="This homepage is a React 19 single-page app (bundled with Vite)">⚛ Built with React 19</span>
        </div>
        <div className="footer-links">
          <a href="mailto:saad@saadm.dev">Email</a>
          <a href="https://www.linkedin.com/in/muhammadsaad435/" target="_blank" rel="noopener">LinkedIn</a>
          <a href="https://github.com/saad-mughal435" target="_blank" rel="noopener">GitHub</a>
          <a href="notes/">Notes</a>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
