import Link from 'next/link';
import { ShoppingBag, ArrowRight, ShieldCheck, Zap, Sparkles, MessageCircle, FileText, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-green-500 selection:text-black">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-green-500/20">
            <ShoppingBag className="w-5 h-5 text-slate-950" />
          </div>
          <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            StoreLink<span className="text-green-400">.saas</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-sm font-semibold text-slate-300 hover:text-white transition px-4 py-2 rounded-lg border border-slate-800 hover:border-slate-700"
          >
            Acceso Comerciantes
          </Link>
          <Link
            href="/demo"
            className="text-sm font-semibold bg-green-500 hover:bg-green-400 text-slate-950 px-4 py-2 rounded-lg transition shadow-md shadow-green-500/20"
          >
            Ver Tienda Demo
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-16 pb-20 max-w-5xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Plataforma Multi-Tenant para E-Commerce Conversacional
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-6">
          Crea catálogos PWA que venden directo por{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-300">
            WhatsApp y Trello
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Cada comerciante tiene su propio panel de control, subida de fotos sin límites, sincronización con el catálogo de Meta y pedidos organizados en Trello en tiempo real.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/admin"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-slate-950 font-bold px-8 py-4 rounded-xl text-base transition shadow-xl shadow-green-500/25 group"
          >
            Panel de Administración
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </Link>
          <Link
            href="/demo"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8 py-4 rounded-xl text-base border border-slate-800 transition"
          >
            Explorar Tienda Demo
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-16 border-t border-slate-900 bg-slate-950/50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4 text-green-400">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Checkout a WhatsApp</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Calcula los subtotales, suma los SKUs y genera un enlace preformateado que abre el WhatsApp del comerciante con todos los detalles listos.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Despacho Automático a Trello</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Cada pedido crea automáticamente una tarjeta en el tablero y lista de Trello del comercio correspondiente con cliente, ítems y nota de entrega.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Notas de Entrega en PDF</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Genera documentos PDF descargables al instante con el membrete, detalles del comprador, desglose de ítems y código de pedido.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-8 text-center text-xs text-slate-500">
        StoreLink SaaS Platform • Next.js 15, Payload CMS 3.0, PostgreSQL & Vercel
      </footer>
    </main>
  );
}
