import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { authApi, bouquetsApi, profileApi, uploadApi } from "@/lib/api";

/* ─── TYPES ─────────────────────────────────────────────── */
interface Bouquet {
  id: number; seller_id: number; seller_name: string; seller_rating: number;
  title: string; description?: string; flowers: string[]; freshness: string;
  image_urls: string[]; start_price: number; current_price: number;
  min_step: number; bids_count: number; status: string; ends_at: string;
  liked: boolean;
}
interface User {
  id: number; name: string; phone: string; avatar_url?: string;
  rating: number; reviews_count: number; sales_count: number;
  purchases_count: number; balance: number; created_at: string;
}
interface Order {
  id: number; amount: number; status: string; created_at: string;
  title: string; image_urls: string[]; seller_name: string; seller_id: number;
}
interface Review { id: number; stars: number; text: string; created_at: string; reviewer_name: string; }
interface Chat { last_message: string; created_at: string; other_id: number; other_name: string; bouquet_title?: string; unread: number; bouquet_id?: number; }
interface Message { id: number; sender_id: number; text: string; created_at: string; is_read: boolean; }

const TABS = [
  { id: "auctions", label: "Аукционы", icon: "Zap" },
  { id: "catalog", label: "Каталог", icon: "Grid3X3" },
  { id: "sell", label: "Продать", icon: "PlusCircle" },
  { id: "orders", label: "Заказы", icon: "Package" },
  { id: "profile", label: "Профиль", icon: "User" },
];
const ALL_TAGS = ["все", "розы", "тюльпаны", "пионы", "орхидеи", "герберы", "каллы", "подсолнухи"];

