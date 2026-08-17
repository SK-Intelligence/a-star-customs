import { Mail, ShieldCheck } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { Seo } from '../components/Seo';
import { contactDetails } from '../data/site';

export function PrivacyPage() {
  return (
    <>
      <Seo
        title="Privacy Notice"
        description="How A Star Customs collects, uses and protects customer information across enquiries, reviews and Stripe checkout."
      />
      <PageHero
        eyebrow="Clear, respectful data handling"
        title="Privacy notice."
        description="What we collect, why we need it, who helps us process it and the choices you have."
        image="/images/site/gallery-ambient-02.jpeg"
      />

      <section className="section policy-section">
        <div className="container policy-layout">
          <aside>
            <ShieldCheck aria-hidden="true" />
            <h2>Your information stays purposeful.</h2>
            <p>We do not sell customer information or use enquiry and review details for unrelated marketing.</p>
            <a className="text-link" href={`mailto:${contactDetails.email}`}>
              <Mail aria-hidden="true" /> Ask a privacy question
            </a>
          </aside>

          <div className="policy-content">
            <p className="policy-intro">
              This notice applies when you use this website, contact A Star Customs,
              submit a review or buy through Stripe Checkout. Last updated 17 August 2026.
            </p>

            <article>
              <span>01</span>
              <div>
                <h2>Who is responsible</h2>
                <p>
                  A Star Customs is responsible for deciding how customer information is used.
                  You can contact us at {contactDetails.email}, {contactDetails.phoneDisplay}, or
                  at {contactDetails.address.join(', ')}.
                </p>
              </div>
            </article>

            <article>
              <span>02</span>
              <div>
                <h2>What we collect and why</h2>
                <ul>
                  <li>Enquiries: name, email, optional phone number, vehicle and project details so we can answer and prepare a quote.</li>
                  <li>Orders: Stripe collects contact, shipping and payment information so your purchase can be processed, fulfilled and refunded when necessary. We do not receive or store full card details.</li>
                  <li>Reviews: name, rating and comment so we can moderate and publish genuine customer feedback.</li>
                  <li>Website choices: cart contents and cookie preferences stored in your browser so the site works between visits.</li>
                </ul>
                <p>We do not make legally significant decisions about you using automated processing.</p>
              </div>
            </article>

            <article>
              <span>03</span>
              <div>
                <h2>Our lawful reasons</h2>
                <p>
                  We use enquiry details to take steps you request before a possible contract and
                  to pursue our legitimate interest in answering customers. We use order information
                  to perform a contract and meet legal, accounting and fraud-prevention duties. We
                  moderate reviews and operate essential site storage for our legitimate business
                  interests. Optional analytics, social embeds and similar non-essential technologies
                  are used only with your consent, which you can change at any time.
                </p>
              </div>
            </article>

            <article>
              <span>04</span>
              <div>
                <h2>Who processes information</h2>
                <p>
                  Web3Forms delivers website enquiries, Stripe hosts checkout and payment services,
                  and our hosting providers run the website and database. Google Maps and TikTok load
                  only after marketing consent. These providers process information under their own
                  terms and may use protected international transfers where their services require it.
                </p>
                <p>
                  Read the provider notices at{' '}
                  <a href="https://web3forms.com/privacy" target="_blank" rel="noreferrer">Web3Forms</a>{' '}
                  and <a href="https://stripe.com/gb/privacy" target="_blank" rel="noreferrer">Stripe</a>.
                </p>
              </div>
            </article>

            <article>
              <span>05</span>
              <div>
                <h2>How long we keep it</h2>
                <ul>
                  <li>Routine enquiries and workshop correspondence are normally kept for up to 24 months after the last contact, unless they become part of an order or dispute.</li>
                  <li>Transaction and accounting records are kept for the period required by tax and company law, normally six years after the relevant accounting period.</li>
                  <li>Approved reviews remain visible while useful and accurate; you can ask us to remove your published review.</li>
                  <li>Cart and consent choices remain in your browser until you clear them. Pending reviews stay private unless approved or rejected by the workshop.</li>
                </ul>
                <p>Web3Forms states that submission data may be retained for up to three years unless it is deleted earlier.</p>
              </div>
            </article>

            <article>
              <span>06</span>
              <div>
                <h2>Your choices and rights</h2>
                <p>
                  Depending on the circumstances, you may ask for access, correction, deletion,
                  restriction or transfer of your information, or object to how it is used. You can
                  withdraw optional cookie consent from the settings button at any time. Email
                  {` ${contactDetails.email}`} to make a request. We may need to confirm your identity.
                </p>
                <p>
                  Please contact us first if something feels wrong. You can also complain to the{' '}
                  <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">
                    Information Commissioner’s Office
                  </a>.
                </p>
              </div>
            </article>

            <article>
              <span>07</span>
              <div>
                <h2>Keeping this notice accurate</h2>
                <p>
                  We review this notice when our website, providers or business processes change.
                  Material changes will be shown here with a new update date.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
