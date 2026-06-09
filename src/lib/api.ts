const URLS = {
  auth: "https://functions.poehali.dev/160e4bcc-5354-4955-b417-dcd385abfe11",
  bouquets: "https://functions.poehali.dev/c984e344-489c-4df8-b265-e621f407f1c2",
  profile: "https://functions.poehali.dev/e0242723-8c00-4366-807f-86615a61bb2e",
  upload: "https://functions.poehali.dev/3da42e9b-d4f0-4fa7-91fa-b25481552ce1",
  escrow: "https://functions.poehali.dev/e88eb917-34d3-4efd-b11e-fdea4f137322",
  oauth: "https://functions.poehali.dev/385e4ac7-d359-47f0-bbde-f564f4a774ac",
  vkidSdk: "https://functions.poehali.dev/04a40261-2f46-44d9-9585-2ca604773192",
  cities: "https://functions.poehali.dev/926ae37d-af28-4725-9ea2-1fb3bad5cefc",
  admin: "https://functions.poehali.dev/a5f90f0f-a62a-4230-ba88-9bc4c17060ff",
  payment: "https://functions.poehali.dev/87035cc4-779f-49b8-a18c-1ed92268c9e4",
};

export async function fetchAllCities(): Promise<string[]> {
  try {
    const res = await fetch(`${URLS.cities}/`);
    const data = await res.json();
    return Array.isArray(data.cities) ? data.cities : [];
  } catch {
    return [];
  }
}

function getToken(): string {
  return localStorage.getItem("ff_token") || "";
}

// POST-запрос: action кладём И в query string, И в body — чтобы бэкенд точно получил
async function req(url: string, options: RequestInit = {}) {
  const token = getToken();
  try {
    // Если есть body (POST) — добавляем action в него тоже
    let finalOptions = options;
    if (options.body && typeof options.body === "string") {
      try {
        const parsed = JSON.parse(options.body);
        // Извлекаем action из URL и добавляем в body
        const urlObj = new URL(url);
        const actionFromQS = urlObj.searchParams.get("action");
        if (actionFromQS && !parsed.action) {
          parsed.__action = actionFromQS; // доп. поле для надёжности
        }
        finalOptions = { ...options, body: JSON.stringify(parsed) };
      } catch { /* не JSON — не трогаем */ }
    }
    const res = await fetch(url, {
      ...finalOptions,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    try {
      let data = JSON.parse(text);
      if (typeof data === "string") data = JSON.parse(data);
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: res.status, data: { error: text } };
    }
  } catch (e) {
    console.error("Fetch error:", e, "for", url);
    return { ok: false, status: 0, data: { error: "Нет соединения с сервером" } };
  }
}

// AUTH
export const authApi = {
  register: (name: string, phone: string, password: string, city?: string) =>
    req(`${URLS.auth}/?action=register`, { method: "POST", body: JSON.stringify({ action: "register", name, phone, password, city }) }),
  login: (phone: string, password: string) =>
    req(`${URLS.auth}/?action=login`, { method: "POST", body: JSON.stringify({ action: "login", phone, password }) }),
  me: () => req(`${URLS.auth}/?action=me`),
  update: (data: { name?: string; avatar_url?: string; city?: string }) =>
    req(`${URLS.auth}/?action=update`, { method: "POST", body: JSON.stringify({ action: "update", ...data }) }),
  logout: () => req(`${URLS.auth}/?action=logout`, { method: "POST", body: JSON.stringify({ action: "logout" }) }),
};

// BOUQUETS
export const bouquetsApi = {
  list: (params?: { status?: string; tag?: string; sort?: string; max_price?: number; city?: string; district?: string }) => {
    const qs = new URLSearchParams({ action: "list" });
    if (params?.status) qs.set("status", params.status);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.max_price) qs.set("max_price", String(params.max_price));
    if (params?.city) qs.set("city", params.city);
    if (params?.district) qs.set("district", params.district);
    return req(`${URLS.bouquets}/?${qs}`);
  },
  detail: (id: number) => req(`${URLS.bouquets}/?action=detail&id=${id}`),
  create: (data: {
    title: string; description?: string; flowers: string[];
    freshness: string; image_urls: string[];
    start_price: number; duration_hours: number;
    city?: string; district?: string; meet_point?: string;
  }) => req(`${URLS.bouquets}/?action=create`, { method: "POST", body: JSON.stringify({ action: "create", ...data }) }),
  bid: (bouquet_id: number, amount: number) =>
    req(`${URLS.bouquets}/?action=bid`, { method: "POST", body: JSON.stringify({ action: "bid", bouquet_id, amount }) }),
  favorite: (bouquet_id: number, add: boolean) =>
    req(`${URLS.bouquets}/?action=favorite`, { method: "POST", body: JSON.stringify({ action: "favorite", bouquet_id, add }) }),
  favorites: () => req(`${URLS.bouquets}/?action=favorites`),
  cancel: (bouquet_id: number) =>
    req(`${URLS.bouquets}/?action=cancel`, { method: "POST", body: JSON.stringify({ action: "cancel", bouquet_id }) }),
};