/* ─── UTILS ─────────────────────────────────────────────── */
function formatTime(endsAt: string) {
  const diff = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${String(s).padStart(2, "0")}с`;
  return `00:${String(s).padStart(2, "0")}`;
}
function isUrgent(endsAt: string) {
  return (new Date(endsAt).getTime() - Date.now()) / 1000 < 300;
}
function formatPrice(n: number) { return n.toLocaleString("ru-RU") + " ₽"; }
function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(t => t + 1), 1000); return () => clearInterval(id); }, []);
}

/* ─── AUTH SCREEN ────────────────────────────────────────── */
function AuthScreen({ onAuth }: { onAuth: (user: User, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    const r = mode === "login"
      ? await authApi.login(phone, password)
      : await authApi.register(name, phone, password);
    setLoading(false);
    if (!r.ok) { setError(r.data.error || "Ошибка"); return; }
    localStorage.setItem("ff_token", r.data.token);
    const me = await authApi.me();
    if (me.ok) onAuth(me.data.user, r.data.token);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "hsl(var(--background))" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />
      </div>
      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <span className="text-5xl block mb-3 animate-float" style={{ display: "inline-block" }}>🌸</span>
          <h1 className="font-oswald text-4xl font-bold shimmer-text">FlowerFlip</h1>
          <p className="text-white/40 mt-2 text-sm">Аукцион живых букетов</p>
        </div>
        <div className="glass-strong rounded-3xl p-6">
          <div className="flex gap-2 mb-6">
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={mode === m ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                {m === "login" ? "Войти" : "Регистрация"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-white/50 text-sm mb-1.5 block">Имя</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
                  placeholder="Ваше имя" />
              </div>
            )}
            <div>
              <label className="text-white/50 text-sm mb-1.5 block">Телефон</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="+7 999 000 00 00" />
            </div>
            <div>
              <label className="text-white/50 text-sm mb-1.5 block">Пароль</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
          <button onClick={submit} disabled={loading}
            className="btn-gradient w-full rounded-2xl py-4 mt-5 font-oswald text-lg tracking-wide disabled:opacity-50">
            {loading ? "..." : mode === "login" ? "ВОЙТИ" : "СОЗДАТЬ АККАУНТ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── BID MODAL ─────────────────────────────────────────── */
function BidModal({ bouquet, onClose, onBid }: { bouquet: Bouquet; onClose: () => void; onBid: (id: number, amount: number) => void }) {
  const [amount, setAmount] = useState(bouquet.current_price + bouquet.min_step);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setLoading(true); setError("");
    const r = await bouquetsApi.bid(bouquet.id, amount);
    setLoading(false);
    if (!r.ok) { setError(r.data.error); return; }
    onBid(bouquet.id, amount); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="glass-strong rounded-2xl p-6 w-full max-w-sm animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald text-xl font-bold text-white">{bouquet.title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><Icon name="X" size={20} /></button>
        </div>
        <div className="flex items-center gap-3 mb-5">
          {bouquet.image_urls[0] && <img src={bouquet.image_urls[0]} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />}
          <div>
            <p className="text-white/50 text-sm">Текущая ставка</p>
            <p className="gradient-text font-oswald text-2xl font-bold">{formatPrice(bouquet.current_price)}</p>
            <p className="text-white/40 text-xs">Шаг от {formatPrice(bouquet.min_step)}</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-white/60 text-sm mb-2 block">Ваша ставка</label>
          <div className="flex gap-2">
            <button className="glass rounded-xl px-3 py-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setAmount(a => Math.max(bouquet.current_price + bouquet.min_step, a - bouquet.min_step))}>
              <Icon name="Minus" size={16} />
            </button>
            <div className="flex-1 glass rounded-xl px-4 py-2 font-oswald text-xl text-center text-white font-bold">{formatPrice(amount)}</div>
            <button className="glass rounded-xl px-3 py-2 text-white/70 hover:text-white transition-colors"
              onClick={() => setAmount(a => a + bouquet.min_step)}>
              <Icon name="Plus" size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          {[1, 3, 5].map(x => (
            <button key={x} className="flex-1 glass rounded-xl py-2 text-sm text-white/60 hover:text-white transition-colors"
              onClick={() => setAmount(bouquet.current_price + bouquet.min_step * x)}>
              +{formatPrice(bouquet.min_step * x)}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
        <button onClick={submit} disabled={loading}
          className="btn-gradient w-full rounded-2xl py-4 mt-5 font-oswald text-lg tracking-wide animate-pulse-glow disabled:opacity-50">
          {loading ? "..." : "СДЕЛАТЬ СТАВКУ"}
        </button>
      </div>
    </div>
  );
}

/* ─── AUCTION CARD ───────────────────────────────────────── */
function AuctionCard({ b, onBid, onLike }: { b: Bouquet; onBid: () => void; onLike: () => void }) {
  useTick();
  const urgent = isUrgent(b.ends_at);
  const img = b.image_urls[0] || "/placeholder.svg";
  return (
    <div className="glass rounded-2xl overflow-hidden card-hover">
      <div className="relative">
        <img src={img} alt={b.title} className="w-full h-48 object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)" }} />
        <button onClick={onLike} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full glass transition-all hover:scale-110">
          <Icon name="Heart" size={16} className={b.liked ? "text-pink-400 fill-pink-400" : "text-white/60"} />
        </button>
        <div className={`absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${urgent ? "animate-timer" : "text-white"}`}
          style={{ background: urgent ? "rgba(255,61,139,0.25)" : "rgba(0,0,0,0.5)", border: urgent ? "1px solid rgba(255,61,139,0.5)" : "none" }}>
          <Icon name="Clock" size={11} />{formatTime(b.ends_at)}
        </div>
        <div className="absolute bottom-3 right-3 glass px-2 py-1 rounded-full text-xs text-white/70">{b.bids_count} ставок</div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-oswald text-lg font-semibold text-white">{b.title}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <Icon name="Star" size={11} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white/50 text-xs">{b.seller_rating?.toFixed(1)} · {b.seller_name}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="gradient-text font-oswald text-xl font-bold">{formatPrice(b.current_price)}</p>
            <p className="text-white/40 text-xs">свежесть: {b.freshness}</p>
          </div>
        </div>
        <div className="flex gap-1 mb-3 flex-wrap">
          {(b.flowers || []).slice(0, 3).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>#{t}</span>
          ))}
        </div>
        <button onClick={onBid} className="btn-gradient w-full rounded-xl py-2.5 text-sm font-semibold">Сделать ставку</button>
      </div>
    </div>
  );
}

/* ─── AUCTIONS SCREEN ────────────────────────────────────── */
function AuctionsScreen({ onBid, user }: { onBid: (b: Bouquet) => void; user: User | null }) {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await bouquetsApi.list({ status: "active", sort: "ends_at" });
    if (r.ok) setBouquets(r.data.bouquets);
    setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const toggleLike = async (b: Bouquet) => {
    if (!user) return;
    setBouquets(prev => prev.map(x => x.id === b.id ? { ...x, liked: !x.liked } : x));
    await bouquetsApi.favorite(b.id, !b.liked);
  };

  const handleBidDone = (id: number, amount: number) => {
    setBouquets(prev => prev.map(b => b.id === id ? { ...b, current_price: amount, bids_count: b.bids_count + 1 } : b));
  };

  return (
    <div className="animate-fade-in">
      <div className="relative rounded-3xl overflow-hidden mb-6 p-6"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.2) 0%, rgba(168,85,247,0.2) 50%, rgba(255,107,43,0.12) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 animate-spin-slow" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">LIVE — {bouquets.length} активных аукционов</span>
          </div>
          <h2 className="font-oswald text-3xl font-bold text-white mb-1">Живые <span className="gradient-text">букеты</span></h2>
          <p className="text-white/50 text-sm">Свежие цветы по ценам ниже магазинных</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="glass rounded-2xl h-64 animate-pulse" />)}
        </div>
      ) : bouquets.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-6xl block mb-4">🌸</span>
          <p className="text-white/50 font-oswald text-xl">Пока нет активных аукционов</p>
          <p className="text-white/30 text-sm mt-2">Станьте первым продавцом!</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-oswald text-xl font-semibold text-white">Горячие аукционы 🔥</h3>
            <button onClick={load} className="glass p-2 rounded-xl"><Icon name="RefreshCw" size={14} className="text-white/50" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bouquets.map((b, i) => (
              <div key={b.id} className={`animate-fade-in-up delay-${Math.min((i + 1) * 100, 500)}`}>
                <AuctionCard b={b} onBid={() => onBid(b)} onLike={() => toggleLike(b)} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── CATALOG SCREEN ─────────────────────────────────────── */
function CatalogScreen({ user }: { user: User | null }) {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState("все");
  const [sortBy, setSortBy] = useState<"price" | "rating">("price");
  const [priceMax, setPriceMax] = useState(5000);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    bouquetsApi.list({ status: "active", tag: activeTag !== "все" ? activeTag : undefined, sort: sortBy, max_price: priceMax })
      .then(r => { if (r.ok) setBouquets(r.data.bouquets); setLoading(false); });
  }, [activeTag, sortBy, priceMax]);

  const filtered = search
    ? bouquets.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || (b.flowers || []).join(" ").includes(search.toLowerCase()))
    : bouquets;

  const toggleLike = async (b: Bouquet) => {
    if (!user) return;
    setBouquets(prev => prev.map(x => x.id === b.id ? { ...x, liked: !x.liked } : x));
    await bouquetsApi.favorite(b.id, !b.liked);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-4">Каталог букетов</h2>
      <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 mb-4">
        <Icon name="Search" size={18} className="text-white/30 flex-shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="Поиск по цветам..." />
        {search && <button onClick={() => setSearch("")}><Icon name="X" size={14} className="text-white/30" /></button>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
        {ALL_TAGS.map(t => (
          <button key={t} onClick={() => setActiveTag(t)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={activeTag === t ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {([["price", "По цене"], ["rating", "По рейтингу"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)}
            className="flex-1 py-2 rounded-xl text-sm font-medium glass transition-all"
            style={{ color: sortBy === k ? "#ff3d8b" : "rgba(255,255,255,0.4)" }}>{l}</button>
        ))}
      </div>
      <div className="glass rounded-2xl p-4 mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/50 text-sm">Макс. цена</span>
          <span className="gradient-text font-oswald font-bold text-lg">{formatPrice(priceMax)}</span>
        </div>
        <input type="range" min={500} max={5000} step={100} value={priceMax}
          onChange={e => setPriceMax(Number(e.target.value))} className="w-full accent-pink-500" />
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/50 text-sm">Найдено: {filtered.length} букетов</span>
      </div>
      {loading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-28 animate-pulse" />)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(b => (
            <div key={b.id} className="glass rounded-2xl overflow-hidden card-hover flex">
              <img src={b.image_urls[0] || "/placeholder.svg"} className="w-28 h-28 object-cover flex-shrink-0" />
              <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-oswald text-base font-semibold text-white truncate">{b.title}</h3>
                    <button onClick={() => toggleLike(b)} className="ml-2 flex-shrink-0">
                      <Icon name="Heart" size={16} className={b.liked ? "text-pink-400 fill-pink-400" : "text-white/30"} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 mb-1">
                    <Icon name="Star" size={10} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-white/40 text-xs">{b.seller_rating?.toFixed(1)} · {b.seller_name}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(b.flowers || []).slice(0, 2).map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>#{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="gradient-text font-oswald text-lg font-bold">{formatPrice(b.current_price)}</span>
                  <span className="text-white/40 text-xs">{b.freshness}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <span className="text-5xl block mb-3">🌵</span>
              <p>Нет букетов по этому фильтру</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── SELL SCREEN ────────────────────────────────────────── */
function SellScreen({ user }: { user: User | null }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [flowers, setFlowers] = useState("");
  const [freshness, setFreshness] = useState("сегодня");
  const [price, setPrice] = useState("500");
  const [duration, setDuration] = useState(3);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadApi.upload(file);
    setUploading(false);
    if (url) setImages(prev => [...prev, url]);
  };

  const submit = async () => {
    setLoading(true); setError("");
    const r = await bouquetsApi.create({
      title, description: "",
      flowers: flowers.split(",").map(s => s.trim()).filter(Boolean),
      freshness, image_urls: images,
      start_price: parseFloat(price) || 500,
      duration_hours: duration,
    });
    setLoading(false);
    if (!r.ok) { setError(r.data.error); return; }
    setDone(true);
  };

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🔐</span>
      <p className="text-white/50 font-oswald text-xl">Войдите, чтобы продавать</p>
    </div>
  );

  if (done) return (
    <div className="text-center py-20 animate-fade-in-up">
      <span className="text-6xl block mb-4">🎉</span>
      <h2 className="font-oswald text-3xl font-bold gradient-text mb-3">Букет выставлен!</h2>
      <p className="text-white/50 mb-6">Ваш аукцион активен. Следите за ставками в «Профиле».</p>
      <button onClick={() => { setDone(false); setStep(1); setTitle(""); setFlowers(""); setImages([]); }}
        className="btn-gradient px-8 py-3 rounded-2xl font-oswald tracking-wide">ВЫСТАВИТЬ ЕЩЁ</button>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Продать букет</h2>
      <p className="text-white/40 text-sm mb-6">Выставьте подаренный букет на аукцион</p>
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{ background: s <= step ? "var(--grad-main)" : "rgba(255,255,255,0.1)" }} />
        ))}
      </div>

      {step === 1 && (
        <div className="animate-fade-in-up space-y-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <div onClick={() => fileRef.current?.click()}
            className="rounded-3xl border-2 border-dashed mb-2 flex flex-col items-center justify-center py-10 cursor-pointer"
            style={{ borderColor: "rgba(255,61,139,0.3)", background: "rgba(255,61,139,0.05)" }}>
            {uploading ? (
              <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
            ) : images.length > 0 ? (
              <div className="flex gap-2 flex-wrap justify-center px-4">
                {images.map((url, i) => <img key={i} src={url} className="w-16 h-16 rounded-xl object-cover" />)}
                <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,61,139,0.15)" }}>
                  <Icon name="Plus" size={24} style={{ color: "var(--neon-pink)" }} />
                </div>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 animate-float" style={{ background: "rgba(255,61,139,0.15)" }}>
                  <Icon name="Camera" size={26} style={{ color: "var(--neon-pink)" }} />
                </div>
                <p className="text-white/60 font-medium">Добавить фото</p>
                <p className="text-white/30 text-sm mt-1">до 5 фотографий</p>
              </>
            )}
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Название букета</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="Напр.: Розы и тюльпаны, 51 шт." />
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Состав (через запятую)</label>
            <input value={flowers} onChange={e => setFlowers(e.target.value)}
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="розы, пионы, орхидеи" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in-up space-y-4">
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Когда подарили?</label>
            <div className="grid grid-cols-3 gap-2">
              {["сегодня", "вчера", "2–3 дня"].map(t => (
                <button key={t} onClick={() => setFreshness(t)}
                  className="rounded-xl py-3 text-sm font-medium transition-all"
                  style={freshness === t ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Начальная цена</label>
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
              <input value={price} onChange={e => setPrice(e.target.value)} type="number"
                className="flex-1 bg-transparent text-white text-xl font-oswald font-bold outline-none placeholder:text-white/20" placeholder="500" />
              <span className="text-white/40 font-oswald">₽</span>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Длительность аукциона</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 6].map(h => (
                <button key={h} onClick={() => setDuration(h)}
                  className="rounded-xl py-3 text-sm font-medium transition-all"
                  style={duration === h ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  {h} {h === 1 ? "час" : "часа"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in-up">
          <div className="glass rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-white/50 text-sm font-medium">Подтверждение</p>
            {[["Название", title || "—"], ["Состав", flowers || "—"], ["Свежесть", freshness],
              ["Начальная цена", formatPrice(parseFloat(price) || 500)],
              ["Длительность", `${duration} ч`], ["Фото", `${images.length} шт`]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-white/40">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
            {[["Комиссия платформы", "12% от суммы"], ["Выплата продавцу", "1–2 рабочих дня"], ["Способы вывода", "Карта, СБП, кошелёк"]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm mb-2 last:mb-0">
                <span className="text-white/40">{k}</span>
                <span className="text-white/70">{v}</span>
              </div>
            ))}
          </div>
          {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} className="glass rounded-2xl px-6 py-4 text-white/60 font-semibold hover:text-white transition-colors">Назад</button>
        )}
        <button onClick={() => step < 3 ? setStep(s => s + 1) : submit()} disabled={loading || (step === 1 && !title)}
          className="btn-gradient flex-1 rounded-2xl py-4 font-oswald text-lg tracking-wide disabled:opacity-50">
          {loading ? "..." : step === 3 ? "ВЫСТАВИТЬ НА АУКЦИОН" : "ДАЛЕЕ"}
        </button>
      </div>
    </div>
  );
}

/* ─── ORDERS SCREEN ──────────────────────────────────────── */
function OrdersScreen({ user }: { user: User | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    profileApi.orders().then(r => { if (r.ok) setOrders(r.data.orders); setLoading(false); });
  }, [user]);

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">📦</span>
      <p className="text-white/50 font-oswald text-xl">Войдите, чтобы видеть заказы</p>
    </div>
  );

  const STATUS_MAP: Record<string, { color: string; label: string; icon: string }> = {
    pending: { color: "#a855f7", label: "Ожидает", icon: "Clock" },
    paid: { color: "#06d6de", label: "Оплачен", icon: "CreditCard" },
    in_transit: { color: "#06d6de", label: "В пути", icon: "Truck" },
    delivered: { color: "#4ade80", label: "Доставлен", icon: "CheckCircle2" },
    completed: { color: "#4ade80", label: "Завершён", icon: "Trophy" },
  };

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Мои заказы</h2>
      <p className="text-white/40 text-sm mb-6">История покупок и статус доставки</p>
      {loading ? (
        <div className="flex flex-col gap-3">{[1,2].map(i => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-5xl block mb-4">🛍</span>
          <p className="text-white/50">Вы ещё ничего не купили</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o, i) => {
            const st = STATUS_MAP[o.status] || { color: "#ffffff40", label: o.status, icon: "Circle" };
            return (
              <div key={o.id} className={`glass rounded-2xl p-4 card-hover animate-fade-in-up delay-${Math.min((i+1)*100,500)}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${st.color}20` }}>
                    <Icon name={st.icon as "Truck"} size={18} style={{ color: st.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white truncate">{o.title}</p>
                      <span className="font-oswald font-bold text-white ml-2">{formatPrice(o.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs font-medium" style={{ color: st.color }}>{st.label}</span>
                      <span className="text-white/30 text-xs">{timeAgo(o.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── CHAT WINDOW ────────────────────────────────────────── */
function ChatWindow({ chat, user, onBack }: { chat: Chat; user: User; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    profileApi.messages(chat.other_id).then(r => { if (r.ok) setMessages(r.data.messages); });
  }, [chat.other_id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const r = await profileApi.sendMessage(chat.other_id, text.trim(), chat.bouquet_id);
    setSending(false);
    if (r.ok) {
      setMessages(prev => [...prev, { id: r.data.id, sender_id: user.id, text: text.trim(), created_at: r.data.created_at, is_read: false }]);
      setText("");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="glass p-2 rounded-xl"><Icon name="ArrowLeft" size={18} className="text-white/60" /></button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--grad-main)" }}>{chat.other_name[0]}</div>
        <div>
          <p className="text-white font-medium text-sm">{chat.other_name}</p>
          {chat.bouquet_title && <p className="text-white/40 text-xs">{chat.bouquet_title}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm"
              style={m.sender_id === user.id
                ? { background: "var(--grad-main)", color: "#fff" }
                : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)" }}>
              <p>{m.text}</p>
              <p className="text-xs mt-1 opacity-60">{timeAgo(m.created_at)}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center text-white/30 text-sm py-8">Начните диалог</p>}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          className="flex-1 glass rounded-2xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
          placeholder="Сообщение..." />
        <button onClick={send} disabled={sending || !text.trim()}
          className="btn-gradient w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
          <Icon name="Send" size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}

/* ─── PROFILE SCREEN ─────────────────────────────────────── */
function ProfileScreen({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const [tab, setTab] = useState<"about" | "reviews" | "chat">("about");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [sales, setSales] = useState<{ id: number; title: string; current_price: number; status: string; bids_count: number }[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    if (tab === "reviews") profileApi.reviews().then(r => { if (r.ok) setReviews(r.data.reviews); });
    if (tab === "chat") profileApi.chats().then(r => { if (r.ok) setChats(r.data.chats); });
    if (tab === "about") profileApi.mySales().then(r => { if (r.ok) setSales(r.data.sales); });
  }, [tab, user]);

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">👤</span>
      <p className="text-white/50 font-oswald text-xl">Войдите в аккаунт</p>
    </div>
  );

  if (activeChat) return <ChatWindow chat={activeChat} user={user} onBack={() => setActiveChat(null)} />;

  const doWithdraw = async (method: string) => {
    const amount = parseFloat(withdrawAmount);
    if (!amount) return;
    const r = await profileApi.withdraw(amount, method);
    setWithdrawMsg(r.ok ? r.data.message : r.data.error);
    if (r.ok) setWithdrawAmount("");
  };

  return (
    <div className="animate-fade-in">
      <div className="rounded-3xl p-5 mb-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.15) 0%, rgba(168,85,247,0.15) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl overflow-hidden"
              style={{ background: user.avatar_url ? "transparent" : "var(--grad-main)" }}>
              {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : "🌸"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1">
            <h2 className="font-oswald text-xl font-bold text-white">{user.name}</h2>
            <div className="flex items-center gap-1 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Icon key={i} name="Star" size={12} className={i < Math.round(user.rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
              ))}
              <span className="text-white/50 text-xs ml-1">{user.rating?.toFixed(1)} · {user.reviews_count} отзывов</span>
            </div>
            <p className="text-white/40 text-xs mt-0.5">{user.phone}</p>
          </div>
          <button onClick={onLogout} className="glass p-2 rounded-xl" title="Выйти">
            <Icon name="LogOut" size={16} className="text-white/40" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[{ label: "Продано", value: user.sales_count }, { label: "Куплено", value: user.purchases_count }, { label: "Рейтинг", value: user.rating?.toFixed(1) }].map(s => (
            <div key={s.label} className="glass rounded-xl p-2.5 text-center">
              <p className="gradient-text font-oswald text-lg font-bold">{s.value}</p>
              <p className="text-white/40 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {([["about", "Кабинет"], ["reviews", "Отзывы"], ["chat", "Чаты"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={tab === k ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "about" && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm mb-3 font-medium">Баланс и выплаты</p>
            <p className="gradient-text font-oswald text-3xl font-bold mb-1">{formatPrice(user.balance)}</p>
            <p className="text-white/40 text-xs mb-3">Доступно к выводу</p>
            <div className="glass rounded-xl px-4 py-2 flex items-center gap-2 mb-3">
              <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} type="number"
                className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-white/30"
                placeholder="Сумма для вывода" />
              <span className="text-white/40 text-sm">₽</span>
            </div>
            {withdrawMsg && <p className={`text-sm mb-3 ${withdrawMsg.includes("Недостаточно") ? "text-red-400" : "text-green-400"}`}>{withdrawMsg}</p>}
            <div className="flex gap-2">
              {[["Карта", "CreditCard", "card"], ["СБП", "Smartphone", "sbp"], ["Кошелёк", "Wallet", "wallet"]].map(([l, ic, m]) => (
                <button key={l} onClick={() => doWithdraw(m)}
                  className="flex-1 glass rounded-xl py-2.5 flex flex-col items-center gap-1 hover:text-white transition-colors text-white/50">
                  <Icon name={ic as "CreditCard"} size={16} />
                  <span className="text-xs">{l}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm mb-3 font-medium">Мои аукционы</p>
            {sales.length === 0 ? (
              <p className="text-white/30 text-sm">Вы ещё не выставляли букеты</p>
            ) : (
              <div className="space-y-2">
                {sales.slice(0, 3).map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="text-white/70 text-sm truncate flex-1">{s.title}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="gradient-text text-sm font-semibold">{formatPrice(s.current_price)}</span>
                      <span className="text-white/30 text-xs">{s.bids_count} ст.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-3 animate-fade-in-up">
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-white/30"><span className="text-4xl block mb-3">💬</span><p>Отзывов пока нет</p></div>
          ) : reviews.map((r, i) => (
            <div key={i} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--grad-main)" }}>{r.reviewer_name[0]}</div>
                  <span className="text-white font-medium text-sm">{r.reviewer_name}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, si) => (
                    <Icon key={si} name="Star" size={11} className={si < r.stars ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />
                  ))}
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{r.text}</p>
              <p className="text-white/30 text-xs mt-2">{timeAgo(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-2 animate-fade-in-up">
          {chats.length === 0 ? (
            <div className="text-center py-12 text-white/30"><span className="text-4xl block mb-3">💬</span><p>Нет активных чатов</p></div>
          ) : chats.map((c, i) => (
            <div key={i} onClick={() => setActiveChat(c)}
              className="glass rounded-2xl p-4 flex items-center gap-3 card-hover cursor-pointer">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: "var(--grad-main)" }}>{c.other_name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium text-sm">{c.other_name}</p>
                  <span className="text-white/30 text-xs">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-white/40 text-xs truncate mt-0.5">{c.last_message}</p>
              </div>
              {c.unread > 0 && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "var(--neon-pink)" }}>{c.unread}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── ROOT ───────────────────────────────────────────────── */
export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState("auctions");
  const [bidModal, setBidModal] = useState<Bouquet | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("ff_token");
    if (!token) { setAuthChecked(true); return; }
    authApi.me().then(r => {
      if (r.ok) setUser(r.data.user);
      else localStorage.removeItem("ff_token");
      setAuthChecked(true);
    });
  }, []);

  const handleAuth = (u: User) => setUser(u);
  const handleLogout = async () => {
    await authApi.logout();
    localStorage.removeItem("ff_token");
    setUser(null);
  };

  const handleBid = (id: number, amount: number) => {
    setBidModal(null);
  };

  if (!authChecked) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
      <div className="animate-float text-4xl">🌸</div>
    </div>
  );

  if (!user) return <AuthScreen onAuth={handleAuth} />;

  return (
    <div className="min-h-screen noise" style={{ background: "hsl(var(--background))" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="absolute top-1/3 -right-40 w-80 h-80 rounded-full opacity-8" style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />
      </div>

      <header className="sticky top-0 z-40 glass-strong px-4 pt-10 pb-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-float" style={{ display: "inline-block" }}>🌸</span>
            <span className="font-oswald text-xl font-bold shimmer-text">FlowerFlip</span>
          </div>
          <div className="glass px-3 py-1.5 rounded-xl">
            <span className="gradient-text font-oswald text-sm font-bold">{formatPrice(user.balance)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 pb-28">
        {activeTab === "auctions" && <AuctionsScreen onBid={setBidModal} user={user} />}
        {activeTab === "catalog" && <CatalogScreen user={user} />}
        {activeTab === "sell" && <SellScreen user={user} />}
        {activeTab === "orders" && <OrdersScreen user={user} />}
        {activeTab === "profile" && <ProfileScreen user={user} onLogout={handleLogout} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-strong">
        <div className="max-w-lg mx-auto px-2 py-2 flex items-center justify-around">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 relative"
                style={isActive ? { background: "rgba(255,61,139,0.12)" } : {}}>
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
                {isActive && tab.id !== "sell" && <div className="absolute -bottom-0.5 w-1 h-1 rounded-full" style={{ background: "var(--neon-pink)" }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {bidModal && <BidModal bouquet={bidModal} onClose={() => setBidModal(null)} onBid={handleBid} />}
    </div>
  );
}
