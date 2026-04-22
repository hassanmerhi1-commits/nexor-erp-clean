/**
 * Mock Server Simulator
 * Enables testing network functionality on a single computer
 */

import { Sale, Product, Branch, Client, Category, Supplier } from '@/types/erp';

interface MockServerConfig {
  simulatedLatency: number;
  failureRate: number;
  serverName: string;
  connectedClients: number;
}

interface MockServerState {
  isRunning: boolean;
  startedAt: string | null;
  requestCount: number;
  config: MockServerConfig;
}

// Mock server state
let mockState: MockServerState = {
  isRunning: false,
  startedAt: null,
  requestCount: 0,
  config: {
    simulatedLatency: 50,
    failureRate: 0,
    serverName: 'Mock Server (Local Test)',
    connectedClients: 1
  }
};

// Event listeners for real-time updates
type MockEventListener = (event: string, data: any) => void;
const listeners: Set<MockEventListener> = new Set();

/**
 * Start the mock server
 */
export function startMockServer(config?: Partial<MockServerConfig>): boolean {
  if (mockState.isRunning) {
    console.log('[MockServer] Already running');
    return true;
  }

  mockState = {
    isRunning: true,
    startedAt: new Date().toISOString(),
    requestCount: 0,
    config: { ...mockState.config, ...config }
  };

  // Store mock server flag
  localStorage.setItem('kwanza_mock_server', 'true');
  
  console.log('[MockServer] Started with config:', mockState.config);
  notifyListeners('server_started', { timestamp: mockState.startedAt });
  
  return true;
}

/**
 * Stop the mock server
 */
export function stopMockServer(): void {
  mockState.isRunning = false;
  mockState.startedAt = null;
  localStorage.removeItem('kwanza_mock_server');
  
  console.log('[MockServer] Stopped');
  notifyListeners('server_stopped', { timestamp: new Date().toISOString() });
}

/**
 * Check if mock server is running
 */
export function isMockServerRunning(): boolean {
  return mockState.isRunning || localStorage.getItem('kwanza_mock_server') === 'true';
}

/**
 * Get mock server status
 */
export function getMockServerStatus(): MockServerState {
  return { ...mockState };
}

/**
 * Configure mock server
 */
export function configureMockServer(config: Partial<MockServerConfig>): void {
  mockState.config = { ...mockState.config, ...config };
  console.log('[MockServer] Config updated:', mockState.config);
}

/**
 * Simulate network latency
 */
async function simulateLatency(): Promise<void> {
  const latency = mockState.config.simulatedLatency;
  if (latency > 0) {
    await new Promise(r => setTimeout(r, latency + Math.random() * 20));
  }
}

/**
 * Check for simulated failure
 */
function shouldFail(): boolean {
  return Math.random() < mockState.config.failureRate;
}

/**
 * Notify event listeners
 */
function notifyListeners(event: string, data: any): void {
  listeners.forEach(listener => {
    try {
      listener(event, data);
    } catch (e) {
      console.error('[MockServer] Listener error:', e);
    }
  });
}

/**
 * Subscribe to mock server events
 */
export function subscribeMockEvents(listener: MockEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ==================== MOCK API ENDPOINTS ====================

/**
 * Mock health check endpoint
 */
export async function mockHealthCheck(): Promise<{
  success: boolean;
  latency: number;
  serverInfo?: any;
  error?: string;
}> {
  const startTime = Date.now();
  await simulateLatency();
  
  if (!mockState.isRunning) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: 'Mock server não está em execução'
    };
  }

  if (shouldFail()) {
    return {
      success: false,
      latency: Date.now() - startTime,
      error: 'Falha simulada de conexão'
    };
  }

  mockState.requestCount++;

  return {
    success: true,
    latency: Date.now() - startTime,
    serverInfo: {
      status: 'online',
      timestamp: new Date().toISOString(),
      serverName: mockState.config.serverName,
      connectedClients: mockState.config.connectedClients,
      version: '1.0.0',
      uptime: mockState.startedAt ? Date.now() - new Date(mockState.startedAt).getTime() : 0
    }
  };
}

/**
 * Mock fetch for API requests
 */
