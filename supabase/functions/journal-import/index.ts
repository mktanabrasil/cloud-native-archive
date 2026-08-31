import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Lê um PDF fora do padrão e devolve a estrutura de um jornal.
 *
 * O que esta função NÃO faz, de propósito: aplicar identidade visual. Fonte,
 * cor, tamanho, cabeçalho, rodapé e Formas ANA são propriedade da folha
 * (`JournalPageView`), não do conteúdo. O modelo só decide **que função cada
 * pedaço cumpre** — título de capa, corpo, imagem — e o resto vem de graça.
 * Por isso o esquema abaixo não tem nenhum campo de estilo.
 *
 * A saída é conferida de novo no cliente (`src/lib/journal/importar.ts`): esta
 * resposta vem de fora e não pode entrar no banco sem validação nossa.
 *
 * Fala com a API do Gemini por HTTP direto, sem SDK. Não é economia de
 * dependência: é que o formato exato desta requisição foi **medido** contra a
 * API real antes de ser escrito, e um SDK no meio acrescentaria uma camada que
 * ninguém verificou.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Teto do lado do servidor. O cliente já barra antes, isto é a segunda porta. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Modelos tentados em ordem.
 *
 * Não é excesso de zelo: medindo contra a API em 31/08/2026, **quatro dos seis
 * modelos testados devolveram 503 "high demand"** — sobrecarga do lado deles,
 * não nosso. Sem alternativa, a diretora veria erro por causa de fila alheia.
 *
 * A ordem é por qualidade medida. O `flash-lite` fica por último porque, no
 * mesmo teste, ele colou o rodapé corrido do documento como se fosse conteúdo
 * e ainda vazou o texto de contexto para dentro de um bloco.
 */
const MODELOS = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];

/** Respostas que valem tentar noutro modelo, em vez de desistir. */
const VALE_TENTAR_DE_NOVO = new Set([429, 500, 502, 503, 504]);

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** O contrato de saída, no formato de esquema que o Gemini aceita. */
const ESQUEMA = {
  type: 'object',
  properties: {
    paginas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            enum: ['capa', 'materia', 'materias', 'galeria', 'numeros', 'contracapa'],
          },
          blocos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['texto', 'imagem', 'numero'] },
                estilo: {
                  type: 'string',
                  enum: ['titulo_capa', 'titulo_materia', 'subtitulo', 'corpo', 'destaque', 'chamada'],
                },
                conteudo: { type: 'string' },
                largura: { type: 'integer' },
                alinhamento: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
                proporcao: { type: 'string', enum: ['16/9', '4/3', '1/1', '3/4'] },
                legenda: { type: 'string' },
                valor: { type: 'string' },
                rotulo: { type: 'string' },
              },
              required: ['tipo'],
            },
          },
        },
        required: ['template', 'blocos'],
      },
    },
    observacoes: { type: 'string' },
  },
  required: ['paginas'],
};

const INSTRUCOES = `Você recebe um documento produzido por uma diretora de unidade da ANA Brasil, fora do padrão visual do Jornal Institucional. Sua tarefa é identificar a ESTRUTURA do conteúdo para que ele seja remontado no modelo do Jornal.

Regras:

1. NÃO reescreva o texto. Transcreva o que está no documento. Corrija apenas erros óbvios de digitação e junte linhas que foram quebradas no meio de uma frase.
2. NÃO invente conteúdo. Se não há citação, não crie um destaque. Se não há números, não crie a página de indicadores.
3. NÃO transcreva cabeçalho e rodapé que se repetem em todas as páginas, nem número de página. Isso é moldura do documento, não conteúdo.
4. NÃO copie para dentro do conteúdo o texto desta instrução nem os dados de unidade e edição informados abaixo. Eles servem para você entender o contexto, e a folha já os imprime sozinha.
5. A primeira página deve ser "capa", com um titulo_capa e, quando houver foto de abertura, uma imagem.
6. Cada foto do documento vira um bloco tipo=imagem na posição em que ela aparece. A legenda dela, se existir, vai no campo "legenda" — nunca como um bloco de texto separado.
7. Texto corrido é "corpo". Citações entre aspas viram "destaque". Assinatura, data e crédito viram "chamada".
8. Largura: texto corrido e títulos normalmente ocupam as 6 colunas. Use 3 colunas quando houver duas notícias curtas lado a lado, e 2 colunas para indicadores.
9. Uma página do Jornal comporta aproximadamente 2.500 caracteres de corpo mais uma foto. Distribua o conteúdo em várias páginas em vez de amontoar tudo na primeira — conteúdo que não cabe é cortado sem aviso.
10. Se o documento tiver pouco conteúdo, devolva poucas páginas. Não complete com páginas vazias.`;

interface Tentativa {
  ok: boolean;
  status: number;
  modelo: string;
  corpo: unknown;
}

