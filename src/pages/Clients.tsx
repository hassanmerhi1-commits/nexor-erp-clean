import { useState } from 'react';
import { useClients } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { Client } from '@/types/erp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Plus, Search, Edit, Trash2, Building, FileSpreadsheet, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportClientsToExcel, parseClientsFromExcel, validateImportedClients, downloadClientImportTemplate, ExcelClient } from '@/lib/excel';
import { ExcelImportDialog } from '@/components/import/ExcelImportDialog';

export default function Clients() {
  const { currentBranch } = useBranchContext();
  const { clients, createClient, saveClient, deleteClient } = useClients();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nif: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Angola',
    creditLimit: '0',
  });

  const isMainOffice = currentBranch?.isMain;

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.nif.includes(searchTerm) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      nif: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'Angola',
      creditLimit: '0',
    });
    setSelectedClient(null);
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setSelectedClient(client);
      setFormData({
        name: client.name,
        nif: client.nif,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        country: client.country,
        creditLimit: client.creditLimit.toString(),
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.nif) {
      toast({
        title: 'Erro',
        description: 'Nome e NIF são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Validate NIF format (basic validation)
    if (formData.nif.length < 9) {
      toast({
        title: 'Erro',
        description: 'NIF inválido',
        variant: 'destructive',
      });
      return;
    }

    if (selectedClient) {
      saveClient({
        ...selectedClient,
        ...formData,
        creditLimit: parseFloat(formData.creditLimit) || 0,
      });
      toast({
        title: 'Cliente atualizado',
        description: `${formData.name} foi atualizado com sucesso`,
      });
    } else {
      createClient({
        ...formData,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        currentBalance: 0,
        isActive: true,
      });
      toast({
        title: 'Cliente criado',
        description: `${formData.name} foi registrado com sucesso`,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (selectedClient) {
      deleteClient(selectedClient.id);
      toast({
        title: 'Cliente removido',
        description: `${selectedClient.name} foi removido do sistema`,
      });
      setDeleteDialogOpen(false);
      setSelectedClient(null);
    }
  };

  const openDeleteDialog = (client: Client) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
  };

  const handleImportClients = (data: ExcelClient[], options?: { updateDuplicates?: boolean }) => {
    let imported = 0;
    let updated = 0;
    
    data.forEach((item) => {
      // Check if client with this NIF already exists
      const existingClient = clients.find(c => c.nif.toLowerCase().trim() === item.nif.toLowerCase().trim());
      
      if (existingClient && options?.updateDuplicates) {
        // Update existing client
        saveClient({
          ...existingClient,
          name: item.nome,
          phone: item.telefone || existingClient.phone,
          email: item.email || existingClient.email,
          address: item.morada || existingClient.address,
          city: item.cidade || existingClient.city,
          country: item.pais || existingClient.country,
          creditLimit: item.limiteCredito ?? existingClient.creditLimit,
        });
        updated++;
      } else if (!existingClient) {
        // Create new client
        createClient({
          name: item.nome,
          nif: item.nif,
          phone: item.telefone || '',
          email: item.email || '',
          address: item.morada || '',
          city: item.cidade || '',
          country: item.pais || 'Angola',
          creditLimit: item.limiteCredito || 0,
          currentBalance: 0,
          isActive: true,
        });
        imported++;
      }
    });
    
    const messages: string[] = [];
    if (imported > 0) messages.push(`${imported} novos`);
    if (updated > 0) messages.push(`${updated} actualizados`);
    
    toast({
      title: 'Importação concluída',
      description: messages.join(', ') || 'Nenhum registo importado',
    });
  };

  // Get existing NIFs for duplicate detection
  const existingNifs = clients.map(c => c.nif);

  const clientImportColumns: { key: keyof ExcelClient; label: string }[] = [
    { key: 'nome', label: 'Nome' },
    { key: 'nif', label: 'NIF' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'email', label: 'Email' },
    { key: 'cidade', label: 'Cidade' },
  ];

  // Only main office can manage clients
  if (!isMainOffice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Building className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          O registo de clientes está disponível apenas na sede principal. 
          Entre em contacto com a administração para registar novos clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Registo de Clientes</h1>
          <p className="text-muted-foreground">Gestão centralizada de clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Excel
          </Button>
          <Button variant="outline" onClick={() => exportClientsToExcel(clients)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-muted-foreground">
              {clients.filter(c => c.isActive).length} ativos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Limite de Crédito Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(clients.reduce((sum, c) => sum + c.creditLimit, 0))}
            </div>
            <p className="text-xs text-muted-foreground">disponibilizado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(clients.reduce((sum, c) => sum + c.currentBalance, 0))}
            </div>
            <p className="text-xs text-muted-foreground">a receber</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Pesquisar por nome, NIF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Todos os clientes registados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Limite Crédito</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map(client => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.nif}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell>{client.city || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.creditLimit)}</TableCell>
                    <TableCell className="text-right">
                      <span className={client.currentBalance > 0 ? 'text-destructive' : ''}>
                        {formatCurrency(client.currentBalance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.isActive ? 'default' : 'secondary'}>
                        {client.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(client)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openDeleteDialog(client)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            <DialogDescription>
              {selectedClient ? 'Atualize os dados do cliente' : 'Preencha os dados para registar um novo cliente'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo ou empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nif">NIF *</Label>
                <Input
                  id="nif"
                  value={formData.nif}
                  onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                  placeholder="Número fiscal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+244 9XX XXX XXX"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">Morada</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Endereço completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Luanda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Limite de Crédito (Kz)</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {selectedClient ? 'Guardar Alterações' : 'Registar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja remover {selectedClient?.name}? 
              Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excel Import Dialog */}
      <ExcelImportDialog<ExcelClient>
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importar Clientes"
        description="Importe clientes a partir de um ficheiro Excel ou CSV"
        parseFile={parseClientsFromExcel}
        validateData={validateImportedClients}
        onImport={handleImportClients}
        downloadTemplate={downloadClientImportTemplate}
        columns={clientImportColumns}
        duplicateKey="nif"
        existingKeys={existingNifs}
        duplicateLabel="NIF"
        mappingType="clients"
      />
    </div>
  );
}
