import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, TrendingUp, TrendingDown, ArrowRightLeft, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';

interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string;
  created_at: string;
}

const CURRENCIES = ['USD', 'EUR', 'ZAR', 'GBP', 'CNY', 'BRL'];

export default function ExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [latestRates, setLatestRates] = useState<ExchangeRate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ from_currency: 'USD', rate: '', effective_date: new Date().toISOString().split('T')[0] });
  const [convertForm, setConvertForm] = useState({ from: 'USD', amount: '100' });
  const [convertResult, setConvertResult] = useState<{ rate: number; converted: number } | null>(null);

  const load = async () => {
    const [allRes, latestRes] = await Promise.all([
      api.exchangeRates.list(50),
      api.exchangeRates.latest(),
    ]);
    if (allRes.data) setRates(allRes.data);
    if (latestRes.data) setLatestRates(latestRes.data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.rate || parseFloat(form.rate) <= 0) { toast.error('Taxa inválida'); return; }
    const res = await api.exchangeRates.create({
      from_currency: form.from_currency,
      to_currency: 'AOA',
      rate: parseFloat(form.rate),
      effective_date: form.effective_date,
      source: 'manual',
    });
    if (res.data) {
      toast.success('Taxa adicionada');
      setDialogOpen(false);
      setForm({ from_currency: 'USD', rate: '', effective_date: new Date().toISOString().split('T')[0] });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    await api.exchangeRates.delete(id);
    toast.success('Taxa removida');
    load();
  };

  const handleConvert = async () => {
    const res = await api.exchangeRates.convert(convertForm.from, 'AOA', parseFloat(convertForm.amount));
    if (res.data) setConvertResult(res.data);
    else toast.error('Sem taxa disponível');
  };

  const fmt = (n: number) => n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Taxas de Câmbio</h1>
          <p className="text-muted-foreground">Gestão de taxas de câmbio para multi-moeda</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nova Taxa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Taxa de Câmbio</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Moeda</Label>
                  <Select value={form.from_currency} onValueChange={v => setForm(p => ({ ...p, from_currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Taxa (1 {form.from_currency} = ? AOA)</Label>
                  <Input type="number" step="0.01" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} placeholder="835.00" />
                </div>
                <div>
                  <Label>Data Efetiva</Label>
                  <Input type="date" value={form.effective_date} onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Current Rates Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {latestRates.map(r => (
          <Card key={`${r.from_currency}-${r.to_currency}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-lg font-mono">{r.from_currency}</Badge>
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-lg font-mono">AOA</Badge>
                </div>
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <p className="text-3xl font-bold mt-3 text-foreground">{fmt(parseFloat(String(r.rate)))}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Atualizado: {new Date(r.effective_date).toLocaleDateString('pt-AO')} • {r.source}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Converter */}
      <Card>
        <CardHeader><CardTitle className="text-base">Conversor Rápido</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label>Montante</Label>
              <Input type="number" value={convertForm.amount} onChange={e => setConvertForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="w-32">
              <Label>Moeda</Label>
              <Select value={convertForm.from} onValueChange={v => setConvertForm(p => ({ ...p, from: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleConvert}>Converter</Button>
            {convertResult && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Taxa: {fmt(convertResult.rate)}</p>
                <p className="text-xl font-bold text-foreground">{fmt(convertResult.converted)} AOA</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Taxas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Moeda</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="secondary">{r.from_currency} → {r.to_currency}</Badge>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{fmt(parseFloat(String(r.rate)))}</TableCell>
                  <TableCell>{new Date(r.effective_date).toLocaleDateString('pt-AO')}</TableCell>
                  <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rates.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem taxas registadas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
