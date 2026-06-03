const URLS = {
  auth: "https://functions.poehali.dev/160e4bcc-5354-4955-b417-dcd385abfe11",
  bouquets: "https://functions.poehali.dev/c984e344-489c-4df8-b265-e621f407f1c2",
  profile: "https://functions.poehali.dev/e0242723-8c00-4366-807f-86615a61bb2e",
  upload: "https://functions.poehali.dev/3da42e9b-d4f0-4fa7-91fa-b25481552ce1",
};

function getToken(): string {
  return localStorage.getItem("ff_token") || "";
}

async function req(url: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: res.status, data: { error: text } };
  }
}

// AUTH
export const authApi = {
  register: (name: string, phone: string, password: string) =>
    req(`${URLS.auth}/?action=register`, { method: "POST", body: JSON.stringify({ name, phone, password }) }),
  login: (phone: string, password: string) =>
    req(`${URLS.auth}/?action=login`, { method: "POST", body: JSON.stringify({ phone, password }) }),
  me: () => req(`${URLS.auth}/?action=me`),
  update: (data: { name?: string; avatar_url?: string }) =>
    req(`${URLS.auth}/?action=update`, { method: "POST", body: JSON.stringify(data) }),
  logout: () => req(`${URLS.auth}/?action=logout`, { method: "POST" }),
};

// BOUQUETS
export const bouquetsApi = {
  list: (params?: { status?: string; tag?: string; sort?: string; max_price?: number }) => {
    const qs = new URLSearchParams({ action: "list" });
    if (params?.status) qs.set("status", params.status);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.max_price) qs.set("max_price", String(params.max_price));
    return req(`${URLS.bouquets}/?${qs}`);
  },
  detail: (id: number) => req(`${URLS.bouquets}/?action=detail&id=${id}`),
  create: (data: {
    title: string; description?: string; flowers: string[];
    freshness: string; image_urls: string[];
    start_price: number; duration_hours: number;
  }) => req(`${URLS.bouquets}/?action=create`, { method: "POST", body: JSON.stringify(data) }),
  bid: (bouquet_id: number, amount: number) =>
    req(`${URLS.bouquets}/?action=bid`, { method: "POST", body: JSON.stringify({ bouquet_id, amount }) }),
  favorite: (bouquet_id: number, add: boolean) =>
    req(`${URLS.bouquets}/?action=favorite`, { method: "POST", body: JSON.stringify({ bouquet_id, add }) }),
  favorites: () => req(`${URLS.bouquets}/?action=favorites`),
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
    req(`${URLS.profile}/?action=send_message`, { method: "POST", body: JSON.stringify({ receiver_id, text, bouquet_id }) }),
  withdraw: (amount: number, method: string) =>
    req(`${URLS.profile}/?action=withdraw`, { method: "POST", body: JSON.stringify({ amount, method }) }),
  addReview: (target_id: number, stars: number, text: string, order_id?: number) =>
    req(`${URLS.profile}/?action=add_review`, { method: "POST", body: JSON.stringify({ target_id, stars, text, order_id }) }),
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
