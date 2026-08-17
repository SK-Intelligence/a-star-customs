import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo';

export function NotFoundPage() {
  return (
    <section className="not-found">
      <Seo title="Page Not Found" description="The page you requested could not be found." />
      <span>404</span>
      <p className="eyebrow">Wrong turn</p>
      <h1>This route isn’t in the build.</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <Link className="button button--primary" to="/"><ArrowLeft aria-hidden="true" /> Back home</Link>
    </section>
  );
}
