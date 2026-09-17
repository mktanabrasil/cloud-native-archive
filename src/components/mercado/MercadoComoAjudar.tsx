import { Package, Carrot, Clock, SprayCan, Megaphone, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const items = [
  { icon: Package, title: 'Alimentos não perecíveis', desc: 'Arroz, feijão, macarrão, óleo, etc.' },
  { icon: Carrot, title: 'Hortifruti', desc: 'Frutas, legumes e verduras em boas condições.' },
  { icon: Clock, title: 'Próximos ao vencimento', desc: 'Produtos próximos à validade, respeitando normas sanitárias.' },
  { icon: SprayCan, title: 'Higiene e limpeza', desc: 'Itens essenciais para a saúde e bem-estar.' },
  { icon: Megaphone, title: 'Campanhas de arrecadação', desc: 'Mobilize clientes e colaboradores em campanhas conjuntas.' },
];

const benefits = [
  'Contribui diretamente para a segurança alimentar de famílias em vulnerabilidade.',
  'Fortalece a responsabilidade social da sua empresa — o ESG que o mercado pede.',
  'Ajuda a reduzir o desperdício de alimentos.',
  'Participa de uma iniciativa séria, transparente e com impacto social comprovado.',
  'Demonstra seu compromisso com a comunidade local.',
];

export function MercadoComoAjudar() {
  return (
    <section id="como-ajudar" className="scroll-mt-24 grid gap-6 lg:grid-cols-2">
      <Card className="border-border">
        <CardContent className="p-6 sm:p-8">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Como sua empresa pode ajudar?
          </h2>
          <div
            className="mt-3 h-1 w-16 rounded-full"
            style={{ background: 'hsl(var(--news-brand-4))' }}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Toda doação vai para as famílias acompanhadas pelas nossas unidades, seguindo critérios
            internos de distribuição.
          </p>

          <ul className="mt-6 space-y-3">
            {items.map((it) => (
              <li
                key={it.title}
                className="flex items-start gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-accent/30"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: 'hsl(var(--news-brand-4) / 0.15)',
                    color: 'hsl(var(--news-brand-4))',
                  }}
                >
                  <it.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{it.title}</p>
                  <p className="text-sm text-muted-foreground">{it.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card
        id="parceiro"
        className="scroll-mt-24 border-transparent shadow-md"
        style={{ background: 'hsl(var(--news-brand-4))' }}
      >
        <CardContent className="flex h-full flex-col p-6 sm:p-8 text-[hsl(var(--primary-foreground))]">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Por que ser um parceiro?</h2>
          <p className="mt-3 text-sm/relaxed opacity-90">
            Ao apoiar o Mercado Solidário, sua empresa faz parte de uma corrente do bem:
          </p>

          <ul className="mt-6 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: 'hsl(var(--news-brand-2))' }}
                />
                <span className="text-sm/relaxed">{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto rounded-xl border border-white/25 bg-white/10 p-5 pt-5 backdrop-blur-sm">
            <p className="text-center text-base font-medium italic">
              "Quem reparte o que tem multiplica esperança."
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
