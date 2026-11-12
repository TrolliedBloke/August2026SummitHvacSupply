import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronRight, HardHat, MapPin, Search, ShoppingCart, Store, Truck, Upload, UserRound, Wrench } from "lucide-react";
import { Container } from "@/components/ui";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "HVAC equipment, parts, and supplies | Summit HVAC Supply",
  description: "Shop HVAC equipment from Summit HVAC Supply with Newark pickup, Bay Area delivery, and trade pricing for approved contractors.",
  alternates: { canonical: "/" },
};

const categories = [
  ["Condensers", "/products?category=central-heat-pumps", "/products/catalog-official/tcl-27k-mz-odu-r-410a.jpg"],
  ["Furnaces", "/products?category=furnaces", "/site/sketches/furnace.png"],
  ["Air handlers", "/products?category=air-handlers", "/products/catalog-official/tcl24kahu.jpeg"],
  ["Mini splits", "/products?category=mini-splits", "/products/catalog-official/tcl-tpro-indoor-front.webp"],
  ["Line sets", "/products?category=line-sets", "/site/sketches/line-set.png"],
  ["Thermostats", "/products?category=controls", "/site/sketches/thermostat-controls.png"],
] as const;

const products = [
  { name: "TCL 27K MZ Outdoor Condenser", sku: "TCL-27K-MZ-ODU-R-454B", price: "$1,650.00", status: "In Stock", image: "/products/catalog-official/tcl-27k-mz-odu-r-410a.jpg", action: "Add to Cart" },
  { name: "TCL 12K Indoor Unit", sku: "TCL12KIDU", price: "$500.00", status: "In Stock", image: "/products/catalog-official/tcl12kidu-r-410a.jpeg", action: "Add to Cart" },
  { name: "Tosot 18K Outdoor Condenser", sku: "TOS18KODU", price: "$1,250.00", status: "Low Stock", image: "/products/catalog-official/tos18kodu-r-410a.jpeg", action: "Check availability" },
  { name: "Carrier 18K Indoor Unit", sku: "CARRIER-18K-IDU", price: "$600.00", status: "In Stock", image: "/products/catalog-official/carrier-fj5-family.webp", action: "Check availability" },
] as const;

function TrustPoint({ icon: Icon, title, body }: { icon: typeof Truck; title: string; body: string }) {
  return <div className="flex items-center gap-2.5"><Icon className="size-6 shrink-0 text-[#1F2A44]" strokeWidth={1.8} /><span><strong className="block text-[13px] font-semibold text-[#1F2A44]">{title}</strong><span className="block text-[12px] leading-4 text-slate-600">{body}</span></span></div>;
}

