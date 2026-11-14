import { Button } from '@/components/ui/button';
import { MessageCircle, Phone } from 'lucide-react';
import { telHref, whatsappHref } from '@/lib/phone';

/** Call + WhatsApp links for a phone number (disabled when the number cannot be dialled). */
export function ContactButtons({ phone, whatsapp, name }: { phone: string; whatsapp?: string; name: string }) {
  const call = telHref(phone);
  const chat = whatsappHref(whatsapp || phone);
  return (
    <>
      {call ? (
        <Button asChild variant="outline" size="icon" className="h-8 w-8">
          <a href={call} aria-label={`Call ${name}`} title={`Call ${phone}`}>
            <Phone className="h-4 w-4 text-green-600" />
          </a>
        </Button>
      ) : (
        <Button variant="outline" size="icon" className="h-8 w-8" disabled aria-label="No phone number">
          <Phone className="h-4 w-4 text-green-600" />
        </Button>
      )}
      {chat ? (
        <Button asChild size="icon" className="h-8 w-8 bg-green-500 hover:bg-green-600">
          <a href={chat} target="_blank" rel="noreferrer noopener" aria-label={`WhatsApp ${name}`} title="WhatsApp">
            <MessageCircle className="h-4 w-4" />
          </a>
        </Button>
      ) : (
        <Button size="icon" className="h-8 w-8 bg-green-500" disabled aria-label="No WhatsApp number">
          <MessageCircle className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}
