import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Anthropic from 'npm:@anthropic-ai/sdk@0.121.0';

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
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Teto do lado do servidor. O cliente já barra antes, isto é a segunda porta. */
const MAX_BYTES = 25 * 1024 * 1024;

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * O contrato com o modelo.
 *
 * Sem `strict: true` de propósito: o modo estrito exige que toda propriedade
 * esteja em `required`, o que brigaria com os `enum` (um bloco de texto teria
 * de mandar `proporcao`, e "" não é valor válido do enum). A garantia real
 * está no normalizador do cliente, que é testado — validar na fronteira que a
 * gente controla vale mais do que confiar na de fora.
 */
const ESQUEMA = {
  type: 'object' as const,
  properties: {
    paginas: {
      type: 'array',
      description: 'As páginas do jornal, na ordem em que devem aparecer.',
      items: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            enum: ['capa', 'materia', 'materias', 'galeria', 'numeros', 'contracapa'],
            description:
              'capa = primeira página; materia = uma matéria com texto corrido; ' +
              'materias = duas notícias lado a lado; galeria = várias fotos; ' +
              'numeros = indicadores; contracapa = encerramento.',
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
                  description:
                    'Só para tipo=texto. titulo_capa apenas na capa; destaque para citações; ' +
                    'chamada para linhas curtas de apoio, como assinatura ou data.',
                },
                conteudo: { type: 'string', description: 'Só para tipo=texto. O texto, sem reescrever.' },
                largura: {
                  type: 'integer',
                  enum: [1, 2, 3, 4, 5, 6],
                  description: 'Colunas ocupadas, de 1 a 6. A folha tem 6 colunas.',
                },
                alinhamento: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
                proporcao: {
                  type: 'string',
                  enum: ['16/9', '4/3', '1/1', '3/4'],
                  description: 'Só para tipo=imagem.',
                },
                legenda: { type: 'string', description: 'Só para tipo=imagem. Legenda da foto, se houver.' },
                valor: { type: 'string', description: 'Só para tipo=numero. Ex.: "240".' },
                rotulo: { type: 'string', description: 'Só para tipo=numero. Ex.: "Famílias atendidas".' },
              },
              required: ['tipo'],
            },
          },
        },
        required: ['template', 'blocos'],
      },
    },
    observacoes: {
      type: 'string',
      description:
        'O que não coube no modelo ou ficou ambíguo, em uma ou duas frases, para a pessoa conferir. Vazio se não houver.',
    },
  },
  required: ['paginas'],
};

const INSTRUCOES = `Você recebe um documento produzido por uma diretora de unidade da ANA Brasil, fora do padrão visual do Jornal Institucional. Sua tarefa é identificar a ESTRUTURA do conteúdo para que ele seja remontado no modelo do Jornal.

Regras:

1. NÃO reescreva o texto. Transcreva o que está no documento. Corrija apenas erros óbvios de digitação e junte linhas que foram quebradas no meio de uma frase.
2. NÃO invente conteúdo. Se não há citação, não crie um destaque. Se não há números, não crie a página de indicadores.
3. A primeira página deve ser "capa", com um titulo_capa e, quando houver foto de abertura, uma imagem.
4. Cada foto do documento vira um bloco tipo=imagem na posição em que ela aparece. A legenda dela, se existir, vai no campo "legenda" — nunca como um bloco de texto separado.
5. Texto corrido é "corpo". Citações entre aspas viram "destaque". Assinatura, data e crédito viram "chamada".
6. Largura: texto corrido e títulos normalmente ocupam as 6 colunas. Use 3 colunas quando houver duas notícias curtas lado a lado, e 2 colunas para indicadores.
7. Uma página do Jornal comporta aproximadamente 2.500 caracteres de corpo mais uma foto. Distribua o conteúdo em várias páginas em vez de amontoar tudo na primeira — conteúdo que não cabe é cortado sem aviso.
8. Se o documento tiver pouco conteúdo, devolva poucas páginas. Não complete com páginas vazias.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return responder({ error: 'Não autorizado.' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!ANTHROPIC_API_KEY) {
      // Erro de configuração, não da pessoa — e a mensagem precisa dizer isso,
      // senão a diretora tenta de novo achando que o arquivo dela é o problema.
      return responder(
        { error: 'A leitura automática ainda não foi configurada. Avise a equipe de comunicação.' },
        503,
      );
    }

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

    const body = await req.json();
    const { arquivo, unidade, edicao } = body ?? {};
    if (typeof arquivo !== 'string' || !arquivo) {
      return responder({ error: 'Nenhum arquivo recebido.' }, 400);
    }
    // base64 cresce ~4/3 sobre o original; comparar o tamanho decodificado.
    if ((arquivo.length * 3) / 4 > MAX_BYTES) {
      return responder({ error: 'O arquivo passa de 25 MB. Envie uma versão mais leve.' }, 413);
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const contexto = [
      unidade ? `Unidade: ${unidade}.` : '',
      edicao ? `Edição de referência: ${edicao}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const resposta = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: INSTRUCOES,
      tools: [
        {
          name: 'montar_jornal',
          description: 'Devolve a estrutura do jornal a partir do documento enviado.',
          input_schema: ESQUEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'montar_jornal' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: arquivo },
            },
            {
              type: 'text',
              text: `${contexto}\n\nIdentifique a estrutura deste documento e devolva as páginas do jornal.`,
            },
          ],
        },
      ],
    });

    // Recusa do classificador chega como HTTP 200 — conferir antes de ler o conteúdo.
    if (resposta.stop_reason === 'refusal') {
      return responder(
        { error: 'Não consegui ler este documento. Tente outro arquivo ou fale com a comunicação.' },
        422,
      );
    }

    const chamada = resposta.content.find(
      (bloco) => bloco.type === 'tool_use' && bloco.name === 'montar_jornal',
    );
    if (!chamada || chamada.type !== 'tool_use') {
      return responder({ error: 'Não consegui identificar a estrutura deste documento.' }, 422);
    }

    console.log(
      `[IMPORT] ${callerId} importou um PDF · ${resposta.usage.input_tokens} entrada / ` +
        `${resposta.usage.output_tokens} saída`,
    );

    return responder({
      resultado: chamada.input,
      uso: {
        entrada: resposta.usage.input_tokens,
        saida: resposta.usage.output_tokens,
      },
    });
  } catch (err) {
    console.error('Erro na importação:', err);
    const mensagem = err instanceof Error ? err.message : 'Erro interno.';
    return responder({ error: mensagem }, 500);
  }
});