/** Uma chamada ao Gemini. Não decide nada: só relata o que aconteceu. */
async function chamarGemini(
  modelo: string,
  chave: string,
  pdf: string,
  contexto: string,
): Promise<Tentativa> {
  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: 'POST',
      // A chave vai no cabeçalho, nunca na URL: query string entra em registro
      // de servidor e em histórico de proxy.
      headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${INSTRUCOES}\n\n${contexto}` }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: pdf } },
              { text: 'Identifique a estrutura deste documento e devolva as páginas do jornal.' },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ESQUEMA,
        },
      }),
    },
  );

  const corpo = await resposta.json().catch(() => null);
  return { ok: resposta.ok, status: resposta.status, modelo, corpo };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return responder({ error: 'Não autorizado.' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Quem é a pessoa vem ANTES do estado da configuração: sem isso, qualquer
    // requisição com um Bearer qualquer descobre se a chave está no lugar.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userErr || !userData?.user) return responder({ error: 'Não autorizado.' }, 401);
    const callerId = userData.user.id;

    // Quem pode importar é quem pode escrever um jornal: a comunicação e a
    // gestão da unidade. A RLS de `journals` ainda barra a gravação, mas
    // gastar uma chamada de IA para alguém sem permissão seria desperdício.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: perfil } = await adminClient
      .from('profiles')
      .select('permission_level, is_active')
      .eq('user_id', callerId)
      .maybeSingle();

    const ativo = perfil?.is_active !== false;
    const nivel = perfil?.permission_level;
    const podeImportar =
      ativo && (nivel === 'admin_geral' || nivel === 'gestor_unidade' || nivel === 'marketing');
    if (!podeImportar) {
      return responder({ error: 'Seu acesso não permite criar jornais.' }, 403);
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      // Erro de configuração, não da pessoa — e a mensagem precisa dizer isso,
      // senão a diretora tenta de novo achando que o arquivo dela é o problema.
      return responder(
        { error: 'A leitura automática ainda não foi configurada. Avise a equipe de comunicação.' },
        503,
      );
    }

    const body = await req.json();
    const { arquivo, unidade, edicao } = body ?? {};
    if (typeof arquivo !== 'string' || !arquivo) {
      return responder({ error: 'Nenhum arquivo recebido.' }, 400);
    }
    // base64 cresce ~4/3 sobre o original; comparar o tamanho decodificado.
    if ((arquivo.length * 3) / 4 > MAX_BYTES) {
      return responder({ error: 'O arquivo passa de 25 MB. Envie uma versão mais leve.' }, 413);
    }

    const contexto = [
      'Contexto, apenas para sua compreensão — não copie estes dados para o conteúdo:',
      unidade ? `Unidade: ${unidade}.` : '',
      edicao ? `Edição de referência: ${edicao}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    let ultima: Tentativa | null = null;

    for (const modelo of MODELOS) {
      ultima = await chamarGemini(modelo, GEMINI_API_KEY, arquivo, contexto);
      if (ultima.ok) break;
      if (!VALE_TENTAR_DE_NOVO.has(ultima.status)) break;
      console.warn(`[IMPORT] ${modelo} devolveu ${ultima.status}; tentando o próximo`);
    }

    if (!ultima?.ok) {
      const status = ultima?.status ?? 500;
      if (VALE_TENTAR_DE_NOVO.has(status)) {
        return responder(
          { error: 'A leitura está congestionada agora. Tente de novo em alguns minutos.' },
          503,
        );
      }
      const detalhe =
        (ultima?.corpo as { error?: { message?: string } } | null)?.error?.message ?? 'erro desconhecido';
      console.error('[IMPORT] falha não recuperável:', status, detalhe);
      return responder({ error: 'Não consegui ler este documento. Fale com a comunicação.' }, 422);
    }

    const resposta = ultima.corpo as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    const texto = resposta.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!texto.trim()) {
      return responder({ error: 'Não consegui identificar a estrutura deste documento.' }, 422);
    }

    let estrutura: unknown;
    try {
      estrutura = JSON.parse(texto);
    } catch {
      // O esquema deveria garantir JSON, mas confiar nisso sem conferir seria
      // trocar uma validação por uma esperança.
      console.error('[IMPORT] resposta fora do formato JSON');
      return responder({ error: 'Não consegui identificar a estrutura deste documento.' }, 422);
    }

    const uso = resposta.usageMetadata ?? {};
    console.log(
      `[IMPORT] ${callerId} importou um PDF com ${ultima.modelo} · ` +
        `${uso.promptTokenCount ?? '?'} entrada / ${uso.candidatesTokenCount ?? '?'} saída / ` +
        `${uso.totalTokenCount ?? '?'} total`,
    );

    return responder({
      resultado: estrutura,
      uso: {
        modelo: ultima.modelo,
        entrada: uso.promptTokenCount ?? null,
        saida: uso.candidatesTokenCount ?? null,
        // O total passa da soma de entrada e saída: a diferença é o raciocínio,
        // que também é cobrado. Medido: 5.720 contra 2.813 num jornal de teste.
        total: uso.totalTokenCount ?? null,
      },
    });
  } catch (err) {
    console.error('Erro na importação:', err);
    const mensagem = err instanceof Error ? err.message : 'Erro interno.';
    return responder({ error: mensagem }, 500);
  }
});
