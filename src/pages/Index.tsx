import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

/* ─── DATA ─────────────────────────────────────────────── */
const BOUQUETS = [
  {
    id: 1,
    title: "Пионы и орхидеи",
    seller: "Анна М.",
    sellerRating: 4.9,
    image: "https://cdn.poehali.dev/projects/c3c15f66-a71a-4790-a1f7-f67719eb241e/files/c61aef2b-98ba-469f-a41b-a76133a65315.jpg",
    currentBid: 1450,
    minStep: 50,
    bids: 14,
    freshness: "вчера",
    tags: ["розы", "орхидеи", "пионы"],
    timeLeft: 3600 * 2 + 23 * 60 + 14,
    liked: false,
    hot: true,
  },
  {
    id: 2,
    title: "Подсолнухи + герберы",
    seller: "Лена К.",
    sellerRating: 4.7,
    image: "https://cdn.poehali.dev/projects/c3c15f66-a71a-4790-a1f7-f67719eb241e/files/96b3514a-96db-4789-9a80-ae6438a1d38e.jpg",
    currentBid: 680,
    minStep: 30,
    bids: 7,
    freshness: "сегодня",
    tags: ["подсолнухи", "герберы"],
    timeLeft: 45 * 60 + 8,
    liked: true,
    hot: false,
  },
  {
    id: 3,
    title: "Розы и тюльпаны",
    seller: "Маша Д.",
    sellerRating: 5.0,
    image: "https://cdn.poehali.dev/projects/c3c15f66-a71a-4790-a1f7-f67719eb241e/files/0ad5fbf1-b9db-4a95-8f62-4fa870aaf402.jpg",
    currentBid: 2100,
    minStep: 100,
    bids: 23,
    freshness: "сегодня",
    tags: ["розы", "тюльпаны"],
    timeLeft: 5 * 60 + 42,
    liked: false,
    hot: true,
  },
  {
    id: 4,
    title: "Каллы и белые розы",
    seller: "Ира С.",
    sellerRating: 4.8,
    image: "https://cdn.poehali.dev/projects/c3c15f66-a71a-4790-a1f7-f67719eb241e/files/0e96c88c-e176-44db-83f8-8cd57d76f562.jpg",
    currentBid: 890,
    minStep: 50,
    bids: 5,
    freshness: "вчера",
    tags: ["каллы", "розы"],
    timeLeft: 3600 * 5 + 12 * 60,
    liked: false,
    hot: false,
  },
];

const TABS = [
  { id: "auctions", label: "Аукционы", icon: "Zap" },
  { id: "catalog", label: "Каталог", icon: "Grid3X3" },
  { id: "sell", label: "Продать", icon: "PlusCircle" },
  { id: "orders", label: "Заказы", icon: "Package" },
  { id: "profile", label: "Профиль", icon: "User" },
];

const ALL_TAGS = ["все", "розы", "тюльпаны", "пионы", "орхидеи", "герберы", "каллы", "подсолнухи"];

