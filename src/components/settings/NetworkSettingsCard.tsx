import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Network,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Globe,
  RefreshCw,
  Search,
  Radio,
  Users,
} from 'lucide-react';
import { getApiUrl, setApiUrl, isLocalNetworkMode } from '@/lib/api/config';
import { toast } from 'sonner';
import type { DiscoveredServer } from '@/types/electron';

interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  serverInfo?: {
    status: string;
    timestamp: string;
    serverName?: string;
    connectedClients?: number;
  };
  error?: string;
}

export function NetworkSettingsCard() {
  const [serverUrl, setServerUrl] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isNetworkMode, setIsNetworkMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Server discovery state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [isElectron, setIsElectron] = useState(false);
  
  useEffect(() => {
    const currentUrl = getApiUrl();
    setServerUrl(currentUrl);
    setIsNetworkMode(isLocalNetworkMode());
    setIsElectron(!!window.electronAPI?.discovery);
  }, []);

  const handleUrlChange = (value: string) => {
    setServerUrl(value);
    setHasChanges(true);
    setTestResult(null);
  };

  const testConnection = async () => {
    if (!serverUrl) {
      toast.error('Por favor, insira o endereço do servidor');
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    const startTime = Date.now();

    try {
      // Normalize URL
      let url = serverUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      
      // Remove trailing slash
      url = url.replace(/\/$/, '');

      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          latency,
          serverInfo: data,
        });
        toast.success(`Conexão bem-sucedida! Latência: ${latency}ms`);
      } else {
        setTestResult({
          success: false,
          error: `Servidor respondeu com erro: ${response.status}`,
        });
        toast.error('Falha na conexão com o servidor');
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      let errorMessage = 'Não foi possível conectar ao servidor';
      
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        errorMessage = 'Tempo limite de conexão excedido (5s)';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Servidor não encontrado ou inacessível';
      }

      setTestResult({
        success: false,
        latency,
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveSettings = () => {
    if (!testResult?.success) {
      toast.error('Por favor, teste a conexão antes de salvar');
      return;
    }

    // Normalize URL before saving
    let url = serverUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    url = url.replace(/\/$/, '');

    setApiUrl(url);
    // Page will reload automatically
  };

  const resetToDefault = () => {
    setServerUrl('http://localhost:3000');
    setHasChanges(true);
    setTestResult(null);
    toast.info('Endereço resetado para padrão. Teste a conexão e salve.');
  };

  // Discover servers on local network (Electron or Mock)
  const discoverServers = async () => {
    setIsDiscovering(true);
    setDiscoveredServers([]);
    toast.info('Procurando servidores na rede local...');

    // Use Electron discovery if available
    if (window.electronAPI?.discovery) {
      try {
        const result = await window.electronAPI.discovery.scan(5000);
        
        if (result.success && result.servers.length > 0) {
          setDiscoveredServers(result.servers);
          toast.success(`Encontrado(s) ${result.servers.length} servidor(es)`);
        } else if (result.servers.length === 0) {
          toast.info('Nenhum servidor encontrado na rede');
        } else {
          toast.error(result.error || 'Erro na descoberta de servidores');
        }
      } catch (error: any) {
        toast.error('Falha na descoberta: ' + error.message);
      }
    } else {
      toast.info('Use o app desktop para descoberta automática');
    }
    
    setIsDiscovering(false);
  };
  
  // Select a discovered server
  const selectServer = (server: DiscoveredServer) => {
    const url = `http://${server.ip}:${server.port}`;
    setServerUrl(url);
    setHasChanges(true);
    setTestResult(null);
    toast.success(`Servidor selecionado: ${server.name}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          Configurações de Rede
        </CardTitle>
        <CardDescription>
          Conectar esta estação ao servidor central.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Mode */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {isNetworkMode ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-emerald-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Globe className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium">
                {isNetworkMode ? 'Modo Rede' : 'Modo Local'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isNetworkMode 
                  ? 'Conectado ao servidor central' 
                  : 'Usando armazenamento local (demo)'
                }
              </p>
            </div>
          </div>
          <Badge variant={isNetworkMode ? 'default' : 'secondary'}>
            {isNetworkMode ? 'Ativo' : 'Offline'}
          </Badge>
        </div>

        {/* Auto-Discovery Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Descoberta Automática
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={discoverServers}
              disabled={isDiscovering}
              className="gap-2"
            >
              {isDiscovering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procurando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Procurar Servidores
                </>
              )}
            </Button>
          </div>
          
          {/* Discovered Servers List */}
          {discoveredServers.length > 0 && (
            <ScrollArea className="h-[160px] rounded-lg border">
              <div className="p-2 space-y-2">
                {discoveredServers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => selectServer(server)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Server className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{server.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {server.ip}:{server.port}
                          {server.hostname && ` (${server.hostname})`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Users className="w-3 h-3" />
                        {server.connectedClients}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        v{server.version}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {isDiscovering && (
            <div className="flex items-center justify-center p-6 rounded-lg border border-dashed">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">
                  Procurando servidores Kwanza ERP na rede...
                </p>
              </div>
            </div>
          )}
        </div>
        
        <Separator />

        {/* Server URL Input */}
        <div className="space-y-3">
          <Label htmlFor="server-url">Endereço do Servidor</Label>
          <div className="flex gap-2">
            <Input
              id="server-url"
              placeholder="http://192.168.1.50:3000"
              value={serverUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={resetToDefault}
              title="Resetar para padrão"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isElectron
              ? 'Use a descoberta automática ou insira o IP manualmente'
              : 'Insira o IP do servidor principal (ex: http://192.168.1.50:3000)'}
          </p>
        </div>

        {/* Test Connection Button */}
        <Button
          variant="outline"
          onClick={testConnection}
          disabled={isTestingConnection || !serverUrl}
          className="w-full gap-2"
        >
          {isTestingConnection ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testando conexão...
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4" />
              Testar ligação
            </>
          )}
        </Button>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-destructive/10 border-destructive/30'
          }`}>
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p className={`font-medium ${
                  testResult.success ? 'text-emerald-600' : 'text-destructive'
                }`}>
                  {testResult.success ? 'Conexão bem-sucedida!' : 'Falha na conexão'}
                </p>
                {testResult.success ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Latência: {testResult.latency}ms</p>
                    {testResult.serverInfo?.serverName && (
                      <p>Servidor: {testResult.serverInfo.serverName}</p>
                    )}
                    {testResult.serverInfo?.connectedClients !== undefined && (
                      <p>Clientes conectados: {testResult.serverInfo.connectedClients}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-destructive/80">
                    {testResult.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Save Button */}
        <Button
          onClick={saveSettings}
          disabled={!testResult?.success || !hasChanges}
          className="w-full gap-2"
        >
          {testResult?.success && hasChanges ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Guardar e ligar
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              Teste a conexão primeiro
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
