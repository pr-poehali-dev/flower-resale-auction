import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { authApi, bouquetsApi, profileApi, uploadApi, escrowApi, oauthApi, adminApi, paymentApi } from "@/lib/api";
import { OnboardingTour, useOnboarding } from "@/components/OnboardingTour";
import { useCities } from "@/lib/cities";

/* ─── TYPES ─────────────────────────────────────────────── */
interface Bouquet {
  id: number; seller_id: number; seller_name: string; seller_rating: number;
  title: string; description?: string; flowers: string[]; freshness: string;
  image_urls: string[]; start_price: number; current_price: number;
  min_step: number; bids_count: number; status: string; ends_at: string;
  liked: boolean; city?: string; district?: string; meet_point?: string;
}
interface User {
  id: number; name: string; phone: string; avatar_url?: string;
  rating: number; reviews_count: number; sales_count: number;
  purchases_count: number; balance: number; created_at: string; city?: string;
  is_admin?: boolean; payout_method?: string; payout_details?: string;
}
interface Deal {
  id: number; amount: number; commission: number; escrow_status: string;
  created_at: string; updated_at: string; auto_confirm_at?: string;
  dispute_reason?: string; seller_phone_revealed: boolean;
  title: string; image_urls: string[]; city?: string; district?: string;
  seller_name: string; seller_id: number; buyer_name: string; buyer_id: number;
  seller_phone?: string; buyer_phone?: string;
  is_buyer: boolean; is_seller: boolean;
}
interface Review { id: number; stars: number; text: string; created_at: string; reviewer_name: string; }
interface Chat { last_message: string; created_at: string; other_id: number; other_name: string; bouquet_title?: string; unread: number; bouquet_id?: number; }
interface Message { id: number; sender_id: number; text: string; created_at: string; is_read: boolean; }

const TABS = [
  { id: "auctions", label: "Аукционы", icon: "Zap" },
  { id: "catalog", label: "Каталог", icon: "Grid3X3" },
  { id: "sell", label: "Продать", icon: "PlusCircle" },
  { id: "deals", label: "Сделки", icon: "Handshake" },
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
function formatPrice(n: number | undefined | null) { return (n ?? 0).toLocaleString("ru-RU") + " ₽"; }
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

/* ─── CITIES DATA — полный список грузится с бэкенда (см. src/lib/cities.ts) ─── */

const DISTRICTS: Record<string, string[]> = {
  "Москва": [
    "Центральный", "Северный", "Северо-Восточный", "Восточный",
    "Юго-Восточный", "Южный", "Юго-Западный", "Западный",
    "Северо-Западный", "Зеленоградский", "Новомосковский", "Троицкий",
  ],
  "Санкт-Петербург": [
    "Адмиралтейский", "Василеостровский", "Выборгский", "Калининский",
    "Кировский", "Колпинский", "Красногвардейский", "Красносельский",
    "Кронштадтский", "Курортный", "Московский", "Невский",
    "Петроградский", "Петродворцовый", "Приморский", "Пушкинский",
    "Фрунзенский", "Центральный",
  ],
  "Екатеринбург": [
    "Верх-Исетский", "Железнодорожный", "Кировский", "Ленинский",
    "Октябрьский", "Орджоникидзевский", "Чкаловский",
  ],
  "Новосибирск": [
    "Дзержинский", "Железнодорожный", "Заельцовский", "Калининский",
    "Кировский", "Ленинский", "Октябрьский", "Первомайский", "Советский",
    "Центральный",
  ],
  "Казань": ["Авиастроительный", "Вахитовский", "Кировский", "Московский", "Ново-Савиновский", "Приволжский", "Советский"],
};

function getDistricts(city: string): string[] {
  return DISTRICTS[city] || [];
}

const ESCROW_STATUS: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  waiting_payment: { label: "Ожидает оплаты", color: "#a855f7", icon: "Clock", desc: "Оплатите, чтобы получить контакт продавца" },
  paid:            { label: "Оплачен", color: "#06d6de", icon: "CreditCard", desc: "Договоритесь о встрече с продавцом" },
  completed:       { label: "Завершён", color: "#4ade80", icon: "CheckCircle2", desc: "Сделка успешно закрыта" },
  dispute:         { label: "Спор", color: "#ff6b2b", icon: "AlertTriangle", desc: "Разбирается модератором" },
  archived:        { label: "Архив", color: "#6b7280", icon: "Archive", desc: "Сделка в архиве" },
  cancelled:       { label: "Отменён", color: "#6b7280", icon: "XCircle", desc: "Аукцион был снят" },
  expired:         { label: "Истёк", color: "#6b7280", icon: "Clock", desc: "Аукцион завершился без ставок" },
};

/* ─── INSTALL BANNER ─────────────────────────────────────── */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Глобально храним событие установки — оно может прийти до монтирования компонентов
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("ff-install-ready"));
  });
}

// Хук установки PWA — используется и баннером, и кнопкой в профиле
function usePwaInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(deferredInstallPrompt);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
    }
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !nav.standalone);
    const onReady = () => setPrompt(deferredInstallPrompt);
    window.addEventListener("ff-install-ready", onReady);
    const onInstalled = () => { setPrompt(null); deferredInstallPrompt = null; setIsStandalone(true); };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("ff-install-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "ios" | "unavailable"> => {
    if (isIos) return "ios";
    const p = prompt || deferredInstallPrompt;
    if (!p) return "unavailable";
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === "accepted") { setPrompt(null); deferredInstallPrompt = null; }
    return outcome;
  };

  // canInstall: можно показать кнопку (есть prompt или iOS) и приложение ещё не установлено
  return { isIos, isStandalone, canInstall: (!!prompt || isIos) && !isStandalone, promptInstall };
}

