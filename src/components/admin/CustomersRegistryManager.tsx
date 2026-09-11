'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Users,
  Crown,
  Star,
  UserCheck,
  UserMinus,
  Search,
  Download,
  Upload,
  Copy,
  Check,
  MessageCircle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShoppingBag,
  DollarSign,
  FileText,
  ExternalLink,
} from 'lucide-react';
import type { Customer, Order } from '@/payload-types';
import type { CustomerKpis } from '@/lib/analytics';
import {
  fetchCustomersPage,
  fetchCustomerKpis,
  fetchSegmentPhones,
  exportSegmentCustomersCsvData,
  importCustomersBatch,
  updateCustomerNotes,
  updateCustomerTag,
  fetchCustomerOrders,
  type ImportCustomerItem,
  type ImportBatchResult,
} from '@/app/actions/admin-customers';
import {
  normalizeCustomerPhone,
  buildCustomerWhatsAppUrl,
  computeCustomerSegment,
} from '@/lib/customers';
import { parseCSVLine, detectCsvDelimiter, sanitizeCsvCell } from '@/lib/csv';

function isCsvHeaderRow(cols: string[]): boolean {
  if (cols.length === 0) return false;
  const col0 = (cols[0] || '').toLowerCase().trim();
  const col1 = (cols[1] || '').toLowerCase().trim();
  return (
    (col0.includes('nombre') || col0.includes('name') || col0 === 'cliente') &&
    (col1.includes('tel') || col1.includes('phone') || col1.includes('whatsapp') || isNaN(Number(col1.replace(/\D/g, ''))) || col1.length < 5)
  );
}

interface CustomersRegistryManagerProps {
  initialCustomers: Customer[];
  initialKpis: CustomerKpis;
  tenantSlug: string;
  tenantName: string;
  tenantId: number | string;
}

type SegmentFilter = 'all' | 'vip' | 'frecuente' | 'nuevo' | 'inactivo';

