import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { savedItem } from '@/lib/saved';
import { checkPhone, telHref, whatsappHref as toWhatsApp } from '@/lib/phone';
import type { AgentCare as AgentCareContact } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  HeadphonesIcon,
  Phone,
  MessageCircle,
  Mail,
  User,
  Info,
  Pencil,
} from 'lucide-react';

export default function AgentCare() {
  const { agentCare: contact, setAgentCare, isLoading, reload } = useData();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!contact) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Agent Care</h1>
        <p className="text-gray-500">{isLoading ? 'Loading the support contact...' : 'No support contact has been configured yet.'}</p>
      </div>
    );
  }
  const agentCare = contact;
  const callHref = telHref(agentCare.phone);
  const whatsappHref = toWhatsApp(agentCare.whatsapp);
  const emailHref = `mailto:${agentCare.email}`;

  const openEditor = () => {
    setForm({ name: agentCare.name, phone: agentCare.phone, whatsapp: agentCare.whatsapp, email: agentCare.email });
    setErrors({});
    setEditing(true);
  };

  const save = async () => {
    const problems: Record<string, string> = {};
    if (!form.name.trim()) problems.name = 'Name is required';
    const phone = checkPhone(form.phone, { keep: agentCare.phone });
    if (!phone.ok) problems.phone = phone.message;
    const whatsapp = checkPhone(form.whatsapp, { keep: agentCare.whatsapp });
    if (!whatsapp.ok) problems.whatsapp = whatsapp.message;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) problems.email = 'Enter a valid email address';
    setErrors(problems);
    if (Object.keys(problems).length || !phone.ok || !whatsapp.ok) return;
    setSaving(true);
    try {
      const result = await jsonRequest<{ item: AgentCareContact }>(`agent-care/${agentCare.id}`, {
        method: 'PUT',
        body: { name: form.name.trim(), phone: phone.value, whatsapp: whatsapp.value, email: form.email.trim() },
      });
      const saved = savedItem<AgentCareContact>(result);
      if (saved) setAgentCare(saved);
      else await reload(['agentCare']);
      setEditing(false);
      toast.success('Support contact updated');
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) setErrors(error.fieldErrors);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Care</h1>
          <p className="text-gray-500 mt-1">
            Contact support for assistance
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={openEditor}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Contact
          </Button>
        )}
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
                  <strong>Note:</strong> Administrators can update this contact with the &quot;Edit Contact&quot; button
                  above. It is shown to every employee who needs support.
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
      <Dialog open={editing} onOpenChange={(open) => !saving && setEditing(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Support Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {([
              ['name', 'Name', 'text'],
              ['phone', 'Phone', 'tel'],
              ['whatsapp', 'WhatsApp', 'tel'],
              ['email', 'Email', 'email'],
            ] as const).map(([key, label, type]) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`care-${key}`}>{label}</Label>
                <Input
                  id={`care-${key}`}
                  type={type}
                  dir={type === 'tel' ? 'ltr' : undefined}
                  value={form[key]}
                  aria-invalid={Boolean(errors[key])}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                />
                {errors[key] && <p className="text-xs text-red-600" role="alert">{errors[key]}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
