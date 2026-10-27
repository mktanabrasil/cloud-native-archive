import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { UNITS } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageGuide from '@/components/PageGuide';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AuditPage() {
  const { isManager, isAdmin, unit: userUnit, delegatedUnits, canViewAuditoria, loading: carregandoPapel } = useUserRole();
  const [filterUnit, setFilterUnit] = useState<string>(isAdmin ? 'all' : (userUnit || 'all'));
  const [searchTerm, setSearchTerm] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', filterUnit],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterUnit !== 'all') {
        query = query.eq('unit', filterUnit);
      } else if (!isAdmin && !isManager) {
        // Restricted to their unit and delegated units for standard users
        const units = [userUnit, ...delegatedUnits].filter(Boolean);
        if (units.length > 0) {
          query = query.in('unit', units);
        }
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isManager || isAdmin,
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!searchTerm) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(log => 
      (log.actor_name?.toLowerCase().includes(term)) ||
      (log.action?.toLowerCase().includes(term)) ||
      (log.entity_type?.toLowerCase().includes(term))
    );
  }, [logs, searchTerm]);

  // Espera as permissões, para não piscar "Acesso Negado" (26/10/2026).
  if (carregandoPapel) return null;

  if (!canViewAuditoria) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  const availableUnits = (isAdmin || isManager)
    ? UNITS 
    : UNITS.filter(u => u === userUnit || delegatedUnits.includes(u));

  const dataHora = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR });
  const detalhes = (d: unknown) => (d ? JSON.stringify(d) : '-');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Logs de Auditoria"
        description="Histórico de ações realizadas no sistema"
      />

      {/* Esboço V2: filtros soltos acima da tabela, sem cartão em volta */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar por ator, ação..."
            aria-label="Buscar por ator, ação ou entidade"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Unidade">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            {(isAdmin || isManager) && <SelectItem value="all">Todas as Unidades</SelectItem>}
            {!isAdmin && availableUnits.length > 1 && <SelectItem value="all">Todas Delegadas</SelectItem>}
            {availableUnits.map(u => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isLoading && (
          <p className="text-[13px] tabular-nums text-muted-foreground sm:ml-auto">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'}
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="rounded-[20px] border border-black/5 bg-card p-10 text-center text-sm text-muted-foreground dark:border-white/5">Carregando logs...</p>
      ) : filteredLogs.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhum log encontrado.</p>
      ) : (
        <>
          {/* computador: a tabela sólida; a ação vira texto, sem pílula */}
          <div className="hidden overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-11 px-4 text-xs font-semibold">Data/Hora</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold">Ator</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold">Ação</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold">Entidade</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold">Unidade</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="border-border/70 hover:bg-muted/40">
                    <TableCell className="whitespace-nowrap px-4 tabular-nums text-muted-foreground">
                      {dataHora(log.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 font-semibold">{log.actor_name || 'Sistema'}</TableCell>
                    <TableCell className="whitespace-nowrap px-4 capitalize">{log.action}</TableCell>
                    <TableCell className="whitespace-nowrap px-4 capitalize text-muted-foreground">{log.entity_type}</TableCell>
                    <TableCell className="whitespace-nowrap px-4">{log.unit || '-'}</TableCell>
                    <TableCell className="max-w-[300px] truncate px-4 font-mono text-[11px] text-[hsl(var(--fraco))]" title={log.details ? detalhes(log.details) : undefined}>
                      {detalhes(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* celular: cada registro numa linha empilhada, sem rolar para o lado */}
          <ul className="overflow-hidden rounded-[20px] border border-black/5 bg-card dark:border-white/5 md:hidden">
            {filteredLogs.map((log) => (
              <li key={log.id} className="grid gap-1 border-b border-border/70 px-4 py-3.5 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <b className="min-w-0 truncate font-semibold">{log.actor_name || 'Sistema'}</b>
                  <span className="shrink-0 text-xs tabular-nums text-[hsl(var(--fraco))]">{dataHora(log.created_at)}</span>
                </div>
                <p className="text-sm">
                  <span className="capitalize">{log.action}</span>
                  <span className="text-muted-foreground"> · <span className="capitalize">{log.entity_type}</span>{log.unit ? ` · ${log.unit}` : ''}</span>
                </p>
                {log.details && (
                  <p className="line-clamp-2 break-all font-mono text-[11px] leading-snug text-[hsl(var(--fraco))]">{detalhes(log.details)}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <PageGuide />
    </div>
  );
}
