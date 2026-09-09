'use client';

/**
 * PR 12 (SPEC-20260907-12, thermo D3): sección de métodos de pago del
 * cart-drawer, extraída y vuelta data-driven. Antes este bloque era ~500
 * líneas con CopyRow incrustado 17×, 7 botones de método casi idénticos y 5
 * formularios de verificación con la misma estructura — todo dentro del
 * cart-drawer de 1606 líneas.
 *
 * REGLA de la spec: los classNames viajan como LITERALES EXACTOS en los
 * arrays de config — el HTML generado es byte-idéntico al original (verificó
 * el smoke de checkout). Cero cambio visual, cero cambio de comportamiento.
 *
 * Este módulo es una hoja 'use client' (skill /payload §Next.js: marcar
 * 'use client' SOLO en las hojas interactivas) y NO usa APIs de Payload —
 * recibe toda la data serializada como props del drawer.
 */

import React from 'react';
import { Check, Copy, CreditCard, DollarSign, Smartphone, Camera } from 'lucide-react';

export type PaymentMethodKey =
  | 'pago_movil'
  | 'zelle'
  | 'binance'
  | 'zinli'
  | 'banesco_panama'
  | 'cash'
  | 'pos';

/** Claves del estado paymentVerification (forma compartida con el drawer). */
export interface PaymentVerificationState {
  issuingBank: string;
  issuingPhone: string;
  referenceNumber: string;
  senderName: string;
  senderEmail: string;
  binancePayId: string;
}

/** Una fila "copiar al portapapeles" de una card de cuenta. */
export interface CopyRowConfig {
  /** Etiqueta del campo (uppercase del original). */
  label: string;
  /** Valor a mostrar y copiar (ya resuelto por el caller). */
  value: string;
  /** Clave única para el estado copiedKey (misma que el original). */
  copyKey: string;
  /** Transformación del valor al COPIAR (ej. strip de guiones del RIF). */
  copyTransform?: (v: string) => string;
  /** Copiado / label del botón en reposo (originales: 'Copiar' | 'Copiar Monto' | 'Copiar ID' | 'Copiar N°'). */
  copyLabel?: string;
  /** Icono Check con clase propia de cada método (color de acento). */
  checkClass?: string;
  /** Clases extra del botón por fila (colores de acento del método). */
  buttonClass?: string;
  /** Clase del label (por defecto el gris del tema oscuro). */
  labelClass?: string;
  /** Última fila (monto): clases propias de la fila destacada. */
  amountRow?: boolean;
  amountLabelClass?: string;
  amountValueClass?: string;
  /** Texto visible de la fila de monto (solo filas amountRow). */
  amountValue?: string;
}

/** Card de cuenta de un método (header + filas CopyRow). */
export interface AccountCardConfig {
  method: PaymentMethodKey;
  /** Card entera (tema del método — literales exactos del original). */
  cardClass: string;
  headerBorderClass: string;
  headerLabelClass: string;
  headerLabel: string;
  rows: CopyRowConfig[];
}

/** Botón del grid de selección de método. */
export interface MethodButtonConfig {
  method: PaymentMethodKey;
  label: string;
  icon: React.ReactNode;
  iconClass: string;
  /** Clases del estado seleccionado (color por método). */
  selectedClass: string;
  /** Extra (pos ocupa 2 cols en móvil). */
  extraClass?: string;
}

/** Campo de un formulario de verificación. */
export interface VerificationFieldConfig {
  label: string;
  type: string;
  required?: boolean;
  placeholder: string;
  /** Clave del estado paymentVerification que edita. */
  stateKey: keyof PaymentVerificationState;
  /** Clases del input (font-mono para referencias — originales). */
  inputClass?: string;
  /** El select de bancos (pago_movil) — opciones literales. */
  selectOptions?: string[];
}

/** Formulario de verificación de un método. */
export interface VerificationFormConfig {
  method: PaymentMethodKey;
  title: string;
  /** Campos a ancho completo (apilados). */
  fields: VerificationFieldConfig[];
  /**
   * Campos que el original renderiza dentro de `grid grid-cols-2 gap-2`
   * (pago_movil: teléfono + referencia lado a lado). Se renderizan DESPUÉS
   * de `fields` para preservar el orden/DOM del original.
   */
  gridFields?: VerificationFieldConfig[];
}

