import Icon from "@/components/ui/icon";

const stats = [
  { value: "15%", label: "Комиссия с каждой сделки" },
  { value: "~5 мин", label: "Среднее время создания лота" },
  { value: "48ч", label: "Авто-подтверждение сделки" },
  { value: "5%", label: "Реферальная программа" },
];

const features = [
  {
    icon: "Gavel",
    title: "Аукционная модель",
    desc: "Продавец выставляет букет — покупатели торгуются. Побеждает максимальная ставка. Таймер создаёт срочность и повышает итоговую цену.",
  },
  {
    icon: "ShieldCheck",
    title: "Безопасная сделка (эскроу)",
    desc: "Деньги замораживаются в системе до подтверждения получения. Покупатель защищён, продавец гарантированно получает оплату.",
  },
  {
    icon: "MapPin",
    title: "Геолокация и районы",
    desc: "Москва, Санкт-Петербург, Екатеринбург, Новосибирск, Казань с делением по районам. Покупатель видит только ближайшие предложения.",
  },
  {
    icon: "Star",
    title: "Рейтинги и отзывы",
    desc: "После каждой сделки стороны оставляют отзывы. Продавцы с высоким рейтингом получают больше доверия и ставок.",
  },
  {
    icon: "MessageCircle",
    title: "Встроенный чат",
    desc: "Чат активируется только после оплаты. Стороны уточняют место встречи, никаких внешних мессенджеров.",
  },
  {
    icon: "Wallet",
    title: "Внутренний кошелёк",
    desc: "Балансы, пополнение через ЮКассу, вывод на карту. Реферальные бонусы зачисляются автоматически.",
  },
];

const niches = [
  {
    emoji: "💐",
    title: "Флористы и малые цветочные магазины",
    why: "Остатки, неликвид, букеты после мероприятий. Платформа помогает реализовать товар быстро вместо списания.",
    potential: "Высокий",
    color: "#ff3d8b",
  },
  {
    emoji: "🌹",
    title: "Частные флористы (фриланс)",
    why: "Авторские букеты ручной работы по цене выше рынка. Аукцион позволяет найти ценящего покупателя.",
    potential: "Высокий",
    color: "#a855f7",
  },
  {
    emoji: "🎁",
    title: "Подарочные сервисы и event-агентства",
    why: "Срочная реализация цветочного декора после корпоративов, свадеб, фотосессий.",
    potential: "Средний",
    color: "#ff6b2b",
  },
  {
    emoji: "🛒",
    title: "Перекупщики и арбитражники",
    why: "Закупают оптом, реализуют поштучно через аукцион с наценкой. Чистая торговая модель.",
    potential: "Средний",
    color: "#06d6de",
  },
  {
    emoji: "💍",
    title: "Свадебные флористы",
    why: "После торжества — десятки букетов. Аукцион позволяет продать в тот же день по честной цене.",
    potential: "Средний",
    color: "#ff3d8b",
  },
  {
    emoji: "🏪",
    title: "Покупатели — все кто дарит цветы",
    why: "День рождения, 8 марта, свидание, корпоратив. Свежие букеты дешевле магазина + интерес аукциона.",
    potential: "Массовый",
    color: "#a855f7",
  },
];

const revenueStreams = [
  {
    icon: "TrendingUp",
    title: "Основной доход",
    items: [
      "15% комиссии с каждой выигранной сделки",
      "Взимается автоматически при подтверждении",
      "Масштабируется без дополнительных затрат",
    ],
  },
  {
    icon: "Megaphone",
    title: "Рекламный инвентарь",
    items: [
      "Баннеры и спонсорские карточки в каталоге",
      "Продвижение лотов в топ за доплату",
      "Email-рассылки по сегментированной базе",
    ],
  },
  {
    icon: "Crown",
    title: "Монетизация партнёров",
    items: [
      "Реферальная сеть (5% от продаж привлечённых)",
      "Партнёрские программы с доставками цветов",
      "B2B-тарифы для магазинов и студий",
    ],
  },
];

