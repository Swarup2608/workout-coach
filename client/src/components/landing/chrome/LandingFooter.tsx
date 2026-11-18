import Link from "next/link";
import { Logo } from "@/components/Logo";

export function LandingFooter() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo size={28} />
          <span className="muted">© {new Date().getFullYear()} StarkFitIQ</span>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="#top">Privacy</a>
          <a href="#top">Terms</a>
          <a href="#top">Contact</a>
          <Link href="/login">Log in</Link>
        </nav>
        <p className="credits muted">Photos: Unsplash</p>
      </div>
      <div className="footer-giant disp" aria-hidden="true">
        StarkFitIQ
      </div>
    </footer>
  );
}