export async function mockFetch<T>(
  endpoint: string,
  options?: { method?: string; body?: any }
): Promise<{ success: boolean; data?: T; error?: string }> {
  await simulateLatency();
  
  if (!mockState.isRunning) {
    return { success: false, error: 'Mock server offline' };
  }

  if (shouldFail()) {
    return { success: false, error: 'Simulated network error' };
  }

  mockState.requestCount++;
  notifyListeners('request', { endpoint, method: options?.method || 'GET' });

  // Route to appropriate handler
  const [, resource, action] = endpoint.split('/');
  
  try {
    switch (resource) {
      case 'health':
        return { success: true, data: await getMockHealth() as T };
      
      case 'products':
        return handleProductsEndpoint<T>(action, options);
      
      case 'sales':
        return handleSalesEndpoint<T>(action, options);
      
      case 'branches':
        return handleBranchesEndpoint<T>(action, options);
      
      case 'clients':
        return handleClientsEndpoint<T>(action, options);
      
      case 'categories':
        return handleCategoriesEndpoint<T>(action, options);
        
      default:
        return { success: true, data: { message: 'OK' } as T };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== ENDPOINT HANDLERS ====================

async function getMockHealth() {
  return {
    status: 'online',
    timestamp: new Date().toISOString(),
    serverName: mockState.config.serverName,
    connectedClients: mockState.config.connectedClients
  };
}

function handleProductsEndpoint<T>(action: string, options?: { method?: string; body?: any }): { success: boolean; data?: T; error?: string } {
  const products = JSON.parse(localStorage.getItem('kwanza_products') || '[]') as Product[];
  
  if (!action || options?.method === 'GET') {
    notifyListeners('sync', { table: 'products', count: products.length });
    return { success: true, data: products as T };
  }
  
  if (options?.method === 'POST' && options.body) {
    const newProduct = { ...options.body, id: `MOCK-${Date.now()}` };
    products.push(newProduct);
    localStorage.setItem('kwanza_products', JSON.stringify(products));
    notifyListeners('update', { table: 'products', action: 'create', item: newProduct });
    return { success: true, data: newProduct as T };
  }
  
  return { success: true, data: products as T };
}

function handleSalesEndpoint<T>(action: string, options?: { method?: string; body?: any }): { success: boolean; data?: T; error?: string } {
  const sales = JSON.parse(localStorage.getItem('kwanza_sales') || '[]') as Sale[];
  
  if (!action || options?.method === 'GET') {
    notifyListeners('sync', { table: 'sales', count: sales.length });
    return { success: true, data: sales as T };
  }
  
  if (options?.method === 'POST' && options.body) {
    const newSale = { ...options.body, id: `SALE-${Date.now()}` };
    sales.push(newSale);
    localStorage.setItem('kwanza_sales', JSON.stringify(sales));
    notifyListeners('update', { table: 'sales', action: 'create', item: newSale });
    return { success: true, data: newSale as T };
  }
  
  return { success: true, data: sales as T };
}

function handleBranchesEndpoint<T>(action: string, options?: { method?: string; body?: any }): { success: boolean; data?: T; error?: string } {
  const branches = JSON.parse(localStorage.getItem('kwanza_branches') || '[]') as Branch[];
  notifyListeners('sync', { table: 'branches', count: branches.length });
  return { success: true, data: branches as T };
}

function handleClientsEndpoint<T>(action: string, options?: { method?: string; body?: any }): { success: boolean; data?: T; error?: string } {
  const clients = JSON.parse(localStorage.getItem('kwanza_clients') || '[]') as Client[];
  notifyListeners('sync', { table: 'clients', count: clients.length });
  return { success: true, data: clients as T };
}

function handleCategoriesEndpoint<T>(action: string, options?: { method?: string; body?: any }): { success: boolean; data?: T; error?: string } {
  const categories = JSON.parse(localStorage.getItem('kwanza_categories') || '[]') as Category[];
  notifyListeners('sync', { table: 'categories', count: categories.length });
  return { success: true, data: categories as T };
}

// ==================== MOCK DISCOVERY ====================

/**
 * Get mock discovered servers (simulates network discovery)
 */
export function getMockDiscoveredServers() {
  if (!mockState.isRunning) {
    return [];
  }

  return [
    {
      id: 'mock-server-1',
      ip: '127.0.0.1',
      port: 3000,
      name: mockState.config.serverName,
      version: '1.0.0',
      branch: 'Main',
      connectedClients: mockState.config.connectedClients,
      hostname: 'localhost',
      discoveredAt: new Date().toISOString()
    }
  ];
}
