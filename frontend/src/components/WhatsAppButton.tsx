import { MessageCircle } from 'lucide-react';
import { whatsappUrl } from '../data/site';

export function WhatsAppButton() {
  return (
    <a
      className="whatsapp-button"
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Open WhatsApp enquiry"
    >
      <MessageCircle aria-hidden="true" />
      <span>Message us</span>
    </a>
  );
}