function InstallBanner() {
  const { isIos, isStandalone, canInstall, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem("ff_install_dismissed"));
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isStandalone || dismissed || !canInstall) return null;

  const dismiss = () => { localStorage.setItem("ff_install_dismissed", "1"); setDismissed(true); };

  const install = async () => {
    const res = await promptInstall();
    if (res === "ios") { setShowIosGuide(true); return; }
    if (res === "accepted") dismiss();
  };

  return (
    <>
      <div className="fixed bottom-20 left-3 right-3 z-50 animate-fade-in-up">
        <div className="glass-strong rounded-2xl p-4 flex items-center gap-3"
          style={{ border: "1px solid rgba(255,61,139,0.3)", boxShadow: "0 8px 32px rgba(255,61,139,0.2)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ background: "var(--grad-main)" }}>🌸</div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Установить FlowerFlip</p>
            <p className="text-white/40 text-xs mt-0.5">
              {isIos ? "Добавьте на экран «Домой»" : "Работает без интернета"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={install}
              className="btn-gradient px-3 py-1.5 rounded-xl text-xs font-bold">
              {isIos ? "Как?" : "Установить"}
            </button>
            <button onClick={dismiss} className="text-white/30 hover:text-white transition-colors p-1">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS guide modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowIosGuide(false)}>
          <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-fade-in-up"
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <span className="text-4xl block mb-2">📱</span>
              <h3 className="font-oswald text-xl font-bold text-white">Установить на iPhone</h3>
            </div>
            <div className="space-y-4">
              {[
                { step: "1", icon: "Share2", text: "Нажмите кнопку «Поделиться»", sub: "значок снизу экрана браузера Safari" },
                { step: "2", icon: "PlusSquare", text: "Выберите «На экран «Домой»»", sub: "прокрутите список действий вниз" },
                { step: "3", icon: "CheckCircle2", text: "Нажмите «Добавить»", sub: "приложение появится на рабочем столе" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
                    style={{ background: "var(--grad-main)" }}>{s.step}</div>
                  <div>
                    <p className="text-white text-sm font-medium">{s.text}</p>
                    <p className="text-white/40 text-xs mt-0.5">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowIosGuide(false); dismiss(); }}
              className="btn-gradient w-full rounded-2xl py-3 mt-5 font-oswald tracking-wide">
              ПОНЯТНО
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── AUTH SCREEN ────────────────────────────────────────── */
function AuthScreen({ onAuth }: { onAuth: (user: User, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [showCitySuggest, setShowCitySuggest] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [needCity, setNeedCity] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const vkContainerRef = useRef<HTMLDivElement>(null);
  const [vkSdkLoaded, setVkSdkLoaded] = useState(false);



  const cities = useCities();
  const citySuggestions = cityInput.length > 0
    ? cities.filter(c => c.toLowerCase().includes(cityInput.toLowerCase())).slice(0, 8)
    : [];

  // Финализация после OAuth: если новый пользователь — показываем выбор города
  const finishOAuth = useCallback(async (token: string, isNew?: boolean) => {
    localStorage.setItem("ff_token", token);
    setOauthLoading(null);
    if (isNew) {
      setPendingToken(token);
      setNeedCity(true);
      return;
    }
    const me = await authApi.me();
    if (me.ok) onAuth(me.data.user, token);
    else setError("Не удалось загрузить профиль");
  }, [onAuth]);

  // Сохраняем город и входим
  const saveCity = useCallback(async (selectedCity: string) => {
    if (!pendingToken) return;
    if (selectedCity) await authApi.update({ city: selectedCity });
    const me = await authApi.me();
    if (me.ok) onAuth(me.data.user, pendingToken);
    else setError("Не удалось загрузить профиль");
    setNeedCity(false);
    setPendingToken(null);
  }, [pendingToken, onAuth]);

  // OAuth callback — VK возвращает ?code=...&state=vk, Google — ?code=...&state=google
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state"); // "vk" или "google"
    if (!code || !state) return;
    window.history.replaceState({}, "", "/");

    if (state === "vk") {
      setOauthLoading("vk");
      oauthApi.vkCallback(code).then(async r => {
        if (!r.ok) { setError(r.data.error || "Ошибка VK"); setOauthLoading(null); return; }
        await finishOAuth(r.data.token, r.data.is_new);
      });
    } else if (state === "google") {
      setOauthLoading("google");
      oauthApi.googleCallback(code).then(async r => {
        if (!r.ok) { setError(r.data.error || "Ошибка Google"); setOauthLoading(null); return; }
        await finishOAuth(r.data.token, r.data.is_new);
      });
    }
  }, [finishOAuth]);



  // VK ID OneTap — временно отключено
  const VK_LOGIN_ENABLED = false;
  useEffect(() => {
    if (!VK_LOGIN_ENABLED) return;
    let rendered = false;

    const renderWidget = () => {
      if (rendered) return;
      const container = vkContainerRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const VKID = (window as any).VKIDSDK;
      if (!container || !VKID) return;
      rendered = true;
      setVkSdkLoaded(true);

      VKID.Config.init({
        app: 54627734,
        redirectUrl: window.location.origin,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: "",
      });

      const oneTap = new VKID.OneTap();
      oneTap.render({ container, showAlternativeLogin: false })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on(VKID.WidgetEvents.ERROR, (e: any) => { console.error("VKID error:", e); })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload: { code: string; device_id: string }) => {
          setOauthLoading("vk");
          const { code, device_id } = payload;
          VKID.Auth.exchangeCode(code, device_id)
            .then(async () => {
              const r = await oauthApi.vkidCallback(code, device_id);
              if (!r.ok) { setError(r.data.error || "Ошибка VK"); setOauthLoading(null); return; }
              await finishOAuth(r.data.token, r.data.is_new);
            })
            .catch(() => { setError("Ошибка VK"); setOauthLoading(null); });
        });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).VKIDSDK) {
      renderWidget();
      return;
    }

    // SDK ещё не загружен — грузим через наш бэкенд-прокси (CDN блокируются ORB)
    const existing = document.getElementById("vkid-sdk-script");
    if (existing) {
      existing.addEventListener("load", renderWidget);
      return () => existing.removeEventListener("load", renderWidget);
    }

    const script = document.createElement("script");
    script.id = "vkid-sdk-script";
    script.src = oauthApi.vkidSdkUrl();
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [finishOAuth]);

  const submit = async () => {
    setError(""); setLoading(true);
    const r = mode === "login"
      ? await authApi.login(phone, password)
      : await authApi.register(name, phone, password, city || cityInput);
    setLoading(false);
    if (!r.ok) { setError(r.data.error || "Ошибка"); return; }
    await finishOAuth(r.data.token);
  };





  const loginWithGoogle = async () => {
    setOauthLoading("google");
    const r = await oauthApi.getGoogleUrl();
    setOauthLoading(null);
    if (r.ok) window.location.href = r.data.url;
    else setError(r.data.error || "Google недоступен");
  };

  if (oauthLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
      <div className="text-center animate-fade-in">
        <div className="text-5xl block mb-4 animate-float" style={{ display: "inline-block" }}>🌸</div>
        <p className="text-white/50 text-sm">
          Входим через {oauthLoading === "vk" ? "ВКонтакте" : "Google"}...
        </p>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
        </div>
      </div>
    </div>
  );

  // Новый пользователь через VK/Google — просим выбрать город
  if (needCity) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "hsl(var(--background))" }}>
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 animate-float" style={{ display: "inline-block" }}>📍</div>
          <h2 className="font-oswald text-3xl font-bold text-white mb-2">Ваш город?</h2>
          <p className="text-white/40 text-sm">Это поможет находить букеты рядом с вами</p>
        </div>
        <div className="glass-strong rounded-3xl p-5 space-y-3">
          <div className="relative">
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
              <Icon name="MapPin" size={16} className="text-white/30 flex-shrink-0" />
              <input
                value={cityInput}
                onChange={e => { setCityInput(e.target.value); setCity(""); setShowCitySuggest(true); }}
                onFocus={() => setShowCitySuggest(true)}
                onBlur={() => setTimeout(() => setShowCitySuggest(false), 150)}
                className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
                placeholder="Начните вводить город..."
                autoFocus
              />
              {city && <Icon name="CheckCircle2" size={14} className="text-green-400 flex-shrink-0" />}
            </div>
            {showCitySuggest && citySuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto shadow-2xl" style={{ background: "#150f1c", border: "1px solid rgba(255,255,255,0.1)", maxHeight: 260, backdropFilter: "blur(12px)" }}>
                {citySuggestions.map(c => (
                  <button key={c} onMouseDown={() => { setCity(c); setCityInput(c); setShowCitySuggest(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0">
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => saveCity(city || cityInput)}
            className="btn-gradient w-full rounded-2xl py-4 font-oswald text-lg tracking-wide"
            disabled={!city && !cityInput}>
            {city || cityInput ? "ПРОДОЛЖИТЬ" : "ПРОПУСТИТЬ"}
          </button>
          <button onClick={() => saveCity("")}
            className="w-full text-white/30 text-sm py-2 hover:text-white/50 transition-colors">
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10" style={{ background: "hsl(var(--background))" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10 animate-spin-slow" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />
      </div>
      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 text-4xl animate-float"
            style={{ background: "var(--grad-main)", boxShadow: "0 16px 48px rgba(255,61,139,0.4)" }}>
            🌸
          </div>
          <h1 className="font-oswald text-4xl font-bold shimmer-text">FlowerFlip</h1>
          <p className="text-white/40 mt-1.5 text-sm">Аукцион живых букетов</p>
        </div>

        {/* OAuth блок */}
        <div className="glass-strong rounded-3xl p-5 mb-4">

          {/* VK ID OneTap виджет (появляется когда SDK загрузится) */}
          {VK_LOGIN_ENABLED && (
            <>
              <div ref={vkContainerRef} className="w-full flex justify-center" style={{ minHeight: vkSdkLoaded ? 44 : 0, marginBottom: vkSdkLoaded ? 8 : 0 }} />
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                <span className="text-white/25 text-xs">или по телефону</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              </div>
            </>
          )}

          {/* Переключатель режима */}
          <div className="flex gap-2 mb-4">
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={mode === m
                  ? { background: "var(--grad-main)", color: "#fff" }
                  : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                {m === "login" ? "Войти" : "Регистрация"}
              </button>
            ))}
          </div>

          {/* Форма */}
          <div className="space-y-3">
            {mode === "register" && (
              <>
                <div>
                  <label className="text-white/50 text-sm mb-1.5 block">Имя</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                    placeholder="Ваше имя" />
                </div>
                <div className="relative">
                  <label className="text-white/50 text-sm mb-1.5 block">Город</label>
                  <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
                    <Icon name="MapPin" size={16} className="text-white/30 flex-shrink-0" />
                    <input value={cityInput}
                      onChange={e => { setCityInput(e.target.value); setCity(""); setShowCitySuggest(true); }}
                      onFocus={() => setShowCitySuggest(true)}
                      onBlur={() => setTimeout(() => setShowCitySuggest(false), 150)}
                      className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
                      placeholder="Начните вводить город..." />
                    {city && <Icon name="CheckCircle2" size={14} className="text-green-400 flex-shrink-0" />}
                  </div>
                  {showCitySuggest && citySuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto shadow-2xl" style={{ background: "#150f1c", border: "1px solid rgba(255,255,255,0.1)", maxHeight: 260, backdropFilter: "blur(12px)" }}>
                      {citySuggestions.map(c => (
                        <button key={c} onMouseDown={() => { setCity(c); setCityInput(c); setShowCitySuggest(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0">
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            <div>
              <label className="text-white/50 text-sm mb-1.5 block">Телефон</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
                className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                placeholder="+7 999 000 00 00" />
            </div>
            <div>
              <label className="text-white/50 text-sm mb-1.5 block">Пароль</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none focus:ring-1 focus:ring-pink-500"
                placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2.5 rounded-xl text-sm text-red-400 text-center"
              style={{ background: "rgba(255,61,61,0.1)", border: "1px solid rgba(255,61,61,0.2)" }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            className="btn-gradient w-full rounded-2xl py-4 mt-4 font-oswald text-lg tracking-wide disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full w-5 h-5 border-2 border-white border-t-transparent" />
                Входим...
              </span>
            ) : mode === "login" ? "ВОЙТИ" : "СОЗДАТЬ АККАУНТ"}
          </button>
        </div>

        {/* Дисклеймер */}
        <p className="text-center text-white/20 text-xs px-4">
          Регистрируясь, вы принимаете условия использования сервиса
        </p>
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
            {b.city && (
              <div className="flex items-center gap-1 mt-0.5">
                <Icon name="MapPin" size={10} className="text-pink-400" />
                <span className="text-white/40 text-xs">{b.city}{b.district ? `, ${b.district}` : ""}</span>
              </div>
            )}
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

/* ─── CITY FILTER ────────────────────────────────────────── */
function CityFilter({ city, district, onCity, onDistrict }: {
  city: string; district: string;
  onCity: (c: string) => void; onDistrict: (d: string) => void;
}) {
  const cities = useCities();
  const [open, setOpen] = useState(false);
  const [distOpen, setDistOpen] = useState(false);
  const [input, setInput] = useState(city);
  const suggestions = (input.length > 0 ? cities.filter(c => c.toLowerCase().includes(input.toLowerCase())) : cities).slice(0, 50);
  const districts = getDistricts(city);

  return (
    <div className="glass rounded-2xl p-3 mb-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
            <Icon name="MapPin" size={14} className="text-pink-400 flex-shrink-0" />
            <input value={input} onChange={e => { setInput(e.target.value); setOpen(true); if (!e.target.value) { onCity(""); onDistrict(""); }}}
              onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="Ваш город..." />
            {city && <button onClick={() => { onCity(""); onDistrict(""); setInput(""); }} className="text-white/30 hover:text-white"><Icon name="X" size={12} /></button>}
          </div>
          {open && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto border border-white/10 shadow-2xl"
              style={{ background: "#150f1c", maxHeight: 260, backdropFilter: "blur(12px)" }}>
              {suggestions.map(c => (
                <button key={c} onMouseDown={() => { onCity(c); onDistrict(""); setInput(c); setOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        {city && districts.length > 0 && (
          <div className="relative flex-1">
            <button onClick={() => setDistOpen(v => !v)} onBlur={() => setTimeout(() => setDistOpen(false), 150)}
              className="w-full flex items-center justify-between gap-1 glass rounded-xl px-3 py-2 text-sm outline-none"
              style={{ color: district ? "#fff" : "rgba(255,255,255,0.4)" }}>
              <span className="truncate">{district || "Все районы"}</span>
              <Icon name="ChevronDown" size={13} className="flex-shrink-0 text-white/30" />
            </button>
            {distOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-y-auto border border-white/10 shadow-2xl"
                style={{ background: "#150f1c", maxHeight: 220, backdropFilter: "blur(12px)" }}>
                <button onMouseDown={() => { onDistrict(""); setDistOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white/50 hover:bg-pink-500/20 transition-colors border-b border-white/5">
                  Все районы
                </button>
                {districts.map(d => (
                  <button key={d} onMouseDown={() => { onDistrict(d); setDistOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-pink-500/20 transition-colors border-b border-white/5 last:border-0"
                    style={{ color: district === d ? "var(--neon-pink)" : "rgba(255,255,255,0.8)" }}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {city && (
        <p className="text-white/30 text-xs mt-2 flex items-center gap-1">
          <Icon name="Info" size={11} />
          Передача лично — покупатель и продавец договариваются о встрече
        </p>
      )}
    </div>
  );
}

/* ─── AUCTIONS SCREEN ────────────────────────────────────── */
function AuctionsScreen({ onBid, user }: { onBid: (b: Bouquet) => void; user: User | null }) {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState(user?.city || "");
  const [district, setDistrict] = useState("");

  const load = useCallback(async () => {
    const r = await bouquetsApi.list({
      status: "active", sort: "ends_at",
      city: city || undefined,
      district: district || undefined,
    });
    if (r.ok) setBouquets(r.data.bouquets);
    setLoading(false);
  }, [city, district]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const toggleLike = async (b: Bouquet) => {
    if (!user) return;
    setBouquets(prev => prev.map(x => x.id === b.id ? { ...x, liked: !x.liked } : x));
    await bouquetsApi.favorite(b.id, !b.liked);
  };

  return (
    <div className="animate-fade-in">
      <div className="relative rounded-3xl overflow-hidden mb-4 p-5"
        style={{ background: "linear-gradient(135deg, rgba(255,61,139,0.2) 0%, rgba(168,85,247,0.2) 50%, rgba(255,107,43,0.12) 100%)", border: "1px solid rgba(255,61,139,0.2)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 animate-spin-slow" style={{ background: "radial-gradient(circle, #ff3d8b, transparent)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">LIVE — {bouquets.length} аукционов</span>
          </div>
          <h2 className="font-oswald text-2xl font-bold text-white">Живые <span className="gradient-text">букеты</span></h2>
          <p className="text-white/40 text-xs mt-0.5">Самовывоз — без доставки, только личная встреча</p>
        </div>
      </div>

      <CityFilter city={city} district={district} onCity={c => { setCity(c); setDistrict(""); }} onDistrict={setDistrict} />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="glass rounded-2xl h-64 animate-pulse" />)}
        </div>
      ) : bouquets.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-6xl block mb-4">🌸</span>
          <p className="text-white/50 font-oswald text-xl">
            {city ? `В ${city} пока нет аукционов` : "Нет активных аукционов"}
          </p>
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
  const PRICE_CAP = 1000000;
  const [priceMax, setPriceMax] = useState(PRICE_CAP);
  const noPriceLimit = priceMax >= PRICE_CAP;
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(user?.city || "");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    setLoading(true);
    bouquetsApi.list({
      status: "active",
      tag: activeTag !== "все" ? activeTag : undefined,
      sort: sortBy,
      max_price: noPriceLimit ? undefined : priceMax,
      city: city || undefined,
      district: district || undefined,
    }).then(r => { if (r.ok) setBouquets(r.data.bouquets); setLoading(false); });
  }, [activeTag, sortBy, priceMax, noPriceLimit, city, district]);

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
      <CityFilter city={city} district={district} onCity={c => { setCity(c); setDistrict(""); }} onDistrict={setDistrict} />
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
          {noPriceLimit ? (
            <span className="gradient-text font-oswald font-bold text-lg">Без ограничения</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={priceMax}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (v >= 0) setPriceMax(Math.min(v, PRICE_CAP));
                }}
                onBlur={e => { if (!e.target.value || Number(e.target.value) < 500) setPriceMax(500); }}
                className="w-28 bg-transparent text-right font-oswald font-bold text-lg outline-none border-b border-pink-500/50 focus:border-pink-500 text-white transition-colors"
                style={{ color: "var(--neon-pink)" }}
              />
              <span className="text-white/50 font-oswald font-bold text-lg">₽</span>
            </div>
          )}
        </div>
        <input type="range" min={500} max={PRICE_CAP} step={500} value={noPriceLimit ? PRICE_CAP : priceMax}
          onChange={e => setPriceMax(Number(e.target.value))} className="w-full accent-pink-500" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-white/25 text-xs">500 ₽</span>
          <button onClick={() => setPriceMax(noPriceLimit ? 5000 : PRICE_CAP)}
            className="text-pink-400 text-xs hover:text-pink-300 transition-colors">
            {noPriceLimit ? "Задать ограничение" : "Снять ограничение"}
          </button>
          <span className="text-white/25 text-xs">∞</span>
        </div>
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
  const [sellCity, setSellCity] = useState(user?.city || "");
  const [sellDistrict, setSellDistrict] = useState("");
  const [meetPoint, setMeetPoint] = useState("");
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
      city: sellCity || undefined,
      district: sellDistrict || undefined,
      meet_point: meetPoint || undefined,
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
          <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" className="hidden" onChange={handleFile} />
          {images.length > 0 ? (
            <div className="mb-2">
              <div className="flex gap-2 flex-wrap mb-2">
                {images.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} className="w-20 h-20 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "#ef4444", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                      <Icon name="X" size={11} className="text-white" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 text-white text-xs px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: "rgba(0,0,0,0.6)", fontSize: "9px" }}>гл.</span>
                    )}
                  </div>
                ))}
                {images.length < 5 && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1 border-2 border-dashed transition-colors"
                    style={{ borderColor: "rgba(255,61,139,0.4)", background: "rgba(255,61,139,0.05)" }}>
                    {uploading
                      ? <div className="animate-spin rounded-full w-6 h-6 border-2 border-pink-400 border-t-transparent" />
                      : <><Icon name="Plus" size={20} style={{ color: "var(--neon-pink)" }} /><span className="text-white/40 text-xs">фото</span></>
                    }
                  </button>
                )}
              </div>
              <p className="text-white/30 text-xs">{images.length} из 5 · первое — главное</p>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="rounded-3xl border-2 border-dashed mb-2 flex flex-col items-center justify-center py-10 cursor-pointer"
              style={{ borderColor: "rgba(255,61,139,0.3)", background: "rgba(255,61,139,0.05)" }}>
              {uploading ? (
                <div className="animate-spin rounded-full w-8 h-8 border-2 border-pink-400 border-t-transparent" />
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 animate-float" style={{ background: "rgba(255,61,139,0.15)" }}>
                    <Icon name="Camera" size={26} style={{ color: "var(--neon-pink)" }} />
                  </div>
                  <p className="text-white/60 font-medium">Добавить фото</p>
                  <p className="text-white/30 text-sm mt-1">до 5 · jpg, png, webp, heic</p>
                </>
              )}
            </div>
          )}
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
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Город передачи</label>
            <CityFilter
              city={sellCity} district={sellDistrict}
              onCity={c => { setSellCity(c); setSellDistrict(""); }}
              onDistrict={setSellDistrict}
            />
          </div>
          <div>
            <label className="text-white/50 text-sm mb-1.5 block">Удобное место встречи <span className="text-white/30">(необязательно)</span></label>
            <input value={meetPoint} onChange={e => setMeetPoint(e.target.value)}
              className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none"
              placeholder="Напр.: метро Сокольники, ТЦ Мега..." />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in-up">
          <div className="glass rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-white/50 text-sm font-medium">Подтверждение</p>
            {[["Название", title || "—"], ["Состав", flowers || "—"], ["Свежесть", freshness],
              ["Начальная цена", formatPrice(parseFloat(price) || 500)],
              ["Длительность", `${duration} ч`], ["Фото", `${images.length} шт`],
              ["Город", sellCity || "не указан"],
              ...(sellDistrict ? [["Район", sellDistrict]] : []),
              ...(meetPoint ? [["Место встречи", meetPoint]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-white/40">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
            {[["Комиссия платформы", "12% от суммы"], ["Выплата продавцу", "после подтверждения"], ["Передача букета", "лично, без курьера"], ["Способы вывода", "Карта, СБП, кошелёк"]].map(([k, v]) => (
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


/* ─── DEALS SCREEN (ESCROW) ──────────────────────────────── */
function DealsScreen({ user }: { user: User | null }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Deal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [disputeText, setDisputeText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [dealMessages, setDealMessages] = useState<Message[]>([]);
  const [dealChatText, setDealChatText] = useState("");
  const [dealChatSending, setDealChatSending] = useState(false);
  const dealChatBottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const r = await escrowApi.myDeals();
    if (r.ok) setDeals(r.data.deals);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const loadDealChat = useCallback(async (deal: Deal) => {
    if (!user) return;
    const otherId = deal.is_buyer ? deal.seller_id : deal.buyer_id;
    const bouquetId = deal.id; // orders.id → связан с bouquet через join, но используем bouquet через deal title
    // Получаем messages по other_id — все сообщения между двумя пользователями по этой сделке
    const r = await profileApi.messages(otherId);
    if (r.ok) setDealMessages(r.data.messages);
  }, [user]);

  useEffect(() => {
    if (active) { setDealMessages([]); setDealChatText(""); loadDealChat(active); }
  }, [active, loadDealChat]);

  useEffect(() => { dealChatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dealMessages]);

  const sendDealMessage = async () => {
    if (!active || !dealChatText.trim() || dealChatSending || !user) return;
    setDealChatSending(true);
    const otherId = active.is_buyer ? active.seller_id : active.buyer_id;
    const r = await profileApi.sendMessage(otherId, dealChatText.trim());
    setDealChatSending(false);
    if (r.ok) {
      setDealMessages(prev => [...prev, { id: r.data.id, sender_id: user.id, text: dealChatText.trim(), created_at: r.data.created_at, is_read: false }]);
      setDealChatText("");
    }
  };

  const doConfirm = async (deal: Deal) => {
    setActionLoading(true); setMsg("");
    const r = await escrowApi.confirm(deal.id);
    setActionLoading(false);
    setMsg(r.ok ? r.data.message : r.data.error);
    if (r.ok) load();
  };

  const doDispute = async (deal: Deal) => {
    if (!disputeText.trim()) return;
    setActionLoading(true); setMsg("");
    const r = await escrowApi.dispute(deal.id, disputeText);
    setActionLoading(false);
    setMsg(r.ok ? r.data.message : r.data.error);
    if (r.ok) { setShowDispute(false); load(); }
  };

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🤝</span>
      <p className="text-white/50 font-oswald text-xl">Войдите, чтобы видеть сделки</p>
    </div>
  );

  if (active) {
    const st = ESCROW_STATUS[active.escrow_status] || { label: active.escrow_status, color: "#fff", icon: "Circle", desc: "" };
    const timeLeft = active.auto_confirm_at
      ? Math.max(0, Math.floor((new Date(active.auto_confirm_at).getTime() - Date.now()) / 3600000))
      : null;
    return (
      <div className="animate-fade-in">
        <button onClick={() => { setActive(null); setMsg(""); setShowDispute(false); }}
          className="flex items-center gap-2 text-white/50 hover:text-white mb-4 transition-colors">
          <Icon name="ArrowLeft" size={18} /> Назад к сделкам
        </button>

        {/* Шапка сделки */}
        <div className="glass rounded-2xl overflow-hidden mb-4">
          {active.image_urls?.[0] && <img src={active.image_urls[0]} className="w-full h-40 object-cover" />}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-oswald text-xl font-bold text-white">{active.title}</h3>
                {active.city && (
                  <div className="flex items-center gap-1 mt-1">
                    <Icon name="MapPin" size={12} className="text-pink-400" />
                    <span className="text-white/50 text-xs">{active.city}{active.district ? `, ${active.district}` : ""}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="gradient-text font-oswald text-xl font-bold">{formatPrice(active.amount)}</p>
                <p className="text-white/40 text-xs">комиссия {formatPrice(active.commission)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl" style={{ background: `${st.color}15`, border: `1px solid ${st.color}40` }}>
              <Icon name={st.icon as "Clock"} size={16} style={{ color: st.color }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: st.color }}>{st.label}</p>
                <p className="text-white/40 text-xs">{st.desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Контакты (после оплаты) */}
        {active.escrow_status === "paid" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(6,214,222,0.3)" }}>
            <p className="text-white/50 text-xs mb-3 font-medium uppercase tracking-wide">Контакты для встречи</p>
            {active.is_buyer && active.seller_phone && (
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white/40 text-xs">Продавец</p>
                  <p className="text-white font-medium">{active.seller_name}</p>
                </div>
                <a href={`tel:${active.seller_phone}`}
                  className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Icon name="Phone" size={14} />
                  {active.seller_phone}
                </a>
              </div>
            )}
            {active.is_seller && active.buyer_phone && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/40 text-xs">Покупатель</p>
                  <p className="text-white font-medium">{active.buyer_name}</p>
                </div>
                <a href={`tel:${active.buyer_phone}`}
                  className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Icon name="Phone" size={14} />
                  {active.buyer_phone}
                </a>
              </div>
            )}
            {timeLeft !== null && timeLeft > 0 && active.is_buyer && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                <Icon name="Clock" size={14} className="text-white/30" />
                <p className="text-white/30 text-xs">Авто-подтверждение через {timeLeft} ч если не нажмёте кнопку</p>
              </div>
            )}
          </div>
        )}

        {/* Действия покупателя */}
        {active.is_buyer && active.escrow_status === "paid" && (
          <div className="space-y-3 mb-4">
            <button onClick={() => doConfirm(active)} disabled={actionLoading}
              className="btn-gradient w-full rounded-2xl py-4 font-oswald text-lg tracking-wide disabled:opacity-50 flex items-center justify-center gap-2">
              <Icon name="CheckCircle2" size={20} />
              {actionLoading ? "..." : "ПОДТВЕРДИТЬ ПОЛУЧЕНИЕ"}
            </button>
            <p className="text-white/30 text-xs text-center">
              Нажмите только после того как физически получили букет
            </p>
            {!showDispute ? (
              <button onClick={() => setShowDispute(true)}
                className="w-full glass rounded-2xl py-3 text-sm text-white/50 hover:text-white transition-colors">
                Есть проблема с букетом
              </button>
            ) : (
              <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,107,43,0.3)" }}>
                <p className="text-white/60 text-sm mb-2">Опишите проблему:</p>
                <textarea value={disputeText} onChange={e => setDisputeText(e.target.value)}
                  className="glass w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm outline-none mb-3 resize-none"
                  rows={3} placeholder="Букет не получен, не соответствует описанию..." />
                <div className="flex gap-2">
                  <button onClick={() => setShowDispute(false)} className="flex-1 glass rounded-xl py-2 text-sm text-white/50">Отмена</button>
                  <button onClick={() => doDispute(active)} disabled={actionLoading || !disputeText.trim()}
                    className="flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "var(--neon-orange)" }}>
                    {actionLoading ? "..." : "Открыть спор"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Статус для продавца */}
        {active.is_seller && active.escrow_status === "paid" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
            <div className="flex items-start gap-3">
              <Icon name="Info" size={16} className="text-pink-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-white/60 space-y-1">
                <p>Передайте букет покупателю лично. Деньги поступят на баланс после его подтверждения.</p>
                <p className="text-white/40">Получите: <span className="text-green-400 font-semibold">{formatPrice(active.amount - active.commission)}</span></p>
              </div>
            </div>
          </div>
        )}

        {active.escrow_status === "completed" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(74,222,128,0.3)" }}>
            <div className="flex items-center gap-3">
              <Icon name="CheckCircle2" size={20} className="text-green-400" />
              <div>
                <p className="text-white font-medium text-sm">Сделка успешно завершена</p>
                {active.is_seller && <p className="text-green-400 text-xs">{formatPrice(active.amount - active.commission)} зачислено на баланс</p>}
              </div>
            </div>
          </div>
        )}

        {active.escrow_status === "dispute" && (
          <div className="glass rounded-2xl p-4 mb-4" style={{ border: "1px solid rgba(255,107,43,0.3)" }}>
            <div className="flex items-start gap-3">
              <Icon name="AlertTriangle" size={16} style={{ color: "var(--neon-orange)" }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Открыт спор</p>
                <p className="text-white/50 text-xs mt-0.5">{active.dispute_reason}</p>
                <p className="text-white/30 text-xs mt-1">Модератор рассмотрит в течение 24 часов</p>
              </div>
            </div>
          </div>
        )}

        {msg && <p className={`text-sm text-center p-3 rounded-xl mb-3 ${msg.includes("ошибка") || msg.includes("Не") || msg.includes("нельзя") ? "text-red-400" : "text-green-400"}`}
          style={{ background: "rgba(255,255,255,0.05)" }}>{msg}</p>}

        {/* Переписка по сделке */}
        {(active.escrow_status === "paid" || active.escrow_status === "completed" || active.escrow_status === "dispute") && (
          <div className="glass rounded-2xl p-4 mb-4">
            <p className="text-white/50 text-xs mb-3 font-medium uppercase tracking-wide flex items-center gap-2">
              <Icon name="MessageCircle" size={13} />
              Переписка по сделке
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-3">
              {dealMessages.length === 0
                ? <p className="text-white/20 text-xs text-center py-4">Нет сообщений</p>
                : dealMessages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === user!.id ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%] px-3 py-2 rounded-2xl text-sm"
                      style={m.sender_id === user!.id
                        ? { background: "var(--grad-main)", color: "#fff" }
                        : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)" }}>
                      <p>{m.text}</p>
                      <p className="text-xs mt-0.5 opacity-50">{timeAgo(m.created_at)}</p>
                    </div>
                  </div>
                ))
              }
              <div ref={dealChatBottomRef} />
            </div>
            {active.escrow_status !== "completed" && active.escrow_status !== "dispute" && (
              <div className="flex gap-2">
                <input value={dealChatText} onChange={e => setDealChatText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendDealMessage()}
                  className="flex-1 glass rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 text-sm outline-none"
                  placeholder="Сообщение продавцу..." />
                <button onClick={sendDealMessage} disabled={dealChatSending || !dealChatText.trim()}
                  className="btn-gradient w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                  <Icon name="Send" size={14} className="text-white" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-1">Мои сделки</h2>
      <p className="text-white/40 text-sm mb-5">Безопасная передача букетов</p>

      {/* Схема работы */}
      <div className="glass rounded-2xl p-4 mb-5">
        <p className="text-white/50 text-xs font-medium mb-3 uppercase tracking-wide">Как работает безопасная сделка</p>
        <div className="space-y-2">
          {[
            { icon: "CreditCard", color: "#a855f7", text: "Победитель оплачивает — деньги замораживаются у платформы" },
            { icon: "Phone", color: "#06d6de", text: "Открываются телефоны — договоритесь о встрече" },
            { icon: "Handshake", color: "#ff3d8b", text: "Передача лично — без курьеров и доставки" },
            { icon: "CheckCircle2", color: "#4ade80", text: "Покупатель подтверждает — деньги уходят продавцу" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}20` }}>
                <Icon name={s.icon as "CreditCard"} size={13} style={{ color: s.color }} />
              </div>
              <p className="text-white/60 text-xs">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">{[1,2].map(i => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}</div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">🤝</span>
          <p className="text-white/50">Активных сделок нет</p>
          <p className="text-white/30 text-xs mt-1">Участвуйте в аукционах!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {deals.map((d, i) => {
            const st = ESCROW_STATUS[d.escrow_status] || { label: d.escrow_status, color: "#fff", icon: "Circle", desc: "" };
            return (
              <div key={d.id} onClick={() => { setActive(d); setMsg(""); }}
                className={`glass rounded-2xl p-4 card-hover cursor-pointer animate-fade-in-up delay-${Math.min((i+1)*100, 500)}`}>
                <div className="flex items-center gap-3">
                  {d.image_urls?.[0]
                    ? <img src={d.image_urls[0]} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "rgba(255,61,139,0.1)" }}>🌸</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium text-sm truncate">{d.title}</p>
                      <span className="font-oswald font-bold ml-2 flex-shrink-0" style={{ color: st.color }}>{formatPrice(d.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: st.color }}>{st.label}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-white/30 text-xs">{d.is_buyer ? `от ${d.seller_name}` : `покупатель ${d.buyer_name}`}</span>
                    </div>
                    {d.city && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon name="MapPin" size={10} className="text-white/30" />
                        <span className="text-white/30 text-xs">{d.city}</span>
                      </div>
                    )}
                  </div>
                  <Icon name="ChevronRight" size={16} className="text-white/20 flex-shrink-0" />
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
function ProfileScreen({ user, onLogout, onStartTour }: { user: User | null; onLogout: () => void; onStartTour?: () => void }) {
  const [tab, setTab] = useState<"about" | "reviews" | "chat">("about");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [sales, setSales] = useState<{ id: number; title: string; current_price: number; status: string; bids_count: number }[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [payoutMethod, setPayoutMethod] = useState(user?.payout_method || "card");
  const [payoutDetails, setPayoutDetails] = useState(user?.payout_details || "");
  const [payoutSaved, setPayoutSaved] = useState("");
  const [withdrawals, setWithdrawals] = useState<{ id: number; amount: number; method: string; details: string; status: string; admin_comment?: string; created_at: string }[]>([]);
  const { isIos, isStandalone, canInstall, promptInstall } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  const installApp = async () => {
    const res = await promptInstall();
    if (res === "ios") setShowIosGuide(true);
  };

  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);
  const [cancelMsg, setCancelMsg] = useState("");

  const loadWithdrawals = useCallback(() => {
    profileApi.withdrawals().then(r => { if (r.ok) setWithdrawals(r.data.withdrawals); });
  }, []);

  const loadSales = useCallback(() => {
    profileApi.mySales().then(r => { if (r.ok) setSales(r.data.sales); });
  }, []);

  const cancelSale = async (id: number) => {
    const r = await bouquetsApi.cancel(id);
    if (r.ok) { setCancelConfirm(null); setCancelMsg(""); loadSales(); }
    else { setCancelMsg(r.data.error || "Ошибка"); }
  };

  useEffect(() => {
    if (!user) return;
    if (tab === "reviews") profileApi.reviews().then(r => { if (r.ok) setReviews(r.data.reviews); });
    if (tab === "chat") profileApi.chats().then(r => { if (r.ok) setChats(r.data.chats); });
    if (tab === "about") { loadSales(); loadWithdrawals(); }
  }, [tab, user, loadSales, loadWithdrawals]);

  if (!user) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">👤</span>
      <p className="text-white/50 font-oswald text-xl">Войдите в аккаунт</p>
    </div>
  );

  if (activeChat) return <ChatWindow chat={activeChat} user={user} onBack={() => setActiveChat(null)} />;

  const savePayout = async () => {
    if (!payoutDetails.trim()) { setPayoutSaved("Укажите реквизиты"); return; }
    const r = await profileApi.savePayout(payoutMethod, payoutDetails.trim());
    setPayoutSaved(r.ok ? "Реквизиты сохранены" : (r.data.error || "Ошибка"));
  };

  const doWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount) { setWithdrawMsg("Укажите сумму"); return; }
    const r = await profileApi.withdraw(amount, payoutMethod, payoutDetails.trim());
    setWithdrawMsg(r.ok ? r.data.message : r.data.error);
    if (r.ok) { setWithdrawAmount(""); loadWithdrawals(); }
  };

  const doTopup = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 10) { setWithdrawMsg("Минимальная сумма пополнения 10 ₽"); return; }
    const r = await paymentApi.topup(amount);
    if (r.ok && r.data.confirmation_url) {
      window.location.href = r.data.confirmation_url;
    } else {
      setWithdrawMsg(r.data.error || "Оплата временно недоступна");
    }
  };

  const methodLabel: Record<string, string> = { card: "Карта", sbp: "СБП", wallet: "Кошелёк" };
  const statusLabel: Record<string, string> = { pending: "В обработке", paid: "Выплачено", rejected: "Отклонено" };
  const statusColor: Record<string, string> = { pending: "text-yellow-400", paid: "text-green-400", rejected: "text-red-400" };

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
            <p className="text-white/40 text-xs mb-4">Доступно к выводу</p>

            {/* Способ вывода */}
            <p className="text-white/40 text-xs mb-2">Способ получения</p>
            <div className="flex gap-2 mb-3">
              {[["card", "Карта", "CreditCard"], ["sbp", "СБП", "Smartphone"], ["wallet", "Кошелёк", "Wallet"]].map(([m, l, ic]) => (
                <button key={m} onClick={() => setPayoutMethod(m)}
                  className="flex-1 rounded-xl py-2.5 flex flex-col items-center gap-1 transition-colors text-xs"
                  style={payoutMethod === m
                    ? { background: "var(--grad-main)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  <Icon name={ic as "CreditCard"} size={16} />
                  <span>{l}</span>
                </button>
              ))}
            </div>

            {/* Реквизиты */}
            <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 mb-2">
              <Icon name="CreditCard" size={14} className="text-white/30 flex-shrink-0" />
              <input value={payoutDetails} onChange={e => { setPayoutDetails(e.target.value); setPayoutSaved(""); }}
                className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-white/30"
                placeholder={payoutMethod === "sbp" ? "Номер телефона" : payoutMethod === "wallet" ? "Номер кошелька" : "Номер карты"} />
              <button onClick={savePayout} className="text-pink-400 text-xs font-medium hover:text-pink-300 flex-shrink-0">Сохранить</button>
            </div>
            {payoutSaved && <p className={`text-xs mb-2 ${payoutSaved.includes("сохранены") ? "text-green-400" : "text-red-400"}`}>{payoutSaved}</p>}

            {/* Сумма вывода */}
            <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 mb-3 mt-3">
              <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} type="number"
                className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-white/30"
                placeholder="Сумма для вывода" />
              <span className="text-white/40 text-sm">₽</span>
            </div>
            {withdrawMsg && <p className={`text-sm mb-3 ${withdrawMsg.includes("принята") ? "text-green-400" : "text-red-400"}`}>{withdrawMsg}</p>}
            <div className="flex gap-2">
              <button onClick={doTopup}
                className="flex-1 glass rounded-xl py-3 font-oswald text-base tracking-wide text-white hover:bg-white/10 transition-colors">
                ПОПОЛНИТЬ
              </button>
              <button onClick={doWithdraw}
                className="flex-1 btn-gradient rounded-xl py-3 font-oswald text-base tracking-wide"
                disabled={user.balance <= 0}>
                ВЫВЕСТИ
              </button>
            </div>

            {/* История выводов */}
            {withdrawals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-white/40 text-xs mb-2">История выводов</p>
                <div className="space-y-2">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-white/70">{formatPrice(w.amount)}</span>
                        <span className="text-white/30 text-xs ml-2">{methodLabel[w.method] || w.method}</span>
                      </div>
                      <span className={`text-xs ${statusColor[w.status]}`}>{statusLabel[w.status] || w.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-white/50 text-sm mb-3 font-medium">Мои аукционы</p>
            {cancelMsg && <p className="text-red-400 text-xs mb-2">{cancelMsg}</p>}
            {sales.length === 0 ? (
              <p className="text-white/30 text-sm">Вы ещё не выставляли букеты</p>
            ) : (
              <div className="space-y-2">
                {sales.map(s => (
                  <div key={s.id} className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="gradient-text text-sm font-semibold">{formatPrice(s.current_price)}</span>
                        <span className="text-white/30 text-xs">{s.bids_count} ст.</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            background: s.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                            color: s.status === "active" ? "#4ade80" : "rgba(255,255,255,0.3)"
                          }}>
                          {s.status === "active" ? "активен" : s.status === "won" ? "продан" : s.status === "expired" ? "истёк" : s.status}
                        </span>
                      </div>
                    </div>
                    {s.status === "active" && s.bids_count === 0 && (
                      cancelConfirm === s.id ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => cancelSale(s.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: "rgba(239,68,68,0.8)" }}>
                            Да, снять
                          </button>
                          <button onClick={() => { setCancelConfirm(null); setCancelMsg(""); }}
                            className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 glass">
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setCancelConfirm(s.id); setCancelMsg(""); }}
                          className="flex-shrink-0 glass p-2 rounded-xl hover:text-red-400 transition-colors text-white/30"
                          title="Снять с аукциона">
                          <Icon name="Trash2" size={15} />
                        </button>
                      )
                    )}
                    {s.status === "active" && s.bids_count > 0 && (
                      <span className="flex-shrink-0 text-white/20 text-xs" title="Есть ставки — нельзя снять">
                        <Icon name="Lock" size={13} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Установка приложения */}
          {!isStandalone && (
            <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,61,139,0.2)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                  style={{ background: "var(--grad-main)" }}>🌸</div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">Установить приложение</p>
                  <p className="text-white/40 text-xs mt-0.5">Быстрый доступ с экрана телефона</p>
                </div>
              </div>
              {isIos ? (
                <button onClick={() => setShowIosGuide(true)}
                  className="btn-gradient w-full rounded-xl py-3 font-oswald text-base tracking-wide">
                  КАК УСТАНОВИТЬ НА IPHONE
                </button>
              ) : canInstall ? (
                <button onClick={installApp}
                  className="btn-gradient w-full rounded-xl py-3 font-oswald text-base tracking-wide">
                  УСТАНОВИТЬ
                </button>
              ) : (
                <p className="text-white/30 text-xs text-center py-2">
                  Откройте сайт в Chrome или Safari и используйте меню браузера → «Установить приложение»
                </p>
              )}
            </div>
          )}

          {/* iOS guide modal (в профиле) */}
          {showIosGuide && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center p-4"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
              onClick={() => setShowIosGuide(false)}>
              <div className="glass-strong rounded-3xl p-6 w-full max-w-sm animate-fade-in-up"
                onClick={e => e.stopPropagation()}>
                <div className="text-center mb-5">
                  <span className="text-4xl block mb-2">📱</span>
                  <h3 className="font-oswald text-xl font-bold text-white">Установить на iPhone</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { step: "1", text: "Нажмите кнопку «Поделиться»", sub: "значок снизу экрана браузера Safari" },
                    { step: "2", text: "Выберите «На экран «Домой»»", sub: "прокрутите список действий вниз" },
                    { step: "3", text: "Нажмите «Добавить»", sub: "приложение появится на рабочем столе" },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
                        style={{ background: "var(--grad-main)" }}>{s.step}</div>
                      <div>
                        <p className="text-white text-sm font-medium">{s.text}</p>
                        <p className="text-white/40 text-xs mt-0.5">{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowIosGuide(false)}
                  className="btn-gradient w-full rounded-2xl py-3 mt-5 font-oswald tracking-wide">
                  ПОНЯТНО
                </button>
              </div>
            </div>
          )}

          {/* Поддержка */}
          <div className="glass rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/50 text-sm mb-3 font-medium">Поддержка и контакты</p>
            <div className="space-y-2">
              <a href="mailto:flowerflip@flowerflip.ru"
                className="flex items-center gap-3 glass rounded-xl px-4 py-3 hover:text-white transition-colors group">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,61,139,0.15)" }}>
                  <Icon name="Mail" size={15} style={{ color: "var(--neon-pink)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm group-hover:text-white transition-colors">flowerflip@flowerflip.ru</p>
                  <p className="text-white/30 text-xs">Напишите нам по любому вопросу</p>
                </div>
                <Icon name="ExternalLink" size={13} className="text-white/20 flex-shrink-0" />
              </a>
              <div className="flex items-center gap-3 px-4 py-2">
                <Icon name="Shield" size={13} className="text-white/20 flex-shrink-0" />
                <p className="text-white/25 text-xs">Все сделки защищены системой эскроу</p>
              </div>
              <div className="flex items-center gap-3 px-4 py-2">
                <Icon name="Clock" size={13} className="text-white/20 flex-shrink-0" />
                <p className="text-white/25 text-xs">Ответ в течение 24 часов в рабочие дни</p>
              </div>
              {onStartTour && (
                <button onClick={onStartTour}
                  className="flex items-center gap-3 glass rounded-xl px-4 py-3 w-full hover:bg-white/5 transition-colors group">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(168,85,247,0.15)" }}>
                    <Icon name="GraduationCap" size={15} style={{ color: "#a855f7" }} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white/70 text-sm group-hover:text-white transition-colors">Повторить обучение</p>
                    <p className="text-white/30 text-xs">Пройти тур по функциям заново</p>
                  </div>
                </button>
              )}
            </div>
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

/* ─── ADMIN SCREEN ───────────────────────────────────────── */
interface AdminWithdrawal {
  id: number; amount: number; method: string; details: string; status: string;
  admin_comment?: string; created_at: string; user_id: number; user_name: string; user_phone: string;
}
interface AdminStats {
  total_commission: number; pending_count: number; pending_amount: number;
  paid_total: number; users_count: number; completed_orders: number;
}

function AdminScreen({ user }: { user: User | null }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [items, setItems] = useState<AdminWithdrawal[]>([]);
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    adminApi.stats().then(r => { if (r.ok) setStats(r.data); });
    adminApi.withdrawals(filter || undefined).then(r => { if (r.ok) setItems(r.data.withdrawals); });
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: number, type: "approve" | "reject") => {
    setBusy(id);
    const r = type === "approve" ? await adminApi.approve(id) : await adminApi.reject(id);
    setBusy(null);
    setMsg(r.ok ? r.data.message : (r.data.error || "Ошибка"));
    if (r.ok) load();
  };

  const methodLabel: Record<string, string> = { card: "Карта", sbp: "СБП", wallet: "Кошелёк" };
  const statusLabel: Record<string, string> = { pending: "В обработке", paid: "Выплачено", rejected: "Отклонено" };
  const statusColor: Record<string, string> = { pending: "text-yellow-400", paid: "text-green-400", rejected: "text-red-400" };

  if (!user?.is_admin) return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">🔒</span>
      <p className="text-white/50 font-oswald text-xl">Доступ только для администратора</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h2 className="font-oswald text-2xl font-bold text-white mb-4">Админ-панель</h2>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="glass rounded-2xl p-4">
            <p className="gradient-text font-oswald text-2xl font-bold">{formatPrice(stats.total_commission)}</p>
            <p className="text-white/40 text-xs mt-1">Комиссия платформы</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="font-oswald text-2xl font-bold text-yellow-400">{formatPrice(stats.pending_amount)}</p>
            <p className="text-white/40 text-xs mt-1">Заявок на вывод: {stats.pending_count}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="font-oswald text-2xl font-bold text-white">{stats.users_count}</p>
            <p className="text-white/40 text-xs mt-1">Пользователей</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="font-oswald text-2xl font-bold text-white">{stats.completed_orders}</p>
            <p className="text-white/40 text-xs mt-1">Завершённых сделок</p>
          </div>
        </div>
      )}

      {msg && <p className="text-sm mb-3 text-center text-pink-400">{msg}</p>}

      {/* Фильтр статусов */}
      <div className="flex gap-2 mb-4">
        {[["pending", "Новые"], ["paid", "Выплачено"], ["rejected", "Отклонено"], ["", "Все"]].map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
            style={filter === f ? { background: "var(--grad-main)", color: "#fff" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Заявки */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">📭</span>
          <p className="text-white/40 text-sm">Нет заявок</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(w => (
            <div key={w.id} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-medium">{w.user_name}</p>
                  <p className="text-white/40 text-xs">{w.user_phone}</p>
                </div>
                <span className={`text-xs ${statusColor[w.status]}`}>{statusLabel[w.status] || w.status}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="gradient-text font-oswald text-xl font-bold">{formatPrice(w.amount)}</span>
                <span className="text-white/50 text-sm">{methodLabel[w.method] || w.method}</span>
              </div>
              <div className="glass rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                <Icon name="CreditCard" size={14} className="text-white/30" />
                <span className="text-white/70 text-sm font-mono">{w.details}</span>
              </div>
              {w.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => act(w.id, "approve")} disabled={busy === w.id}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-colors"
                    style={{ background: "rgba(34,197,94,0.8)" }}>
                    Выплачено
                  </button>
                  <button onClick={() => act(w.id, "reject")} disabled={busy === w.id}
                    className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-colors"
                    style={{ background: "rgba(239,68,68,0.8)" }}>
                    Отклонить
                  </button>
                </div>
              )}
              <p className="text-white/30 text-xs mt-2">{new Date(w.created_at).toLocaleString("ru-RU")}</p>
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
  const { show: showOnboarding, start: startOnboarding, finish: finishOnboarding, triggerIfNew } = useOnboarding();

  useEffect(() => {
    const token = localStorage.getItem("ff_token");
    if (!token) { setAuthChecked(true); return; }
    authApi.me().then(r => {
      if (r.ok) setUser(r.data.user);
      else localStorage.removeItem("ff_token");
      setAuthChecked(true);
    });
  }, []);

  // Запускаем онбординг при первом входе — навигация уже отрендерена
  useEffect(() => {
    if (user && authChecked) triggerIfNew();
  }, [user, authChecked, triggerIfNew]);

  const handleAuth = (u: User, _token?: string) => { setUser(u); };
  const handleLogout = async () => {
    await authApi.logout();
    localStorage.removeItem("ff_token");
    setUser(null);
  };

  const handleBid = (_id: number, _amount: number) => {
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

      <InstallBanner />

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
        {activeTab === "deals" && <DealsScreen user={user} />}
        {activeTab === "profile" && <ProfileScreen user={user} onLogout={handleLogout} onStartTour={startOnboarding} />}
        {activeTab === "admin" && <AdminScreen user={user} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-strong">
        <div className="max-w-lg mx-auto px-1 py-2 flex items-center justify-around">
          {(user?.is_admin ? [...TABS, { id: "admin", label: "Админ", icon: "ShieldCheck" }] : TABS).map(tab => {
            const isActive = activeTab === tab.id;
            const isAdmin = tab.id === "admin";
            return (
              <button key={tab.id} id={`tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 rounded-2xl transition-all duration-200 relative"
                style={{
                  padding: isAdmin ? "6px 8px" : "6px 10px",
                  background: isActive ? (isAdmin ? "rgba(168,85,247,0.15)" : "rgba(255,61,139,0.12)") : "transparent"
                }}>
                {tab.id === "sell" ? (
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center -mt-5 shadow-lg" style={{ background: "var(--grad-main)" }}>
                    <Icon name={tab.icon as "PlusCircle"} size={20} className="text-white" />
                  </div>
                ) : (
                  <Icon name={tab.icon as "Zap"} size={isAdmin ? 18 : 20}
                    style={{ color: isActive ? (isAdmin ? "#a855f7" : "var(--neon-pink)") : "rgba(255,255,255,0.35)" }} />
                )}
                <span className="font-medium" style={{
                  fontSize: isAdmin ? "9px" : "12px",
                  color: isActive ? (isAdmin ? "#a855f7" : "var(--neon-pink)") : "rgba(255,255,255,0.35)",
                  marginTop: tab.id === "sell" ? "2px" : "0"
                }}>
                  {tab.label}
                </span>
                {isActive && tab.id !== "sell" && <div className="absolute -bottom-0.5 w-1 h-1 rounded-full" style={{ background: "var(--neon-pink)" }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {bidModal && <BidModal bouquet={bidModal} onClose={() => setBidModal(null)} onBid={handleBid} />}
      {showOnboarding && <OnboardingTour onFinish={finishOnboarding} />}
    </div>
  );
}