export default function HomePage() {
  return (
    <>
      <section className="bg-[#eaf0f7]"><div className="relative mx-auto min-h-[470px] max-w-[1538px] overflow-hidden lg:min-h-[500px]"><Image src="/site/generated/hero-suburban-condensers.png" alt="Residential HVAC condenser units beside a Bay Area home" fill priority sizes="100vw" className="object-cover object-[62%_center]" /><div className="absolute inset-0 bg-gradient-to-r from-[#eaf0f7] via-[#eaf0f7]/95 via-40% to-transparent" /><Container className="relative flex min-h-[470px] items-center py-12 lg:min-h-[500px]"><div className="max-w-[520px]"><h1 className="text-[clamp(2.65rem,5vw,4rem)] font-semibold leading-[.98] tracking-[-.045em] text-[#1F2A44]">HVAC equipment,<br />parts, and supplies.<br /><span className="text-[#d89416]">Ready when you are.</span></h1><p className="mt-5 max-w-[390px] text-[17px] font-medium leading-6 text-[#1F2A44]">Shop top brands with local pickup and delivery from our Newark branch.</p><Link href="/products" className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-[#e3a11b] px-5 text-sm font-semibold text-[#1F2A44] transition hover:bg-[#f2b52c]">Shop All Products <ArrowRight size={18} /></Link><div className="mt-7 flex flex-wrap gap-x-7 gap-y-4 border-t border-[#1F2A44]/15 pt-4"><TrustPoint icon={Truck} title="Newark pickup" body="Ready when confirmed" /><TrustPoint icon={MapPin} title="Bay Area delivery" body="Local routes from the branch" /><TrustPoint icon={BadgeCheck} title="Trade pricing" body="For approved contractors" /></div></div></Container></div></section>

      <section className="border-b border-slate-200 bg-white py-5"><Container><div className="grid gap-3 lg:grid-cols-[1fr_1.25fr]"><div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#1F2A44]"><Link href="/products" className="flex min-h-[74px] items-center gap-3 px-4 py-3 hover:bg-[#f2f5f8]"><UserRound className="size-6 text-[#1F2A44]" /><span><strong className="block text-sm text-[#1F2A44]">Shop retail</strong><span className="text-xs text-slate-600">List prices, no account needed</span></span></Link><Link href="/portal/login?next=/products" className="flex min-h-[74px] items-center gap-3 border-l border-[#1F2A44] px-4 py-3 hover:bg-[#f2f5f8]"><HardHat className="size-6 text-[#1F2A44]" /><span><strong className="block text-sm text-[#1F2A44]">Contractor sign-in</strong><span className="text-xs text-slate-600">Account pricing and ordering</span></span></Link></div><div className="flex flex-wrap items-center gap-3 rounded-md bg-[#1F2A44] px-4 py-3 text-white"><Wrench className="size-6 text-[#e3a11b]" /><div className="mr-auto"><strong className="block text-sm">Contractor ordering tools</strong><span className="text-xs text-white/75">Move faster on the next job.</span></div><Link href="/quick-order" className="inline-flex h-9 items-center gap-1.5 rounded border border-white/60 px-3 text-xs font-semibold hover:bg-white/10"><Search size={14} /> Quick order</Link><Link href="/quick-order?mode=csv" className="inline-flex h-9 items-center gap-1.5 rounded border border-white/60 px-3 text-xs font-semibold hover:bg-white/10"><Upload size={14} /> Upload CSV</Link></div></div></Container></section>

      <section className="bg-white py-9 sm:py-12"><Container><div className="grid gap-5 lg:grid-cols-[150px_1fr] lg:items-center"><div><h2 className="text-[26px] font-semibold leading-[1.05] tracking-[-.03em] text-[#1F2A44]">Shop by<br />Category</h2><span className="mt-3 block h-1 w-12 bg-[#e3a11b]" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{categories.map(([title, href, image]) => <Link key={title} href={href} className="group relative flex min-h-[132px] flex-col items-center justify-between rounded-md bg-[#edf2f7] px-3 py-3 transition hover:-translate-y-0.5 hover:bg-[#e5edf5]"><div className="relative h-[84px] w-full"><Image src={image} alt="" fill sizes="150px" className="object-contain" /></div><span className="flex w-full items-center justify-between text-sm font-semibold text-[#1F2A44]">{title}<ChevronRight size={18} /></span></Link>)}</div></div></Container></section>

      <section className="bg-white pb-12"><Container><div className="mb-3 flex items-end justify-between"><h2 className="text-[26px] font-semibold tracking-[-.03em] text-[#1F2A44]">Popular Products</h2><Link href="/products" className="hidden items-center gap-1 text-sm font-semibold text-[#b5770b] sm:inline-flex">View all products <ArrowRight size={16} /></Link></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <article key={product.sku} className="flex min-h-[360px] flex-col rounded-md border border-slate-200 bg-white p-3 shadow-[0_2px_7px_rgba(31,42,68,.08)]"><span className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${product.status === "Low Stock" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-emerald-400 bg-emerald-50 text-emerald-700"}`}>{product.status}</span><div className="relative mt-2 h-[152px] w-full"><Image src={product.image} alt="" fill sizes="260px" className="object-contain" /></div><h3 className="mt-2 text-[15px] font-semibold leading-5 text-[#1F2A44]">{product.name}</h3><p className="part-number mt-1 text-[11px] text-slate-500">{product.sku}</p><div className="mt-2"><span className="block text-lg font-semibold text-[#1F2A44]">{product.price}</span><span className="text-xs text-slate-500">List price</span></div><Link href={`/products?sku=${encodeURIComponent(product.sku)}`} className="mt-auto flex h-10 items-center justify-center gap-2 rounded border border-[#e3a11b] text-sm font-semibold text-[#a56c06] hover:bg-[#fff7e7]">{product.action === "Add to Cart" && <ShoppingCart size={16} />}{product.action}</Link></article>)}</div></Container></section>

      <section className="pb-12"><Container><div className="relative overflow-hidden rounded-xl bg-[#1F2A44] text-white"><Image src="/site/generated/contractor-will-call-counter.jpg" alt="Summit HVAC Supply will-call pickup counter" fill sizes="100vw" className="object-cover opacity-35" /><div className="relative flex min-h-[150px] flex-col justify-center gap-4 px-6 py-7 sm:flex-row sm:items-center sm:px-12"><div className="flex items-start gap-4"><Store className="mt-1 size-10 shrink-0 text-[#e3a11b]" strokeWidth={1.7} /><div><h2 className="text-2xl font-semibold tracking-[-.02em]">Will-call pickup in Newark.</h2><p className="mt-1 text-base text-white/80">Delivery across the Bay Area.</p></div></div><Link href="/locations/newark" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded border border-[#e3a11b] px-5 text-sm font-semibold text-[#f4c45d] hover:bg-white/10 sm:ml-auto">Learn More <ArrowRight size={17} /></Link></div></div></Container></section>
    </>
  );
}
