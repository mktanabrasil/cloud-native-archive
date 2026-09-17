import { useState } from 'react';
import { z } from 'zod';
import { User, Phone, Mail, Globe, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const helpOptions = [
  'Doação de Alimentos',
  'Doação de Produtos de Higiene',
  'Campanha Conjunta',
  'Outros',
];

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(100),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  phone: z.string().trim().min(8, 'Telefone inválido').max(20),
  email: z.string().trim().email('E-mail inválido').max(160),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  helpType: z.string().min(1, 'Selecione uma opção'),
});

type FormValues = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof FormValues, string>>;

const initial: FormValues = { name: '', company: '', phone: '', email: '', city: '', helpType: '' };

const contacts = [
  { icon: User, label: 'Responsável', value: 'Ricardo', href: null },
  { icon: Phone, label: 'Telefone / WhatsApp', value: '(19) 99727-8118', href: 'https://wa.me/5519997278118' },
  { icon: Mail, label: 'E-mail', value: 'parceiros@anabrasil.org', href: 'mailto:parceiros@anabrasil.org' },
  { icon: Globe, label: 'Site Oficial', value: 'anabrasil.org', href: 'https://anabrasil.org' },
];

const WHATSAPP_NUMBER = '5519997278118';

export function MercadoContato() {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    const data = parsed.data;
    const text = [
      'Olá! Gostaria de saber mais sobre o Mercado Solidário.',
      '',
      '*Nome:*',
      data.name,
      '',
      '*Empresa:*',
      data.company || '—',
      '',
      '*Telefone:*',
      data.phone,
      '',
      '*E-mail:*',
      data.email,
      '',
      '*Cidade:*',
      data.city || '—',
      '',
      '*Como deseja ajudar?:*',
      data.helpType,
    ].join('\n');

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="contato" className="scroll-mt-24 grid gap-6 lg:grid-cols-2">
      <Card className="border-border">
        <CardContent className="p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-foreground">Informações de contato</h3>
          <div
            className="mt-3 h-1 w-12 rounded-full"
            style={{ background: 'hsl(var(--news-brand-4))' }}
          />
          <ul className="mt-6 space-y-4">
            {contacts.map((c) => (
              <li key={c.label} className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: 'hsl(var(--news-brand-4) / 0.15)',
                    color: 'hsl(var(--news-brand-4))',
                  }}
                >
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </p>
                  {c.href ? (
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {c.value}
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  ) : (
                    <p className="font-semibold text-foreground">{c.value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-foreground">Envie uma mensagem</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ao continuar, abrimos o WhatsApp com a mensagem pronta para você. É só enviar, e o Ricardo responde por lá.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ms-name">Nome</Label>
                <Input
                  id="ms-name"
                  value={values.name}
                  onChange={(e) => setField('name', e.target.value)}
                  maxLength={100}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms-company">Empresa</Label>
                <Input
                  id="ms-company"
                  value={values.company}
                  onChange={(e) => setField('company', e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ms-phone">Telefone</Label>
                <Input
                  id="ms-phone"
                  inputMode="tel"
                  value={values.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  maxLength={20}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms-email">E-mail</Label>
                <Input
                  id="ms-email"
                  type="email"
                  value={values.email}
                  onChange={(e) => setField('email', e.target.value)}
                  maxLength={160}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ms-city">Cidade</Label>
              <Input
                id="ms-city"
                value={values.city}
                onChange={(e) => setField('city', e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ms-help-type">Como deseja ajudar?</Label>
              <Select
                value={values.helpType}
                onValueChange={(value) => setField('helpType', value)}
              >
                <SelectTrigger
                  id="ms-help-type"
                  aria-invalid={!!errors.helpType}
                  className={errors.helpType ? 'border-destructive' : ''}
                >
                  <SelectValue placeholder="Selecione uma opção" />
                </SelectTrigger>
                <SelectContent>
                  {helpOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.helpType && <p className="text-xs text-destructive">{errors.helpType}</p>}
            </div>

            <Button type="submit" className="w-full gap-2">
              <Send className="h-4 w-4" />
              Abrir no WhatsApp com a mensagem
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
