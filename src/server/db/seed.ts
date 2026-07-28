import { SYSTEM_LOCATIONS, SYSTEM_PLATOONS } from "@/features/roster/constants";
import type { LocationOption, OverviewSettings, Person, Platoon } from "@/features/roster/types";
import { cloneDefaultOverviewSettings } from "@/features/roster/overview-settings";

const surnames = [
  "Ковалёв", "Смирнов", "Иванов", "Петров", "Соколов", "Морозов", "Волков", "Фёдоров", "Михайлов", "Новиков",
  "Алексеев", "Лебедев", "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев", "Орлов", "Андреев",
  "Макаров", "Никитин", "Захаров", "Зайцев", "Соловьёв", "Борисов", "Яковлев", "Григорьев", "Романов", "Воробьёв",
  "Сергеев", "Кузьмин", "Фролов", "Александров", "Дмитриев", "Королёв", "Гусев", "Киселёв", "Ильин", "Максимов",
  "Поляков", "Сорокин", "Виноградов", "Крылов", "Беляев", "Медведев", "Антонов", "Тарасов", "Жуков", "Баранов",
  "Филиппов", "Комаров", "Давыдов", "Беляков", "Герасимов", "Богданов", "Осипов", "Сидоров", "Матвеев", "Титов",
  "Марков", "Миронов", "Куликов", "Карпов", "Власов", "Мельников", "Денисов", "Гаврилов", "Тихонов", "Казаков",
];

const initials = ["А.С.", "И.В.", "Д.М.", "Р.А.", "С.Н.", "П.К.", "М.И.", "Е.О.", "В.Г.", "Н.П.", "К.А.", "Л.Д.", "О.В.", "Т.С.", "Ю.М."];

const permanent = [
  ["капитан", "Климов А.В."],
  ["старший лейтенант", "Гордеев М.С."],
  ["старший лейтенант", "Рыбаков И.Н."],
  ["лейтенант", "Чернов Д.А."],
  ["прапорщик", "Лазарев П.О."],
  ["сержант контрактной службы", "Руднев С.К."],
  ["сержант контрактной службы", "Абрамов В.Л."],
] as const;

function rankFor(kind: "vz" | "prk", index: number) {
  if (kind === "prk") {
    if (index === 0) return "старший сержант";
    if (index < 4) return "сержант";
    if (index < 8) return "ефрейтор";
    return "рядовой";
  }
  if (index === 0) return "сержант";
  if (index < 3) return "младший сержант";
  if (index < 6) return "ефрейтор";
  return "рядовой";
}

function makePerson(platoon: Platoon, index: number, globalIndex: number, rank: string, name: string): Person {
  const now = Date.now();
  return {
    id: `person-${platoon.key}-${String(index + 1).padStart(2, "0")}`,
    platoonId: platoon.id,
    rank,
    name,
    conscriptionNumber: null,
    location: "rota",
    sortOrder: index + 1,
    createdAt: now,
    updatedAt: now + globalIndex,
  };
}

export function createSeedData(): { platoons: Platoon[]; locations: LocationOption[]; locationGroups: []; overviewSettings: OverviewSettings; people: Person[] } {
  const platoons = SYSTEM_PLATOONS;
  const people: Person[] = [];
  const vz1 = platoons.find((item) => item.key === "vz1")!;
  const vz2 = platoons.find((item) => item.key === "vz2")!;
  const prk = platoons.find((item) => item.key === "prk")!;
  const ps = platoons.find((item) => item.key === "ps")!;

  for (let i = 0; i < 20; i += 1) {
    people.push(makePerson(vz1, i, i, rankFor("vz", i), `${surnames[i]} ${initials[i % initials.length]}`));
  }
  for (let i = 0; i < 20; i += 1) {
    const idx = i + 20;
    people.push(makePerson(vz2, i, idx, rankFor("vz", i), `${surnames[idx]} ${initials[idx % initials.length]}`));
  }
  for (let i = 0; i < 24; i += 1) {
    const idx = i + 40;
    people.push(makePerson(prk, i, idx, rankFor("prk", i), `${surnames[idx]} ${initials[idx % initials.length]}`));
  }
  permanent.forEach(([rank, name], index) => {
    people.push(makePerson(ps, index, 64 + index, rank, name));
  });

  return { platoons, locations: SYSTEM_LOCATIONS, locationGroups: [], overviewSettings: cloneDefaultOverviewSettings(), people };
}