/* ─── UTILS ─────────────────────────────────────────────── */
function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${String(s).padStart(2, "0")}с`;
  return `00:${String(s).padStart(2, "0")}`;
}

function formatPrice(n: number) {
  return n.toLocaleString("ru-RU") + " ₽";
}

/* ─── TIMER HOOK ─────────────────────────────────────────── */
function useTimers(initial: Record<number, number>) {
  const [timers, setTimers] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => {
      setTimers((prev) => {
        const next: Record<number, number> = {};
        for (const k in prev) next[k] = Math.max(0, prev[k] - 1);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return timers;
}

/* ─── BID MODAL ─────────────────────────────────────────── */
function BidModal({
  bouquet,
  onClose,
  onBid,
}: {
  bouquet: (typeof BOUQUETS)[0];
  onClose: () => void;
  onBid: (id: number, amount: number) => void;
}) {
  const [amount, setAmount] = useState(bouquet.currentBid + bouquet.minStep);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl p-6 w-full max-w-sm animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald text-xl font-bold text-white">{bouquet.title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <img src={bouquet.image} className="w-16 h-16 rounded-xl object-cover" />
          <div>
            <p className="text-white/50 text-sm">Текущая ставка</p>
            <p className="gradient-text font-oswald text-2xl font-bold">{formatPrice(bouquet.currentBid)}</p>
            <p className="text-white/40 text-xs">Шаг от {formatPrice(bouquet.minStep)}</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-white/60 text-sm mb-2 block">Ваша ставка</label>
          <div className="flex gap-2">
            <button
              className="glass rounded-xl px-3 py-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setAmount((a) => Math.max(bouquet.currentBid + bouquet.minStep, a - bouquet.minStep))}
            >
              <Icon name="Minus" size={16} />
            </button>
            <div className="flex-1 glass rounded-xl px-4 py-2 font-oswald text-xl text-center text-white font-bold">
              {formatPrice(amount)}
            </div>
            <button
              className="glass rounded-xl px-3 py-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setAmount((a) => a + bouquet.minStep)}
            >
              <Icon name="Plus" size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          {[1, 3, 5].map((x) => (
            <button
              key={x}
              className="flex-1 glass rounded-xl py-2 text-sm text-white/60 hover:text-white transition-colors"
              onClick={() => setAmount(bouquet.currentBid + bouquet.minStep * x)}
            >
              +{formatPrice(bouquet.minStep * x)}
            </button>
          ))}
        </div>
        <button
          className="btn-gradient w-full rounded-2xl py-4 mt-5 font-oswald text-lg tracking-wide animate-pulse-glow"
          onClick={() => { onBid(bouquet.id, amount); onClose(); }}
        >
          СДЕЛАТЬ СТАВКУ
        </button>
        <p className="text-center text-white/30 text-xs mt-3">
          Победитель аукциона обязуется оплатить ставку
        </p>
      </div>
    </div>
  );
}

/* ─── AUCTION CARD ───────────────────────────────────────── */
function AuctionCard({
  b, timer, onBid, onLike,
}: {
  b: (typeof BOUQUETS)[0];
  timer: number;
  onBid: () => void;
  onLike: () => void;
}) {
  const urgent = timer < 300;
  return (
    <div className="glass rounded-2xl overflow-hidden card-hover">
      <div className="relative">
        <img src={b.image} alt={b.title} className="w-full h-48 object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
        {b.hot && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white" style={{ background: "var(--neon-orange)" }}>
            <Icon name="Flame" size={11} />ХИТ
          </div>
        )}
        <button onClick={onLike} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full glass transition-all hover:scale-110">
          <Icon name="Heart" size={16} className={b.liked ? "text-pink-400 fill-pink-400" : "text-white/60"} />
        </button>
        <div
          className={`absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${urgent ? "animate-timer" : "text-white"}`}
          style={{ background: urgent ? "rgba(255,61,139,0.25)" : "rgba(0,0,0,0.5)", border: urgent ? "1px solid rgba(255,61,139,0.5)" : "none" }}
        >
          <Icon name="Clock" size={11} />{formatTime(timer)}
        </div>
        <div className="absolute bottom-3 right-3 glass px-2 py-1 rounded-full text-xs text-white/70">
          {b.bids} ставок
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-oswald text-lg font-semibold text-white">{b.title}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <Icon name="Star" size={11} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white/50 text-xs">{b.sellerRating} · {b.seller}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="gradient-text font-oswald text-xl font-bold">{formatPrice(b.currentBid)}</p>
            <p className="text-white/40 text-xs">свежесть: {b.freshness}</p>
          </div>
        </div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {b.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>#{t}</span>
          ))}
        </div>
        <button onClick={onBid} className="btn-gradient w-full rounded-xl py-2.5 text-sm font-semibold">
          Сделать ставку
        </button>
      </div>
    </div>
  );
}

/* ─── CATALOG CARD ───────────────────────────────────────── */
function CatalogCard({ b, onLike }: { b: (typeof BOUQUETS)[0]; onLike: () => void }) {
  return (
    <div className="glass rounded-2xl overflow-hidden card-hover flex">
      <img src={b.image} className="w-28 h-28 object-cover flex-shrink-0" />
      <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-oswald text-base font-semibold text-white truncate">{b.title}</h3>
            <button onClick={onLike} className="ml-2 flex-shrink-0">
              <Icon name="Heart" size={16} className={b.liked ? "text-pink-400 fill-pink-400" : "text-white/30"} />
            </button>
          </div>
          <div className="flex items-center gap-1 mt-0.5 mb-2">
            <Icon name="Star" size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-white/40 text-xs">{b.sellerRating} · {b.seller}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {b.tags.slice(0, 2).map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>#{t}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="gradient-text font-oswald text-lg font-bold">{formatPrice(b.currentBid)}</span>
          <span className="text-white/40 text-xs">{b.freshness}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── AUCTIONS SCREEN ────────────────────────────────────── */
function AuctionsScreen({
  bouquets, timers, onBid, onLike,
}: {
  bouquets: typeof BOUQUETS;
  timers: Record<number, number>;
  onBid: (b: (typeof BOUQUETS)[0]) => void;
  onLike: (id: number) => void;
}) {
  return (
    <div className="animate-fade-in">
      <div
        className="relative rounded-3xl overflow-hidden mb-6 p-6"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.2) 0%, rgba(168,85,247,0.2) 50%, rgba(255,107,43,0.12) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}
      >
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 animate-spin-slow" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-15 animate-spin-slow" style={{ background: "radial-gradient(circle, #a855f7, transparent)", animationDirection: "reverse" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">LIVE — 47 активных аукционов</span>
          </div>
          <h2 className="font-oswald text-3xl font-bold text-white mb-1">
            Живые <span className="gradient-text">букеты</span>
          </h2>
          <p className="text-white/50 text-sm">Свежие цветы по ценам ниже магазинных</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Сэкономлено", value: "до 60%", icon: "TrendingDown" },
          { label: "Продавцов", value: "234", icon: "Users" },
          { label: "Сделок сегодня", value: "89", icon: "ShoppingBag" },
        ].map((s, i) => (
          <div key={i} className={`glass rounded-2xl p-3 text-center animate-fade-in-up delay-${(i + 1) * 100}`}>
            <Icon name={s.icon as "TrendingDown"} size={18} className="mx-auto mb-1" style={{ color: "var(--neon-pink)" }} />
            <p className="font-oswald text-lg font-bold text-white">{s.value}</p>
            <p className="text-white/40 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-oswald text-xl font-semibold text-white">Горячие аукционы 🔥</h3>
        <span className="text-white/40 text-xs">по времени</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bouquets.map((b, i) => (
          <div key={b.id} className={`animate-fade-in-up delay-${(i + 1) * 100}`}>
            <AuctionCard b={b} timer={timers[b.id] ?? b.timeLeft} onBid={() => onBid(b)} onLike={() => onLike(b.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── CATALOG SCREEN ─────────────────────────────────────── */
function CatalogScreen({ bouquets, onLike }: { bouquets: typeof BOUQUETS; onLike: (id: number) => void }) {
  const [activeTag, setActiveTag] = useState("все");
  const [sortBy, setSortBy] = useState<"price" | "fresh" | "rating">("price");
  const [priceMax, setPriceMax] = useState(5000);

  const filtered = bouquets
    .filter((b) => activeTag === "все" || b.tags.includes(activeTag))
    .filter((b) => b.currentBid <= priceMax)
    .sort((a, b) => sortBy === "price" ? a.currentBid - b.currentBid : sortBy === "rating" ? b.sellerRating - a.sellerRating : 0);

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-4">Каталог букетов</h2>
      <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 mb-4">
        <Icon name="Search" size={18} className="text-white/30 flex-shrink-0" />
        <input className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none" placeholder="Поиск по типу цветов..." />
        <Icon name="SlidersHorizontal" size={18} className="text-white/30 flex-shrink-0" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
        {ALL_TAGS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTag(t)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={activeTag === t ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {([["price", "По цене"], ["rating", "По рейтингу"], ["fresh", "По свежести"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            className="flex-1 py-2 rounded-xl text-sm font-medium glass transition-all"
            style={{ color: sortBy === k ? "#ff3d8b" : "rgba(255,255,255,0.4)" }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="glass rounded-2xl p-4 mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/50 text-sm">Макс. цена</span>
          <span className="gradient-text font-oswald font-bold text-lg">{formatPrice(priceMax)}</span>
        </div>
        <input type="range" min={500} max={5000} step={100} value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className="w-full accent-pink-500" />
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/50 text-sm">Найдено: {filtered.length} букетов</span>
      </div>
      <div className="flex flex-col gap-3">
        {filtered.map((b, i) => (
          <div key={b.id} className={`animate-fade-in-up delay-${(i + 1) * 100}`}>
            <CatalogCard b={b} onLike={() => onLike(b.id)} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/30">
            <span className="text-5xl block mb-3">🌵</span>
            <p>Нет букетов по этому фильтру</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SELL SCREEN ────────────────────────────────────────── */
function SellScreen() {
  const [step, setStep] = useState(1);
  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Продать букет</h2>
      <p className="text-white/40 text-sm mb-6">Выставьте подаренный букет на аукцион</p>
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-300" style={{ background: s <= step ? "var(--grad-main)" : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>

      {step === 1 && (
        <div className="animate-fade-in-up">
          <div
            className="rounded-3xl border-2 border-dashed mb-4 flex flex-col items-center justify-center py-14 cursor-pointer"
            style={{ borderColor: "rgba(255,61,139,0.3)", background: "rgba(255,61,139,0.05)" }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 animate-float" style={{ background: "rgba(255,61,139,0.15)" }}>
              <Icon name="Camera" size={28} style={{ color: "var(--neon-pink)" }} />
            </div>
            <p className="text-white/60 font-medium">Добавить фото букета</p>
            <p className="text-white/30 text-sm mt-1">до 5 фотографий</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-white/50 text-sm mb-1.5 block">Название букета</label>
              <input className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none" placeholder="Напр.: Розы и тюльпаны, 51 шт." />
            </div>
            <div>
              <label className="text-white/50 text-sm mb-1.5 block">Состав цветов</label>
              <input className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none" placeholder="Розы, пионы, орхидеи..." />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in-up space-y-4">
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Когда подарили?</label>
            <div className="grid grid-cols-3 gap-2">
              {["Сегодня", "Вчера", "2–3 дня"].map((t) => (
                <button key={t} className="glass rounded-xl py-3 text-sm text-white/60 hover:text-white transition-colors">{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Начальная цена</label>
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
              <input className="flex-1 bg-transparent text-white text-xl font-oswald font-bold outline-none placeholder:text-white/20" placeholder="500" type="number" />
              <span className="text-white/40 font-oswald">₽</span>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Длительность аукциона</label>
            <div className="grid grid-cols-3 gap-2">
              {["1 час", "3 часа", "6 часов"].map((t) => (
                <button key={t} className="glass rounded-xl py-3 text-sm text-white/60 hover:text-white transition-colors">{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in-up">
          <div className="glass rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-white/50 text-sm font-medium">Условия платформы</p>
            {[
              ["Комиссия платформы", "12% от суммы продажи"],
              ["Выплата продавцу", "1–2 рабочих дня"],
              ["Способы вывода", "Карта, СБП, кошелёк"],
              ["Гарантия сделки", "Депозит покупателя"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-white/40">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-4 mb-5" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
            <div className="flex items-start gap-3">
              <Icon name="Info" size={16} className="text-pink-400 flex-shrink-0 mt-0.5" />
              <p className="text-white/50 text-xs leading-relaxed">
                После завершения аукциона победитель оплачивает букет. Деньги поступают продавцу после подтверждения получения.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button onClick={() => setStep((s) => s - 1)} className="glass rounded-2xl px-6 py-4 text-white/60 font-semibold hover:text-white transition-colors">
            Назад
          </button>
        )}
        <button
          onClick={() => step < 3 ? setStep((s) => s + 1) : undefined}
          className="btn-gradient flex-1 rounded-2xl py-4 font-oswald text-lg tracking-wide"
        >
          {step === 3 ? "ВЫСТАВИТЬ НА АУКЦИОН" : "ДАЛЕЕ"}
        </button>
      </div>
    </div>
  );
}

/* ─── ORDERS SCREEN ──────────────────────────────────────── */
function OrdersScreen() {
  const orders = [
    { id: "#FF-2847", title: "Пионы и орхидеи", price: 1650, status: "В пути", color: "#06d6de", icon: "Truck", date: "Сегодня, 14:30", progress: 75 },
    { id: "#FF-2831", title: "Розы и тюльпаны", price: 2350, status: "Доставлен", color: "#4ade80", icon: "CheckCircle2", date: "Вчера, 11:15", progress: 100 },
    { id: "#FF-2819", title: "Каллы белые", price: 950, status: "Выигран", color: "#a855f7", icon: "Trophy", date: "28 мая, 19:40", progress: 25 },
  ];
  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Мои заказы</h2>
      <p className="text-white/40 text-sm mb-6">История покупок и статус доставки</p>
      <div className="flex flex-col gap-3">
        {orders.map((o, i) => (
          <div key={o.id} className={`glass rounded-2xl p-4 card-hover animate-fade-in-up delay-${(i + 1) * 100}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${o.color}20` }}>
                <Icon name={o.icon as "Truck"} size={18} style={{ color: o.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white truncate">{o.title}</p>
                  <span className="font-oswald font-bold text-white ml-2">{formatPrice(o.price)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs font-medium" style={{ color: o.color }}>{o.status}</span>
                  <span className="text-white/30 text-xs">{o.date}</span>
                </div>
              </div>
            </div>
            {o.status === "В пути" && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex justify-between text-xs text-white/30 mb-1.5">
                  <span>Оплачен</span><span>Передан</span><span>В пути</span><span>Доставлен</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${o.progress}%`, background: "var(--grad-main)" }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-4 mt-5 grid grid-cols-3 gap-3">
        {[{ label: "Покупок", value: "12" }, { label: "Потрачено", value: "18 200 ₽" }, { label: "Сэкономлено", value: "9 400 ₽" }].map((s) => (
          <div key={s.label} className="text-center">
            <p className="gradient-text font-oswald text-xl font-bold">{s.value}</p>
            <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PROFILE SCREEN ─────────────────────────────────────── */
function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<"about" | "reviews" | "chat">("about");
  const reviews = [
    { name: "Катя Р.", text: "Букет был свежим и красивым! Очень довольна покупкой.", stars: 5, date: "3 дня назад" },
    { name: "Игорь С.", text: "Быстро ответила, всё прошло отлично.", stars: 5, date: "1 неделю назад" },
    { name: "Алина Т.", text: "Хорошие цветы, упаковка немного помялась при передаче.", stars: 4, date: "2 недели назад" },
  ];
  return (
    <div className="animate-fade-in">
      <div className="rounded-3xl p-5 mb-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15) 0%, rgba(168,85,247,0.15) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "var(--grad-main)" }}>🌸</div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1">
            <h2 className="font-oswald text-xl font-bold text-white">Анна Михайлова</h2>
            <div className="flex items-center gap-1 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Icon key={i} name="Star" size={12} className={i < 5 ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
              ))}
              <span className="text-white/50 text-xs ml-1">4.9 · 34 отзыва</span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">На платформе с марта 2024</p>
          </div>
          <button className="glass p-2 rounded-xl"><Icon name="Settings" size={18} className="text-white/50" /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[{ label: "Продано", value: "28" }, { label: "Куплено", value: "12" }, { label: "Рейтинг", value: "4.9" }].map((s) => (
            <div key={s.label} className="glass rounded-xl p-2.5 text-center">
              <p className="gradient-text font-oswald text-lg font-bold">{s.value}</p>
              <p className="text-white/40 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {([["about", "О себе"], ["reviews", "Отзывы"], ["chat", "Чаты"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setActiveTab(k)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={activeTab === k ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
          >
            {l}
          </button>
        ))}
      </div>

      {activeTab === "about" && (
        <div className="animate-fade-in-up space-y-3">
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm mb-3 font-medium">Баланс и выплаты</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="gradient-text font-oswald text-3xl font-bold">3 200 ₽</p>
                <p className="text-white/40 text-xs mt-0.5">Доступно к выводу</p>
              </div>
              <button className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold">Вывести</button>
            </div>
            <div className="flex gap-2">
              {[["Карта", "CreditCard"], ["СБП", "Smartphone"], ["Кошелёк", "Wallet"]].map(([l, ic]) => (
                <button key={l} className="flex-1 glass rounded-xl py-2.5 flex flex-col items-center gap-1 hover:text-white transition-colors text-white/50">
                  <Icon name={ic as "CreditCard"} size={16} />
                  <span className="text-xs">{l}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm mb-3 font-medium">Активные аукционы</p>
            <div className="space-y-2">
              {[{ title: "Пионы микс", price: "от 800 ₽", time: "2ч 14м" }, { title: "Лилии белые", price: "от 500 ₽", time: "5ч 08м" }].map((a) => (
                <div key={a.title} className="flex items-center justify-between">
                  <span className="text-white/70 text-sm">{a.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="gradient-text text-sm font-semibold">{a.price}</span>
                    <span className="text-white/30 text-xs">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="animate-fade-in-up space-y-3">
          {reviews.map((r, i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--grad-main)" }}>{r.name[0]}</div>
                  <span className="text-white font-medium text-sm">{r.name}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, si) => (
                    <Icon key={si} name="Star" size={11} className={si < r.stars ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
                  ))}
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{r.text}</p>
              <p className="text-white/30 text-xs mt-2">{r.date}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "chat" && (
        <div className="animate-fade-in-up space-y-2">
          {[
            { name: "Лена К.", msg: "Букет ещё в хорошем состоянии?", time: "14:32", unread: 2 },
            { name: "Маша Д.", msg: "Спасибо за покупку! 🌸", time: "12:08", unread: 0 },
            { name: "Ира С.", msg: "Можете доставить завтра?", time: "Вчера", unread: 1 },
          ].map((c, i) => (
            <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3 card-hover cursor-pointer">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: "var(--grad-main)" }}>{c.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium text-sm">{c.name}</p>
                  <span className="text-white/30 text-xs">{c.time}</span>
                </div>
                <p className="text-white/40 text-xs truncate mt-0.5">{c.msg}</p>
              </div>
              {c.unread > 0 && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "var(--neon-pink)" }}>{c.unread}</div>
              )}
            </div>
          ))}
          <button className="btn-gradient w-full rounded-2xl py-3.5 font-oswald tracking-wide mt-2">+ НОВЫЙ ЧАТ</button>
        </div>
      )}
    </div>
  );
}

/* ─── ROOT APP ───────────────────────────────────────────── */
export default function Index() {
  const [activeTab, setActiveTab] = useState("auctions");
  const [bouquets, setBouquets] = useState(BOUQUETS);
  const [bidModal, setBidModal] = useState<(typeof BOUQUETS)[0] | null>(null);

  const initialTimers = useCallback(
    () => Object.fromEntries(BOUQUETS.map((b) => [b.id, b.timeLeft])),
    []
  );
  const timers = useTimers(initialTimers());

  const handleLike = (id: number) => setBouquets((prev) => prev.map((b) => b.id === id ? { ...b, liked: !b.liked } : b));
  const handleBid = (id: number, amount: number) => setBouquets((prev) => prev.map((b) => b.id === id ? { ...b, currentBid: amount, bids: b.bids + 1 } : b));

  return (
    <div className="min-h-screen noise" style={{ background: "hsl(var(--background))" }}>
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="absolute top-1/3 -right-40 w-80 h-80 rounded-full opacity-8" style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />
        <div className="absolute -bottom-20 left-1/3 w-64 h-64 rounded-full opacity-8" style={{ background: "radial-gradient(circle, #ff6b2b, transparent)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong px-4 pt-10 pb-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-float" style={{ display: "inline-block" }}>🌸</span>
            <span className="font-oswald text-xl font-bold shimmer-text">FlowerFlip</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="glass w-9 h-9 rounded-xl flex items-center justify-center relative">
              <Icon name="Bell" size={18} className="text-white/60" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: "var(--neon-pink)" }} />
            </button>
            <button className="glass w-9 h-9 rounded-xl flex items-center justify-center">
              <Icon name="Heart" size={18} className="text-white/60" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-5 pb-28">
        {activeTab === "auctions" && <AuctionsScreen bouquets={bouquets} timers={timers} onBid={setBidModal} onLike={handleLike} />}
        {activeTab === "catalog" && <CatalogScreen bouquets={bouquets} onLike={handleLike} />}
        {activeTab === "sell" && <SellScreen />}
        {activeTab === "orders" && <OrdersScreen />}
        {activeTab === "profile" && <ProfileScreen />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-strong">
        <div className="max-w-lg mx-auto px-2 py-2 flex items-center justify-around">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 relative"
                style={isActive ? { background: "rgba(255,61,139,0.12)" } : {}}
              >
                {tab.id === "sell" ? (
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center -mt-5 shadow-lg" style={{ background: "var(--grad-main)" }}>
                    <Icon name={tab.icon as "PlusCircle"} size={20} className="text-white" />
                  </div>
                ) : (
                  <Icon name={tab.icon as "Zap"} size={20} style={{ color: isActive ? "var(--neon-pink)" : "rgba(255,255,255,0.35)" }} />
                )}
                <span className="text-xs font-medium" style={{ color: isActive ? "var(--neon-pink)" : "rgba(255,255,255,0.35)", marginTop: tab.id === "sell" ? "2px" : "0" }}>
                  {tab.label}
                </span>
                {isActive && tab.id !== "sell" && (
                  <div className="absolute -bottom-0.5 w-1 h-1 rounded-full" style={{ background: "var(--neon-pink)" }} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bid Modal */}
      {bidModal && <BidModal bouquet={bidModal} onClose={() => setBidModal(null)} onBid={handleBid} />}
    </div>
  );
}
