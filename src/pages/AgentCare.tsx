import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  HeadphonesIcon, 
  Phone, 
  MessageCircle, 
  Mail,
  User,
  Info
} from 'lucide-react';

export default function AgentCare() {
  const { agentCare } = useData();
  const sanitizePhone = (phone: string) => phone.replace(/[^\d+]/g, '');
  const normalizeWhatsAppPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('20')) return digits;
    if (digits.startsWith('0')) return `20${digits.slice(1)}`;
    return digits;
  };
  const callHref = `tel:${sanitizePhone(agentCare.phone)}`;
  const whatsappHref = `https://wa.me/${normalizeWhatsAppPhone(agentCare.whatsapp)}`;
  const emailHref = `mailto:${agentCare.email}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Care</h1>
        <p className="text-gray-500 mt-1">
          Contact support for assistance
        </p>
      </div>

      {/* Agent Care Card */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-2 border-gray-200">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
                <HeadphonesIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">{agentCare.name}</CardTitle>
            <p className="text-gray-500">We're here to help you succeed</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Contact Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button asChild size="lg" className="h-16 text-lg bg-blue-500 hover:bg-blue-600">
                <a href={callHref}>
                  <div className="flex flex-col items-center">
                    <Phone className="w-6 h-6 mb-1" />
                    <span>Call</span>
                  </div>
                </a>
              </Button>

              <Button asChild size="lg" className="h-16 text-lg bg-green-500 hover:bg-green-600">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <div className="flex flex-col items-center">
                    <MessageCircle className="w-6 h-6 mb-1" />
                    <span>WhatsApp</span>
                  </div>
                </a>
              </Button>

              <Button asChild size="lg" className="h-16 text-lg bg-cyan-500 hover:bg-cyan-600">
                <a href={emailHref}>
                  <div className="flex flex-col items-center">
                    <Mail className="w-6 h-6 mb-1" />
                    <span>Email</span>
                  </div>
                </a>
              </Button>
            </div>

            {/* Contact Info */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{agentCare.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">WhatsApp</p>
                  <p className="font-medium">{agentCare.whatsapp}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-cyan-100 rounded-full">
                  <Mail className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{agentCare.email}</p>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <Info className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> The admin can update the Agent Care contact information 
                  from the admin panel. This contact is available for all agents who need support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Support Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Weekdays</p>
              <p className="text-gray-600">Sunday - Thursday</p>
              <p className="text-gray-600">9:00 AM - 6:00 PM</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">Weekends</p>
              <p className="text-gray-600">Friday - Saturday</p>
              <p className="text-gray-600">10:00 AM - 2:00 PM</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