// PROFILE
export const profileApi = {
  orders: () => req(`${URLS.profile}/?action=orders`),
  mySales: () => req(`${URLS.profile}/?action=my_sales`),
  reviews: (user_id?: number) => {
    const qs = new URLSearchParams({ action: "reviews" });
    if (user_id) qs.set("user_id", String(user_id));
    return req(`${URLS.profile}/?${qs}`);
  },
  chats: () => req(`${URLS.profile}/?action=chats`),
  messages: (other_id: number) => req(`${URLS.profile}/?action=messages&other_id=${other_id}`),
  sendMessage: (receiver_id: number, text: string, bouquet_id?: number) =>
    req(`${URLS.profile}/?action=send_message`, { method: "POST", body: JSON.stringify({ action: "send_message", receiver_id, text, bouquet_id }) }),
  withdraw: (amount: number, method?: string, details?: string) =>
    req(`${URLS.profile}/?action=withdraw`, { method: "POST", body: JSON.stringify({ action: "withdraw", amount, method, details }) }),
  savePayout: (method: string, details: string) =>
    req(`${URLS.profile}/?action=save_payout`, { method: "POST", body: JSON.stringify({ action: "save_payout", method, details }) }),
  withdrawals: () => req(`${URLS.profile}/?action=withdrawals`),
  addReview: (target_id: number, stars: number, text: string, order_id?: number) =>
    req(`${URLS.profile}/?action=add_review`, { method: "POST", body: JSON.stringify({ action: "add_review", target_id, stars, text, order_id }) }),
};

// ADMIN
export const adminApi = {
  withdrawals: (status?: string) =>
    req(`${URLS.admin}/?action=withdrawals${status ? `&status=${status}` : ""}`),
  approve: (withdrawal_id: number, comment?: string) =>
    req(`${URLS.admin}/?action=approve`, { method: "POST", body: JSON.stringify({ action: "approve", withdrawal_id, comment }) }),
  reject: (withdrawal_id: number, comment?: string) =>
    req(`${URLS.admin}/?action=reject`, { method: "POST", body: JSON.stringify({ action: "reject", withdrawal_id, comment }) }),
  stats: () => req(`${URLS.admin}/?action=stats`),
};

// PAYMENT (пополнение через ЮKassa)
export const paymentApi = {
  topup: (amount: number) =>
    req(`${URLS.payment}/?action=topup`, { method: "POST", body: JSON.stringify({ action: "topup", amount, return_url: window.location.origin }) }),
};

// ESCROW
export const escrowApi = {
  createOrder: (bouquet_id: number) =>
    req(`${URLS.escrow}/?action=create_order`, { method: "POST", body: JSON.stringify({ action: "create_order", bouquet_id }) }),
  pay: (order_id: number) =>
    req(`${URLS.escrow}/?action=pay`, { method: "POST", body: JSON.stringify({ action: "pay", order_id }) }),
  orderDetail: (id: number) => req(`${URLS.escrow}/?action=order_detail&id=${id}`),
  confirm: (order_id: number) =>
    req(`${URLS.escrow}/?action=confirm`, { method: "POST", body: JSON.stringify({ action: "confirm", order_id }) }),
  dispute: (order_id: number, reason: string) =>
    req(`${URLS.escrow}/?action=dispute`, { method: "POST", body: JSON.stringify({ action: "dispute", order_id, reason }) }),
  myDeals: () => req(`${URLS.escrow}/?action=my_deals`),
};

// OAUTH
// redirect_uri = просто origin без параметров (требование VK Security)
// провайдера передаём через state, он вернётся в URL как ?state=vk
const getRedirectUri = () => window.location.origin;

export const oauthApi = {
  getVkUrl: () => req(`${URLS.oauth}/?action=vk_url&redirect_uri=${encodeURIComponent(getRedirectUri())}&state=vk`),
  vkCallback: (code: string) =>
    req(`${URLS.oauth}/?action=vk_callback`, {
      method: "POST",
      body: JSON.stringify({ action: "vk_callback", code, redirect_uri: getRedirectUri() }),
    }),
  // VK ID SDK (OneTap) — code + device_id от VKID.Auth.exchangeCode
  vkidCallback: (code: string, device_id: string) =>
    req(`${URLS.oauth}/?action=vkid_callback`, {
      method: "POST",
      body: JSON.stringify({ code, device_id }),
    }),
  // URL прокси для загрузки VK ID SDK (обход блокировки CDN браузером)
  vkidSdkUrl: () => URLS.vkidSdk,
  getGoogleUrl: () => req(`${URLS.oauth}/?action=google_url&redirect_uri=${encodeURIComponent(getRedirectUri())}&state=google`),
  googleCallback: (code: string) =>
    req(`${URLS.oauth}/?action=google_callback`, {
      method: "POST",
      body: JSON.stringify({ action: "google_callback", code, redirect_uri: getRedirectUri() }),
    }),
  telegramCallback: (tgData: Record<string, string>) =>
    req(`${URLS.oauth}/?action=telegram_callback`, { method: "POST", body: JSON.stringify({ action: "telegram_callback", telegram_data: tgData }) }),
};

// UPLOAD
export const uploadApi = {
  upload: async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = (reader.result as string).split(",")[1];
        const r = await req(`${URLS.upload}/`, {
          method: "POST",
          body: JSON.stringify({ image: b64, content_type: file.type }),
        });
        resolve(r.ok ? r.data.url : null);
      };
      reader.readAsDataURL(file);
    });
  },
};