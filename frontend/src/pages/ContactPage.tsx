import { Clock3, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { ConsentGate } from '../components/CookieConsent';
import { Seo } from '../components/Seo';
import { contactDetails, whatsappUrl } from '../data/site';

type FormStatus = 'idle' | 'sending' | 'success' | 'unconfigured' | 'error';

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const initialForm: ContactForm = { name: '', email: '', phone: '', message: '' };

export function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [status, setStatus] = useState<FormStatus>('idle');
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');

    try {
      const response = await fetch(`${apiBaseUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: form.phone.trim() || undefined,
        }),
      });

      if (response.status === 503) {
        setStatus('unconfigured');
        return;
      }
      if (!response.ok) throw new Error('Contact request failed');

      setForm(initialForm);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <Seo
        title="Contact the Workshop"
        description="Contact A Star Customs in Hounslow for a custom automotive quote. Share your car make, model, year and the upgrade you have in mind."
      />
      <PageHero
        eyebrow="Tell us what you drive"
        title="Let’s plan the right upgrade for your car."
        description="Include the make, model, year and a clear description of what you want. Reference photos are welcome on WhatsApp."
        image="/images/site/gallery-ambient-03.jpg"
      />

      <section className="section contact-section">
        <div className="container contact-layout">
          <div className="contact-details-panel">
            <p className="eyebrow">Direct contact</p>
            <h2>Speak to the workshop.</h2>
            <p>We aim to reply within 24 working hours.</p>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              <span><small>Fastest route</small>WhatsApp an enquiry</span>
            </a>
            <a href={`tel:${contactDetails.phone}`}>
              <Phone aria-hidden="true" />
              <span><small>Call</small>{contactDetails.phoneDisplay}</span>
            </a>
            <a href={`mailto:${contactDetails.email}`}>
              <Mail aria-hidden="true" />
              <span><small>Email</small>{contactDetails.email}</span>
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactDetails.mapQuery)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin aria-hidden="true" />
              <span><small>Workshop</small>{contactDetails.address.join(', ')}</span>
            </a>
            <div className="response-note"><Clock3 aria-hidden="true" /> Monday–Saturday by appointment</div>
          </div>

          <form className="contact-form" onSubmit={submit}>
            <div className="form-heading">
              <p className="eyebrow">Project enquiry</p>
              <h2>What would you like done?</h2>
            </div>
            <div className="form-grid">
              <label>
                <span>Name</span>
                <input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Your name"
                />
              </label>
              <label>
                <span>Email address</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="you@example.com"
                />
              </label>
              <label className="form-grid__wide">
                <span>Phone number <small>optional</small></span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="07123 456789"
                />
              </label>
              <label className="form-grid__wide">
                <span>Car and project details</span>
                <textarea
                  required
                  rows={7}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  placeholder="Make, model, year and the upgrade you have in mind…"
                />
              </label>
            </div>
            <p className="form-privacy">
              We use these details to answer your enquiry. Delivery is handled by Web3Forms.{' '}
              <Link to="/privacy">Read our privacy notice</Link>.
            </p>
            <button className="button button--primary" type="submit" disabled={status === 'sending'}>
              <Send aria-hidden="true" /> {status === 'sending' ? 'Sending…' : 'Send enquiry'}
            </button>
            <div className="form-status" aria-live="polite">
              {status === 'success' ? 'Thanks — your enquiry has been sent.' : null}
              {status === 'unconfigured' ? (
                <span>
                  Online delivery is awaiting its environment key. Please use{' '}
                  <a href={whatsappUrl}>WhatsApp</a> or <a href={`mailto:${contactDetails.email}`}>email</a> for now.
                </span>
              ) : null}
              {status === 'error' ? 'The form could not send. Please use WhatsApp or email instead.' : null}
            </div>
          </form>
        </div>
      </section>

      <section className="workshop-map" aria-label="Workshop location">
        <ConsentGate title="Workshop map">
          <iframe
            title="A Star Customs workshop map"
            loading="lazy"
            src={`https://www.google.com/maps?q=${encodeURIComponent(contactDetails.mapQuery)}&output=embed`}
          />
        </ConsentGate>
      </section>
    </>
  );
}
