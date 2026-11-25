import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListaDeNoticias } from './ListaDeNoticias';
import { EditorDeNoticia } from './EditorDeNoticia';

/**
 * Marketing › Notícias (25/11/2026, mockup aprovado): os posts do blog do
 * site, que a API pública `noticias` entrega. A lista e o editor dividem o
 * mesmo endereço: `?noticia=<pasta>` abre uma notícia e `?noticia=nova`
 * começa outra (o voltar do navegador volta para a lista).
 */
export function NoticiasDoBlog() {
  const [busca, setBusca] = useSearchParams();
  // A notícia nova ganha endereço ao ser salva pela primeira vez; o editor continua o mesmo (envios em andamento seguem).
  const [criada, setCriada] = useState<string | null>(null);
  const aberta = busca.get('noticia');
  const abrir = (pasta: string | null, substituir = false) => {
    const b = new URLSearchParams(busca);
    if (pasta) b.set('noticia', pasta); else b.delete('noticia');
    setBusca(b, { replace: substituir });
  };
  if (aberta) {
    const nova = aberta === 'nova' || aberta === criada;
    return (
      <EditorDeNoticia
        key={nova ? 'nova' : aberta}
        pastaId={aberta === 'nova' ? null : aberta}
        voltar={(substituir) => abrir(null, substituir)}
        criada={(id) => { setCriada(id); abrir(id, true); }}
      />
    );
  }
  return <ListaDeNoticias abrir={(p) => abrir(p)} />;
}
