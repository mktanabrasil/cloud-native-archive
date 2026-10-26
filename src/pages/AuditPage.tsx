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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { History, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Logs de Auditoria" 
        description="Histórico de ações realizadas no sistema"
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por ator, ação..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger className="w-[180px]">
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">Carregando logs...</TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum log encontrado.</TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{log.actor_name || 'Sistema'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize whitespace-nowrap">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize whitespace-nowrap">{log.entity_type}</TableCell>
                      <TableCell className="whitespace-nowrap">{log.unit || '-'}</TableCell>
                      <TableCell className="max-w-[300px] truncate font-mono text-[10px]">
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <PageGuide />
    </div>
  );
}