/** Fila copy compartida — reemplaza las 17 incrustadas del original. */
export function CopyRow({
  row,
  copiedKey,
  onCopy,
}: {
  row: CopyRowConfig;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const copied = copiedKey === row.copyKey;
  const isAmount = row.amountRow === true;

  if (isAmount) {
    // Última fila (monto exacto): estructura propia del original.
    return (
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0">
          <span className={`text-[10px] font-bold block uppercase ${row.amountLabelClass ?? ''}`}>
            {row.label}
          </span>
          <span className={`font-mono font-black text-sm truncate ${row.amountValueClass ?? ''}`}>
            {row.amountValue}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onCopy(row.copyTransform ? row.copyTransform(row.value) : row.value, row.copyKey)}
          className={`active:scale-95 text-[10px] rounded-lg flex items-center gap-1 transition font-bold ${row.buttonClass ?? ''}`}
        >
          {copied ? (
            <Check className={`w-3 h-3 ${row.checkClass ?? ''}`} />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          <span>{copied ? 'Copiado' : (row.copyLabel ?? 'Copiar')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/60">
      <div className="min-w-0">
        <span className={`text-[10px] block uppercase ${row.labelClass ?? 'text-slate-400'}`}>
          {row.label}
        </span>
        <span className="font-mono font-bold text-white text-xs truncate">{row.value}</span>
      </div>
      <button
        type="button"
        onClick={() => onCopy(row.copyTransform ? row.copyTransform(row.value) : row.value, row.copyKey)}
        className={`px-2.5 py-1 hover:bg-slate-700 active:scale-95 text-[10px] rounded-lg flex items-center gap-1 transition font-bold ${row.buttonClass ?? 'bg-slate-800 text-slate-200'}`}
      >
        {copied ? <Check className={`w-3 h-3 ${row.checkClass ?? 'text-emerald-400'}`} /> : <Copy className="w-3 h-3" />}
        <span>{copied ? 'Copiado' : (row.copyLabel ?? 'Copiar')}</span>
      </button>
    </div>
  );
}

/** Grid de botones de selección de método (7 del original). */
export function PaymentMethodGrid({
  buttons,
  selected,
  onSelect,
}: {
  buttons: MethodButtonConfig[];
  selected: PaymentMethodKey;
  onSelect: (method: PaymentMethodKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {buttons.map((b) => (
        <button
          key={b.method}
          type="button"
          onClick={() => onSelect(b.method)}
          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${b.extraClass ?? ''} ${
            selected === b.method ? b.selectedClass : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
          }`}
        >
          {b.icon}
          <span className="text-xs">{b.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Card de cuenta del método seleccionado (header + CopyRows). */
export function AccountCard({
  card,
  copiedKey,
  onCopy,
}: {
  card: AccountCardConfig;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className={card.cardClass}>
      <div className={`${card.headerBorderClass} pb-1.5 flex items-center justify-between`}>
        <span className={`text-[11px] font-black uppercase tracking-wider ${card.headerLabelClass}`}>
          {card.headerLabel}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">Toca 'Copiar' en cada campo</span>
      </div>
      <div className="space-y-1 text-xs">
        {card.rows.map((row) => (
          <CopyRow key={row.copyKey} row={row} copiedKey={copiedKey} onCopy={onCopy} />
        ))}
      </div>
    </div>
  );
}

/** Formulario de verificación del método (5 del original). */
export function VerificationForm({
  form,
  state,
  onChange,
}: {
  form: VerificationFormConfig;
  state: PaymentVerificationState;
  onChange: (key: keyof PaymentVerificationState, value: string) => void;
}) {
  return (
    <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in duration-200">
      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
        {form.title}
      </span>
      {form.fields.map((f) => (
        <div key={f.stateKey}>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">{f.label}</label>
          {f.selectOptions ? (
            <select
              value={state[f.stateKey]}
              onChange={(e) => onChange(f.stateKey, e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {f.selectOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type}
              required={f.required}
              placeholder={f.placeholder}
              value={state[f.stateKey]}
              onChange={(e) => onChange(f.stateKey, e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${f.inputClass ?? 'font-medium'}`}
            />
          )}
        </div>
      ))}
      {(form.gridFields?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {form.gridFields?.map((f) => (
            <div key={f.stateKey}>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">{f.label}</label>
              <input
                type={f.type}
                required={f.required}
                placeholder={f.placeholder}
                value={state[f.stateKey]}
                onChange={(e) => onChange(f.stateKey, e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${f.inputClass ?? 'font-medium'}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Callout final de WhatsApp con cámara (del original, literal). */
export function WhatsAppProofCallout() {
  return (
    <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-950 shadow-xs">
      <Camera className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <span className="font-black block text-[11px] text-amber-900 uppercase tracking-wider">
          Paso Final por WhatsApp:
        </span>
        <p className="text-[11px] text-amber-800 leading-snug">
          Al pulsar "Confirmar y Enviar a WhatsApp", por favor adjunta la <strong>captura del comprobante de pago</strong> (o foto de los billetes) y comparte tu <strong>ubicación en tiempo real</strong> para coordinar la entrega.
        </p>
      </div>
    </div>
  );
}

export { Check, Copy, CreditCard, DollarSign, Smartphone };
