import { AlertTriangle } from 'lucide-react';
import { useTituloDaAba } from '@/hooks/useTituloDaAba';
import { MolduraDasVagas } from '@/components/vagas/PecasDasVagas';
import { VERSAO_DOS_TERMOS } from '@/lib/vagas/conta';

/**
 * /vagas/privacidade — Termos de Uso e Aviso de Privacidade do Trabalhe
 * Conosco, na VERSÃO PROVISÓRIA (28/09/2026). O texto fala só do que o app
 * guarda hoje (nome, e-mail e a conta) e precisa da validação do
 * jurídico/DPO antes de a candidatura pelo app receber currículo (PR 8).
 * Quando o texto final chegar, ele entra aqui e `VERSAO_DOS_TERMOS` sobe.
 */
export default function PrivacidadeCandidatoPage() {
  useTituloDaAba('Privacidade · Trabalhe Conosco ANA Brasil');
  const secao = (titulo: string, texto: string) => (
    <section className="flex flex-col gap-1.5"><h2 className="text-lg font-semibold">{titulo}</h2><p className="leading-relaxed text-muted-foreground">{texto}</p></section>
  );
  return (
    <MolduraDasVagas>
      <div className="px-4 py-10 sm:px-6">
        <article className="mx-auto flex max-w-[70ch] flex-col gap-6 rounded-[20px] border border-black/5 bg-card p-6 sm:p-9 dark:border-white/5">
          <div className="flex gap-2.5 rounded-2xl bg-muted/70 p-3.5 text-sm" role="note">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>Versão provisória, em validação pelo jurídico da ANA. Quando o texto final sair, avisaremos quem tem conta.</span>
          </div>
          <h1 className="text-[30px] font-bold leading-tight">Termos de Uso e Aviso de Privacidade</h1>
          {secao('Quem somos', 'A Associação Nazarena Assistencial Beneficente (ANA Brasil) mantém este portal para divulgar vagas e receber candidaturas para as unidades de Campinas.')}
          {secao('O que guardamos agora', 'Seu nome (ou nome social), seu e-mail e a data em que você aceitou estes termos. A senha fica protegida: ninguém da ANA consegue vê-la.')}
          {secao('Para quê', 'Para manter a sua conta, para você acompanhar as vagas e para a equipe de Recursos Humanos falar com você sobre as vagas em que se inscrever.')}
          {secao('Quem vê', 'Só a equipe de Recursos Humanos e a administração da ANA. Não vendemos nem repassamos seus dados.')}
          {secao('Por quanto tempo', 'Enquanto a sua conta existir. Você pode pedir para apagar a conta e os dados a qualquer momento.')}
          {secao('Seus direitos', 'Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir para ver, corrigir ou apagar seus dados. Escreva para contato@anabrasil.org com o assunto "Privacidade - Trabalhe Conosco".')}
          <p className="text-xs text-muted-foreground">Versão {VERSAO_DOS_TERMOS}.</p>
        </article>
      </div>
    </MolduraDasVagas>
  );
}
