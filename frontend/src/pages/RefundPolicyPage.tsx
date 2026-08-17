import { Mail, ShieldCheck } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { contactDetails, refundSections } from '../data/site';

export function RefundPolicyPage() {
  return (
    <>
      <Seo
        title="Returns, Refunds & Workmanship Warranty"
        description="Read the A Star Customs policy for bespoke work, deposits, cancellations, refunds and the one-year workmanship warranty."
      />
      <PageHero
        eyebrow="Clear before the work begins"
        title="Returns, refunds & workmanship warranty."
        description="Please read this policy before ordering or approving custom work. It does not affect your statutory rights under UK consumer law."
        image="/images/site/gallery-steering-02.webp"
      />

      <section className="section policy-section">
        <div className="container policy-layout">
          <aside>
            <ShieldCheck aria-hidden="true" />
            <h2>One-year workmanship warranty</h2>
            <p>
              If an issue is confirmed to result from our workmanship, we will
              repair or correct it at no additional cost.
            </p>
            <a className="text-link" href={`mailto:${contactDetails.email}`}>
              <Mail aria-hidden="true" /> Ask a policy question
            </a>
          </aside>
          <div className="policy-content">
            <p className="policy-intro">
              By placing an order with A Star Customs, you agree to the terms below.
              Bespoke work is different from an off-the-shelf purchase, so timing,
              approval and material commitments matter.
            </p>
            {refundSections.map((section, index) => (
              <article key={section.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.items ? (
                    <ul>
                      {section.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

