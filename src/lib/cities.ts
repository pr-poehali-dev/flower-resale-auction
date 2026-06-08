import { useEffect, useState } from "react";
import { fetchAllCities } from "./api";

// Базовый список (показывается мгновенно, пока грузится полный)
const FALLBACK_CITIES: string[] = [
  "Москва", "Санкт-Петербург", "Новосибирск", "Екатеринбург", "Казань",
  "Нижний Новгород", "Челябинск", "Красноярск", "Самара", "Уфа",
  "Ростов-на-Дону", "Омск", "Краснодар", "Воронеж", "Пермь",
  "Волгоград", "Саратов", "Тюмень", "Тольятти", "Махачкала",
  "Барнаул", "Ижевск", "Хабаровск", "Ульяновск", "Иркутск",
  "Владивосток", "Ярославль", "Севастополь", "Набережные Челны", "Томск",
  "Оренбург", "Кемерово", "Новокузнецк", "Рязань", "Астрахань",
  "Пенза", "Липецк", "Тула", "Киров", "Чебоксары",
  "Калининград", "Брянск", "Курск", "Иваново", "Магнитогорск",
  "Тверь", "Ставрополь", "Симферополь", "Белгород", "Архангельск",
  "Владимир", "Сочи", "Курган", "Смоленск", "Калуга",
];

// Изменяемое хранилище — обновляется после загрузки полного списка
export const citiesStore: { list: string[] } = { list: FALLBACK_CITIES };

let loaded = false;
let loadingPromise: Promise<string[]> | null = null;
const subscribers = new Set<() => void>();

export function subscribeCities(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export async function loadCities(): Promise<string[]> {
  if (loaded) return citiesStore.list;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const all = await fetchAllCities();
    if (all.length > 0) {
      citiesStore.list = all;
      loaded = true;
      subscribers.forEach(cb => cb());
    }
    return citiesStore.list;
  })();
  return loadingPromise;
}

// Хук: возвращает актуальный список городов и перерисовывает при загрузке
export function useCities(): string[] {
  const [list, setList] = useState(citiesStore.list);
  useEffect(() => {
    loadCities();
    const unsub = subscribeCities(() => setList(citiesStore.list));
    setList(citiesStore.list);
    return unsub;
  }, []);
  return list;
}