export default function Partners() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0d0d14 0%, #12071e 50%, #0d1020 100%)",
        fontFamily: "'Golos Text', sans-serif",
        color: "#fff",
      }}
    >
      {/* HERO */}
      <section style={{ padding: "80px 24px 60px", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display: "inline-block",
            padding: "6px 18px",
            borderRadius: 100,
            background: "rgba(255,61,139,0.12)",
            border: "1px solid rgba(255,61,139,0.3)",
            fontSize: 12,
            color: "#ff3d8b",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          Партнёрская презентация
        </div>
        <h1
          style={{
            fontSize: "clamp(36px, 8vw, 64px)",
            fontWeight: 800,
            lineHeight: 1.1,
            background: "linear-gradient(135deg, #ff3d8b 0%, #a855f7 50%, #ff6b2b 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 20,
            fontFamily: "'Oswald', sans-serif",
          }}
        >
          FlowerFlip
        </h1>
        <p style={{ fontSize: 20, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 600, margin: "0 auto 16px" }}>
          Первая в России P2P-платформа для аукционной продажи букетов
        </p>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
          Продавцы выставляют живые букеты на торги — покупатели делают ставки.<br />
          Платформа зарабатывает с каждой успешной сделки автоматически.
        </p>
      </section>

      {/* STATS */}
      <section style={{ padding: "0 24px 60px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding: "28px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 800,
                  fontFamily: "'Oswald', sans-serif",
                  background: "linear-gradient(135deg, #ff3d8b, #a855f7)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {s.value}
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW EARNS */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Как зарабатывает платформа</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {revenueStreams.map((r) => (
            <div
              key={r.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20,
                padding: 28,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(255,61,139,0.2), rgba(168,85,247,0.2))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Icon name={r.icon} size={20} className="text-pink-400" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{r.title}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {r.items.map((item) => (
                  <li key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ color: "#a855f7", marginTop: 2, flexShrink: 0 }}>✦</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Commission example */}
        <div
          style={{
            marginTop: 24,
            background: "linear-gradient(135deg, rgba(255,61,139,0.08), rgba(168,85,247,0.08))",
            border: "1px solid rgba(168,85,247,0.2)",
            borderRadius: 20,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Пример расчёта на букет за 1 000 ₽
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {[
              { label: "Цена букета", value: "1 000 ₽", sub: "Стартовая / финальная", color: "rgba(255,255,255,0.7)" },
              { label: "Комиссия ЮКассы", value: "−55 ₽", sub: "5.5% эквайринг", color: "#ff6b2b" },
              { label: "Комиссия платформы", value: "−142 ₽", sub: "15% от суммы", color: "#ff3d8b" },
              { label: "Продавец получает", value: "803 ₽", sub: "Чистыми на кошелёк", color: "#4ade80" },
            ].map((c) => (
              <div key={c.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Oswald', sans-serif", color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Возможности платформы</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: 24,
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(168,85,247,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={f.icon} size={18} className="text-purple-400" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NICHES */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Целевые ниши клиентов</SectionTitle>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 28, marginTop: -16 }}>
          Кто будет активно пользоваться платформой и привлекать рекламный бюджет
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {niches.map((n) => (
            <div
              key={n.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${n.color}22`,
                borderRadius: 20,
                padding: 24,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: `${n.color}0d`,
                  pointerEvents: "none",
                }}
              />
              <div style={{ fontSize: 32, marginBottom: 12 }}>{n.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{n.title}</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{n.why}</div>
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 100,
                  background: `${n.color}18`,
                  border: `1px solid ${n.color}44`,
                  fontSize: 11,
                  color: n.color,
                  fontWeight: 600,
                }}
              >
                Потенциал: {n.potential}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY ADVERTISE */}
      <section style={{ padding: "0 24px 80px", maxWidth: 960, margin: "0 auto" }}>
        <SectionTitle>Почему стоит вложиться в рекламу</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            { icon: "Users", title: "Широкая аудитория", desc: "Цветы дарят все — от студентов до корпораций. Рынок не имеет узкого сегмента." },
            { icon: "Repeat", title: "Повторные покупки", desc: "Букеты — расходный товар. Один довольный покупатель возвращается снова и снова." },
            { icon: "Calendar", title: "Сезонные пики", desc: "8 марта, 14 февраля, выпускные, свадьбы — прогнозируемые всплески спроса." },
            { icon: "BarChart2", title: "Рост рынка", desc: "Онлайн-торговля цветами растёт ежегодно. Аукционная модель — новая ниша без конкурентов." },
          ].map((c) => (
            <div
              key={c.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(255,61,139,0.15), rgba(168,85,247,0.15))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Icon name={c.icon} size={22} className="text-pink-400" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{c.title}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.6 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "0 24px 100px", textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(135deg, rgba(255,61,139,0.1), rgba(168,85,247,0.1))",
            border: "1px solid rgba(168,85,247,0.25)",
            borderRadius: 24,
            padding: "48px 32px",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 16 }}>💐</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              fontFamily: "'Oswald', sans-serif",
              marginBottom: 12,
            }}
          >
            Давайте расти вместе
          </div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            FlowerFlip — готовый продукт с живой аудиторией, понятной моделью монетизации и масштабируемой инфраструктурой. Реклама здесь — это инвестиция в быстрорастущий рынок.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #ff3d8b, #a855f7)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Открыть платформу
            </a>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "0 24px 40px", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
        FlowerFlip — аукционная P2P-платформа для цветов · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 24,
        fontWeight: 800,
        fontFamily: "'Oswald', sans-serif",
        marginBottom: 24,
        background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {children}
    </h2>
  );
}