export function CustomersRegistryManager({
  initialCustomers,
  initialKpis,
  tenantSlug,
  tenantName,
  tenantId,
}: CustomersRegistryManagerProps) {
  // Estado de lista y filtros
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [kpis, setKpis] = useState<CustomerKpis>(initialKpis);
  const [activeSegment, setActiveSegment] = useState<SegmentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'-totalSpent' | 'totalSpent' | '-totalOrders' | '-lastOrderAt' | 'name'>('-totalSpent');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(initialCustomers.length);
  const [isPending, startTransition] = useTransition();

  // Ficha de detalle (Drawer / Modal)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingTag, setUpdatingTag] = useState(false);

  // Generador de mensajes WhatsApp
  const [waTemplate, setWaTemplate] = useState<'general' | 'vip' | 'reactivacion' | 'seguimiento'>('general');
  const [customWaMessage, setCustomWaMessage] = useState('');

  // Modal de importación CSV
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importInputText, setImportInputText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportBatchResult | null>(null);

  // Feedback de copiado para difusiones y exportación
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [copyingPhones, setCopyingPhones] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Debounce de búsqueda (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Carga de página con filtros y búsqueda
  const loadCustomers = useCallback(async (targetPage = 1, currentSegment = activeSegment, currentSearch = debouncedSearch, currentSort = sortBy) => {
    startTransition(async () => {
      try {
        const res = await fetchCustomersPage({
          page: targetPage,
          segment: currentSegment,
          search: currentSearch,
          sort: currentSort,
        });
        setCustomers(res.docs);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalDocs(res.totalDocs);
      } catch (err) {
        console.error('Error cargando compradores:', err);
      }
    });
  }, [activeSegment, debouncedSearch, sortBy]);

  // Recargar cuando cambian los filtros
  useEffect(() => {
    loadCustomers(page, activeSegment, debouncedSearch, sortBy);
  }, [page, activeSegment, debouncedSearch, sortBy, loadCustomers]);

  // Carga de pedidos al abrir la ficha del cliente
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([]);
      setNotesInput('');
      return;
    }
    setNotesInput(selectedCustomer.notes || '');

    const phone = selectedCustomer.phone;
    if (!phone) return;

    let cancelled = false;
    setLoadingOrders(true);
    fetchCustomerOrders(phone)
      .then((orders) => {
        if (!cancelled) setCustomerOrders(orders);
      })
      .catch((err) => console.error('Error al consultar pedidos del cliente:', err))
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCustomer]);

  // Actualización de plantilla de mensaje para WhatsApp
  useEffect(() => {
    if (!selectedCustomer) return;
    const name = selectedCustomer.name || 'estimado cliente';
    if (waTemplate === 'general') {
      setCustomWaMessage(`¡Hola ${name}! Te escribimos de ${tenantName}. ¿Cómo estás?`);
    } else if (waTemplate === 'vip') {
      setCustomWaMessage(`¡Hola ${name}! Como cliente especial y VIP de ${tenantName}, tenemos un beneficio exclusivo para tu próxima compra. ¿Te gustaría conocerlo?`);
    } else if (waTemplate === 'reactivacion') {
      setCustomWaMessage(`¡Hola ${name}! Hace tiempo que no ordenas en ${tenantName}. Te dejamos nuestro catálogo actualizado para que conozcas las novedades.`);
    } else if (waTemplate === 'seguimiento') {
      setCustomWaMessage(`¡Hola ${name}! Te contactamos de ${tenantName} para saber cómo fue tu experiencia con tu último pedido. ¡Tu opinión nos importa mucho!`);
    }
  }, [waTemplate, selectedCustomer, tenantName]);

  // Guardar notas del cliente
  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    setSavingNotes(true);
    try {
      const res = await updateCustomerNotes(selectedCustomer.id, notesInput);
      if (res.success) {
        setSelectedCustomer((prev) => (prev ? { ...prev, notes: notesInput } : null));
        setCustomers((prev) =>
          prev.map((c) => (c.id === selectedCustomer.id ? { ...c, notes: notesInput } : c))
        );
      }
    } finally {
      setSavingNotes(false);
    }
  };

  // Actualizar segmento del cliente con refresco autoritativo de KPIs y vista
  const handleUpdateTag = async (newTag: 'nuevo' | 'frecuente' | 'vip' | 'inactivo') => {
    if (!selectedCustomer) return;
    setUpdatingTag(true);
    try {
      const res = await updateCustomerTag(selectedCustomer.id, newTag);
      if (res.success) {
        setSelectedCustomer((prev) => (prev ? { ...prev, tag: newTag } : null));

        // Refrescar KPIs de forma autoritativa desde la base de datos
        fetchCustomerKpis(tenantId).then((newKpis) => {
          if (newKpis) setKpis(newKpis);
        });

        // Recargar una página válida si el cliente puede salir del segmento activo
        loadCustomers(activeSegment === 'all' ? page : 1);
      }
    } finally {
      setUpdatingTag(false);
    }
  };

  // Copiar teléfonos para lista de difusión de WhatsApp de TODO el segmento filtrado (no solo la página actual)
  const handleCopyPhones = async () => {
    setCopyingPhones(true);
    try {
      const phones = await fetchSegmentPhones({
        segment: activeSegment,
        search: debouncedSearch,
        maxLimit: 1000,
      });

      if (phones.length === 0) {
        setCopyToast('No hay teléfonos válidos en este segmento.');
        setTimeout(() => setCopyToast(null), 3000);
        return;
      }

      const textToCopy = phones.join(', ');
      await navigator.clipboard.writeText(textToCopy);
      setCopyToast(`¡${phones.length} teléfonos copiados para lista de difusión!`);
      setTimeout(() => setCopyToast(null), 3500);
    } catch (err) {
      console.error('Error copiando teléfonos para difusión:', err);
      setCopyToast('Error al copiar teléfonos');
      setTimeout(() => setCopyToast(null), 3000);
    } finally {
      setCopyingPhones(false);
    }
  };

  // Exportar TODOS los registros que coincidan con los filtros activos a CSV (hasta 1,000 registros)
  const handleExportCSV = async () => {
    setExportingCsv(true);
    try {
      const records = await exportSegmentCustomersCsvData({
        segment: activeSegment,
        search: debouncedSearch,
        maxLimit: 1000,
      });

      if (records.length === 0) {
        setCopyToast('No hay registros para exportar en este filtro.');
        setTimeout(() => setCopyToast(null), 3000);
        return;
      }

      const formatCsvCell = (val: string | number | null | undefined): string => {
        if (typeof val === 'number') return String(val);
        const sanitized = sanitizeCsvCell(val != null ? String(val) : '');
        return `"${sanitized.replace(/"/g, '""')}"`;
      };

      const headers = ['Nombre', 'Telefono', 'Email', 'Segmento', 'Total Pedidos', 'Total Gastado USD', 'Ultimo Pedido', 'Notas'];
      const rows = records.map((c) => [
        formatCsvCell(c.name),
        formatCsvCell(c.phone),
        formatCsvCell(c.email),
        formatCsvCell(c.tag || 'nuevo'),
        c.totalOrders ?? 0,
        (c.totalSpent ?? 0).toFixed(2),
        c.lastOrderAt ? formatCsvCell(new Date(c.lastOrderAt).toLocaleDateString('es-VE')) : '""',
        formatCsvCell(c.notes),
      ]);

      const csvContent = [headers.map(formatCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `compradores_${tenantSlug}_${activeSegment}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exportando CSV:', err);
    } finally {
      setExportingCsv(false);
    }
  };

  const MAX_IMPORT_FILE_BYTES = 1024 * 1024; // 1 MB máximo para archivo cargado
  const MAX_IMPORT_TEXT_CHARS = 200000;      // 200,000 caracteres para texto pegado
  const MAX_IMPORT_ITEMS_LIMIT = 250;        // Máximo 250 contactos por lote

  // Procesar e importar texto o CSV
  const handleImportSubmit = async () => {
    if (!importInputText.trim()) return;

    if (importInputText.length > MAX_IMPORT_TEXT_CHARS) {
      setImportResult({
        success: false,
        createdCount: 0,
        updatedCount: 0,
        errors: ['El texto a importar excede el límite máximo permitido de 200,000 caracteres.'],
      });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const lines = importInputText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        setImportResult({
          success: false,
          createdCount: 0,
          updatedCount: 0,
          errors: ['No se detectó contenido para importar.'],
        });
        return;
      }

      // Detectar delimitador analizando la primera línea
      const delimiter = detectCsvDelimiter(lines[0]);
      const parsedItems: ImportCustomerItem[] = [];

      // Si la primera fila es encabezado (ej. CSV exportado previamente), omitirla
      const firstRowCols = parseCSVLine(lines[0], delimiter);
      const isHeader = isCsvHeaderRow(firstRowCols);
      const startIndex = isHeader ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i], delimiter);
        if (parts.length >= 2) {
          const name = parts[0]?.trim();
          const phone = parts[1]?.trim();

          let email: string | undefined = undefined;
          let notes: string | undefined = undefined;

          if (parts.length >= 8) {
            // Formato exportado completo del directorio (8 columnas)
            email = parts[2]?.trim() || undefined;
            notes = parts[7]?.trim() || parts[3]?.trim() || undefined;
          } else if (parts.length >= 4) {
            // Formato estándar de ingesta (Nombre, Teléfono, Email, Notas)
            email = parts[2]?.trim() || undefined;
            notes = parts[3]?.trim() || undefined;
          } else if (parts.length === 3) {
            const third = parts[2]?.trim();
            if (third && third.includes('@')) {
              email = third;
            } else if (third) {
              notes = third;
            }
          }

          if (name && phone) {
            parsedItems.push({ name, phone, email, notes });
          }
        }
      }

      if (parsedItems.length === 0) {
        setImportResult({
          success: false,
          createdCount: 0,
          updatedCount: 0,
          errors: ['No se detectaron filas válidas con formato "Nombre, Teléfono".'],
        });
        return;
      }

      if (parsedItems.length > MAX_IMPORT_ITEMS_LIMIT) {
        setImportResult({
          success: false,
          createdCount: 0,
          updatedCount: 0,
          errors: [
            `El lote contiene ${parsedItems.length} contactos. El máximo permitido por importación es de ${MAX_IMPORT_ITEMS_LIMIT} contactos.`,
          ],
        });
        return;
      }

      const res = await importCustomersBatch(parsedItems, tenantId);
      setImportResult(res);

      if (res.success) {
        // Recargar clientes y primera página
        loadCustomers(1);
        // Refrescar tarjetas de resumen KPI del servidor
        fetchCustomerKpis(tenantId).then((newKpis) => {
          if (newKpis) setKpis(newKpis);
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la importación';
      setImportResult({
        success: false,
        createdCount: 0,
        updatedCount: 0,
        errors: [msg],
      });
    } finally {
      setImporting(false);
    }
  };

  // Manejador para carga de archivo CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setImportResult({
        success: false,
        createdCount: 0,
        updatedCount: 0,
        errors: ['El archivo seleccionado excede el límite máximo de 1 MB.'],
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        if (text.length > MAX_IMPORT_TEXT_CHARS) {
          setImportResult({
            success: false,
            createdCount: 0,
            updatedCount: 0,
            errors: ['El contenido del archivo supera los 200,000 caracteres permitidos.'],
          });
          return;
        }
        setImportInputText(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 text-zinc-100">
      {/* 1. Tarjetas de Resumen KPI (Estilo Shopify High-Density) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Clientes */}
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Total</span>
            <Users className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{kpis.totalCustomers}</div>
          <span className="text-[10px] text-zinc-500 mt-1">Registrados en tienda</span>
        </div>

        {/* VIP */}
        <div className="p-4 bg-zinc-950 border border-amber-900/40 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">👑 VIP</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">{kpis.vipCount}</div>
          <span className="text-[10px] text-zinc-500 mt-1">≥3 compras o ≥$50</span>
        </div>

        {/* Recurrentes */}
        <div className="p-4 bg-zinc-950 border border-blue-900/40 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">⭐ Frecuentes</span>
            <Star className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-300">{kpis.recurrentCount}</div>
          <span className="text-[10px] text-zinc-500 mt-1">2 pedidos realizados</span>
        </div>

        {/* Nuevos */}
        <div className="p-4 bg-zinc-950 border border-emerald-900/40 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">🟢 Nuevos</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">{kpis.newCount}</div>
          <span className="text-[10px] text-zinc-500 mt-1">1er pedido en &lt;60d</span>
        </div>

        {/* Inactivos */}
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">⚪ Inactivos</span>
            <UserMinus className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-400">{kpis.inactiveCount}</div>
          <span className="text-[10px] text-zinc-500 mt-1">&gt;60 días sin compra</span>
        </div>

        {/* Ticket Promedio LTV */}
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Ticket Prom.</span>
            <DollarSign className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">${kpis.averageLtv.toFixed(1)}</div>
          <span className="text-[10px] text-zinc-500 mt-1">${kpis.totalSpentUSD.toFixed(0)} total facturado</span>
        </div>
      </div>

      {/* 2. Barra de Herramientas y Filtros */}
      <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-none space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Pestañas de Segmentos estilo Shopify */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {(
              [
                { key: 'all', label: 'Todos', count: kpis.totalCustomers },
                { key: 'vip', label: '👑 VIP', count: kpis.vipCount },
                { key: 'frecuente', label: '⭐ Recurrentes', count: kpis.recurrentCount },
                { key: 'nuevo', label: '🟢 Nuevos', count: kpis.newCount },
                { key: 'inactivo', label: '⚪ Inactivos', count: kpis.inactiveCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveSegment(tab.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-mono transition-colors whitespace-nowrap cursor-pointer rounded-none border ${
                  activeSegment === tab.key
                    ? 'bg-zinc-800 border-zinc-600 text-white font-semibold'
                    : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {tab.label} <span className="text-[10px] text-zinc-500 ml-1">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Acciones Rápidas de Barra Superior */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Copiar para WhatsApp Broadcast */}
            <button
              type="button"
              disabled={copyingPhones}
              onClick={handleCopyPhones}
              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 inline-flex items-center gap-1.5 transition rounded-none cursor-pointer disabled:opacity-50"
              title="Copiar todos los números del segmento para lista de difusión"
            >
              {copyingPhones ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden sm:inline">Copiar Difusión</span>
            </button>

            {/* Importar Contactos */}
            <button
              type="button"
              onClick={() => {
                setIsImportOpen(true);
                setImportResult(null);
              }}
              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 inline-flex items-center gap-1.5 transition rounded-none cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Importar</span>
            </button>

            {/* Exportar CSV */}
            <button
              type="button"
              disabled={exportingCsv}
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 inline-flex items-center gap-1.5 transition rounded-none cursor-pointer disabled:opacity-50"
            >
              {exportingCsv ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Buscador y Selector de Orden */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-zinc-900">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o correo..."
              className="w-full bg-black border border-zinc-800 pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 rounded-none font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-black border border-zinc-800 px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 rounded-none font-mono"
            >
              <option value="-totalSpent">Mayor gasto ($)</option>
              <option value="totalSpent">Menor gasto ($)</option>
              <option value="-totalOrders">Más pedidos</option>
              <option value="-lastOrderAt">Última compra reciente</option>
              <option value="name">Nombre (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Toast de confirmación de copiado */}
      {copyToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-2.5 text-xs font-mono shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* 3. Lista de Clientes (Desktop Table + Mobile Cards) */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-none overflow-hidden">
        {isPending ? (
          <div className="p-16 text-center text-xs text-zinc-500 font-mono flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
            <span>Actualizando directorio de compradores...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-16 text-center text-xs text-zinc-500 font-mono space-y-2">
            <Users className="w-8 h-8 text-zinc-600 mx-auto stroke-1" />
            <p className="text-zinc-400 font-semibold">No se encontraron clientes</p>
            <p className="text-zinc-600">
              {searchQuery
                ? `No hay coincidencias para "${searchQuery}". Intenta con otro término.`
                : 'Aún no hay clientes registrados en este segmento.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table (≥ md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-black text-[10px] uppercase tracking-[0.14em] text-zinc-400 font-mono">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Teléfono / WhatsApp</th>
                    <th className="px-4 py-3">Segmento</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total Gastado</th>
                    <th className="px-4 py-3">Última Compra</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const segment = computeCustomerSegment(customer);
                    const cleanPhone = normalizeCustomerPhone(customer.phone);
                    const waUrl = buildCustomerWhatsAppUrl(
                      cleanPhone,
                      `¡Hola ${customer.name || ''}! Te escribimos de ${tenantName}.`
                    );

                    return (
                      <tr
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50 transition cursor-pointer group"
                      >
                        {/* Nombre y correo */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white group-hover:text-zinc-100 flex items-center gap-1.5">
                            {customer.name}
                          </p>
                          {customer.email ? (
                            <span className="text-[11px] text-zinc-500 truncate block max-w-[180px]">
                              {customer.email}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono">Sin correo</span>
                          )}
                        </td>

                        {/* Teléfono y WhatsApp rápido */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-zinc-300">{customer.phone}</span>
                            {cleanPhone && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Escribir a ${customer.name} por WhatsApp`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-400 text-[10px] font-semibold transition"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WA</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Segmento RFM */}
                        <td className="px-4 py-3">
                          {segment === 'vip' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-mono bg-amber-950/60 border border-amber-800/60 text-amber-300">
                              👑 VIP
                            </span>
                          )}
                          {segment === 'frecuente' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-mono bg-blue-950/60 border border-blue-800/60 text-blue-300">
                              ⭐ Frecuente
                            </span>
                          )}
                          {segment === 'nuevo' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                              🟢 Nuevo
                            </span>
                          )}
                          {segment === 'inactivo' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                              ⚪ Inactivo
                            </span>
                          )}
                        </td>

                        {/* Pedidos */}
                        <td className="px-4 py-3 text-right font-mono text-zinc-200">
                          {customer.totalOrders ?? 0}
                        </td>

                        {/* Total gastado */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-white">
                          ${(customer.totalSpent ?? 0).toFixed(2)}
                        </td>

                        {/* Última compra */}
                        <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                          {customer.lastOrderAt ? (
                            new Date(customer.lastOrderAt).toLocaleDateString('es-VE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(customer)}
                            className="px-2.5 py-1 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono transition"
                          >
                            Ver Ficha →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (< md) */}
            <div className="md:hidden divide-y divide-zinc-800/60">
              {customers.map((customer) => {
                const segment = computeCustomerSegment(customer);
                const cleanPhone = normalizeCustomerPhone(customer.phone);
                const waUrl = buildCustomerWhatsAppUrl(
                  cleanPhone,
                  `¡Hola ${customer.name || ''}! Te escribimos de ${tenantName}.`
                );

                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="p-4 space-y-3 hover:bg-zinc-900/40 transition active:bg-zinc-900 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">{customer.name}</h4>
                        <p className="text-xs text-zinc-400 font-mono">{customer.phone}</p>
                      </div>

                      {/* Badge de segmento */}
                      <div>
                        {segment === 'vip' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-amber-950/60 border border-amber-800/60 text-amber-300">
                            👑 VIP
                          </span>
                        )}
                        {segment === 'frecuente' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-blue-950/60 border border-blue-800/60 text-blue-300">
                            ⭐ Frecuente
                          </span>
                        )}
                        {segment === 'nuevo' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                            🟢 Nuevo
                          </span>
                        )}
                        {segment === 'inactivo' && (
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                            ⚪ Inactivo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats rápidas */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/60 p-2 border border-zinc-800/80">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase">Pedidos:</span>
                        <span className="text-zinc-200 font-bold">{customer.totalOrders ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase">Gasto Total:</span>
                        <span className="text-emerald-400 font-bold">${(customer.totalSpent ?? 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Botones de acción móvil */}
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      {cleanPhone ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Escribir por WhatsApp</span>
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(customer)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300"
                      >
                        Ficha
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 4. Paginación */}
        {totalPages > 1 && (
          <div className="p-3 bg-black border-t border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>
              Página {page} de {totalPages} ({totalDocs} clientes)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1 || isPending}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-200 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages || isPending}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-200 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modal / Drawer: Ficha del Comprador */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-zinc-950 border-l border-zinc-800 h-full overflow-y-auto flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-6 space-y-6">
              {/* Header de la Ficha */}
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedCustomer.name}</h3>
                    {selectedCustomer.tag === 'vip' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-950 border border-amber-700 text-amber-300 font-bold">
                        👑 VIP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">{selectedCustomer.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selector interactivo de etiqueta manual */}
              <div className="bg-black p-3.5 border border-zinc-800 space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
                  Etiqueta Manual de Clasificación
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCustomer.tag || 'nuevo'}
                    disabled={updatingTag}
                    onChange={(e) => handleUpdateTag(e.target.value as 'nuevo' | 'frecuente' | 'vip' | 'inactivo')}
                    className="bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 px-3 py-1.5 focus:outline-none focus:border-zinc-500 rounded-none flex-1"
                  >
                    <option value="nuevo">🟢 Nuevo Cliente</option>
                    <option value="frecuente">⭐ Cliente Frecuente</option>
                    <option value="vip">👑 Cliente VIP</option>
                    <option value="inactivo">⚪ Inactivo / En Riesgo</option>
                  </select>
                  {updatingTag && <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />}
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Asigna una etiqueta manual. Clientes con actividad alta (≥3 pedidos o ≥$50) califican automáticamente como VIP en las métricas y filtros del sistema.
                </p>
              </div>

              {/* Indicadores Financieros */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-black border border-zinc-800">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">Total Pedidos</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {selectedCustomer.totalOrders ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-black border border-zinc-800">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">Gasto Total</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    ${(selectedCustomer.totalSpent ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-black border border-zinc-800">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">Ticket Promedio</span>
                  <span className="text-lg font-bold font-mono text-blue-400">
                    $
                    {(selectedCustomer.totalOrders && selectedCustomer.totalOrders > 0
                      ? (selectedCustomer.totalSpent ?? 0) / selectedCustomer.totalOrders
                      : 0
                    ).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Generador de Mensajes WhatsApp */}
              <div className="bg-black border border-zinc-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    Escribir por WhatsApp
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">wa.me</span>
                </div>

                {/* Plantillas */}
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: 'general', label: 'Contacto General' },
                      { key: 'vip', label: 'Beneficio VIP' },
                      { key: 'reactivacion', label: 'Reactivar Inactivo' },
                      { key: 'seguimiento', label: 'Seguimiento Pedido' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setWaTemplate(t.key)}
                      className={`px-2 py-1 text-[11px] font-mono border transition cursor-pointer ${
                        waTemplate === t.key
                          ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Mensaje editable */}
                <textarea
                  value={customWaMessage}
                  onChange={(e) => setCustomWaMessage(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-zinc-200 font-sans focus:outline-none focus:border-zinc-600 rounded-none resize-none"
                  placeholder="Mensaje personalizado para WhatsApp..."
                />

                <a
                  href={buildCustomerWhatsAppUrl(selectedCustomer.phone, customWaMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 transition rounded-none"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Abrir WhatsApp con este mensaje</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>

              {/* Historial de Pedidos */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-zinc-400" />
                  Historial de Pedidos Recientes
                </h4>

                {loadingOrders ? (
                  <div className="p-6 text-center text-xs font-mono text-zinc-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-zinc-400" />
                    Cargando pedidos del cliente...
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="p-4 bg-black border border-zinc-800 text-xs font-mono text-zinc-500 text-center">
                    No se encontraron órdenes registradas con este número.
                  </div>
                ) : (
                  <div className="border border-zinc-800 divide-y divide-zinc-900 bg-black">
                    {customerOrders.map((ord) => (
                      <div key={ord.id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold font-mono text-white">#{ord.orderNumber}</span>
                          <span className="text-[11px] text-zinc-500 block">
                            {new Date(ord.createdAt).toLocaleDateString('es-VE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-white block">
                            ${(Number(ord.totalAmount) || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">
                            {ord.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notas Internas del Comercio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <FileText className="w-4 h-4 text-zinc-400" />
                    Notas Internas del Comercio
                  </h4>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {notesInput.length} / 2000
                  </span>
                </div>

                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value.slice(0, 2000))}
                  rows={4}
                  placeholder="Escribe notas privadas sobre preferencias, direcciones o incidencias de este cliente..."
                  className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-zinc-200 font-sans focus:outline-none focus:border-zinc-600 rounded-none resize-none"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={handleSaveNotes}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-white transition disabled:opacity-40 cursor-pointer"
                  >
                    {savingNotes ? 'Guardando...' : 'Guardar Notas'}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer de la Ficha */}
            <div className="p-4 bg-black border-t border-zinc-800 flex justify-between items-center text-xs font-mono text-zinc-500">
              <span>ID: {selectedCustomer.id}</span>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal de Importación Masiva CSV */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 space-y-4 rounded-none shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-400" />
                Importar Contactos / Compradores
              </h3>
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Pega la lista o sube un archivo CSV. Los teléfonos se normalizarán automáticamente al formato WhatsApp de Venezuela (código 58). Máximo 250 contactos por lote.
            </p>

            {/* Selector de Archivo */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-zinc-400 block">Subir archivo .csv:</label>
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileUpload}
                className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:border file:border-zinc-700 file:text-xs file:font-mono file:bg-zinc-900 file:text-white hover:file:bg-zinc-800 cursor-pointer"
              />
            </div>

            {/* Texto directo */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-zinc-400 block">
                O pega el texto (Formato: <code className="text-zinc-300">Nombre, Teléfono, Email, Notas</code>):
              </label>
              <textarea
                value={importInputText}
                onChange={(e) => setImportInputText(e.target.value)}
                rows={6}
                placeholder="Carlos Pérez, 0414-1234567, carlos@email.com, Cliente frecuente&#10;María González, 0424-9876543, maria@email.com&#10;Juan Rodríguez, 584125556677"
                className="w-full bg-black border border-zinc-800 p-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-600 rounded-none resize-none"
              />
            </div>

            {/* Feedback de Importación */}
            {importResult && (
              <div
                className={`p-3 text-xs font-mono border ${
                  importResult.success
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                    : 'bg-red-950/60 border-red-800 text-red-200'
                }`}
              >
                <div className="font-bold mb-1">
                  {importResult.success ? '¡Importación completada!' : 'Hubo problemas con el lote:'}
                </div>
                <p>
                  Creados: {importResult.createdCount} · Actualizados: {importResult.updatedCount}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="list-disc list-inside mt-2 text-[11px] text-zinc-400 space-y-0.5 max-h-24 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Botones de acción del Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={importing || !importInputText.trim()}
                onClick={handleImportSubmit}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 border border-blue-600 text-xs font-mono text-white font-semibold transition disabled:opacity-40 cursor-pointer"
              >
                {importing ? 'Procesando...' : 'Comenzar Importación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
