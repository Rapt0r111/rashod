---
name: Rashod
description: Командная полоса дежурного — счётчики сначала, люди следом.
colors:
  bg-base: "oklch(13% 0.028 286)"
  bg-panel: "oklch(16.5% 0.03 286)"
  bg-raised: "oklch(19.5% 0.032 286)"
  bg-overlay: "oklch(9% 0.024 286 / 0.78)"
  line: "oklch(82% 0.04 286 / 0.12)"
  line-strong: "oklch(82% 0.05 286 / 0.24)"
  text-primary: "oklch(94% 0.01 286)"
  text-secondary: "oklch(76% 0.025 286)"
  text-muted: "oklch(60% 0.026 286)"
  primary: "oklch(68% 0.19 302)"
  primary-soft: "oklch(68% 0.19 302 / 0.14)"
  primary-line: "oklch(68% 0.19 302 / 0.32)"
  cyan: "oklch(77% 0.14 191)"
  green: "oklch(76% 0.17 151)"
  blue: "oklch(72% 0.15 242)"
  amber: "oklch(78% 0.16 74)"
  red: "oklch(69% 0.18 28)"
  violet: "oklch(72% 0.18 302)"
  neutral: "oklch(75% 0.025 286)"
  ink-on-accent: "oklch(12% 0.04 286)"
typography:
  display:
    fontFamily: "Geist Mono, Consolas, Courier New, monospace"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, Arial, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, Arial, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, Arial, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, Arial, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  mono:
    fontFamily: "Geist Mono, Consolas, Courier New, monospace"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1
rounded:
  control: "10px"
  panel: "12px"
  section: "16px"
  chip: "13px"
  icon: "12px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  2xl: "24px"
  control-height: "42px"
  top-bar: "64px"
  sidebar: "232px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink-on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.control-height}"
  button-primary-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "{spacing.control-height}"
  button-secondary:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.control-height}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.icon}"
    padding: "0"
    height: "40px"
    width: "40px"
  input-field:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "{spacing.control-height}"
  nav-active:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.cyan}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "42px"
  command-chip:
    backgroundColor: "{colors.bg-panel}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.display}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "auto"
  command-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink-on-accent}"
    typography: "{typography.display}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "auto"
---

# Design System: Rashod

## Overview

**Creative North Star: «Командная полоса дежурного»**

Rashod — тёмный командный стол дежурного. Сначала считываются количества по
местам, затем фильтруется список, затем назначается человек — не покидая roster.
Система отказывается от пустой роскоши и орнаментального стекла: панели
непрозрачны, границы — hairline, orchid появляется только на выбранном итоге и
на первичном действии.

Мир — глубокая индиго-ночь без зерна на холсте. Geist несёт русские подписи;
Geist Mono держит крупные счётчики командных чипов. Контролы 42px. Cyan —
фокус и активная навигация. Статусные green, blue, amber, red, violet и
neutral помечают место и состояние, не украшают поверхность.

Композиция: 64px верхняя панель, сайдбар 232px, в прокручиваемой колонке
командная полоса, поиск и таблица roster. Полоса не липнет при прокрутке.

**Key Characteristics:**
- Непрозрачные индиго-панели и hairline-линии, без стеклянных заливок.
- Orchid только на выбранном итоге и primary action; cyan — focus и active nav.
- Крупные моно-счётчики над 12px-подписями на командных чипах.
- Единые 42px поля и кастомный listbox во всех разделах.
- 64px chrome, 232px сайдбар, перестройка в drawer на 900px.

## Colors

Палитра — глубокий индиго-нейтрал с одним orchid-голосом и cyan-вниманием;
остальные цвета семантичны и редки.

### Primary
- **Command Orchid**: выбранный итог командной полосы («список»), brand-марка, solid commit на входе.
- **Command Orchid Soft**: фон выбранного итога и мягкий in-app primary (ЗГТ).
- **Command Orchid Line**: граница акцентного состояния.

### Secondary
- **Operational Cyan**: `:focus-visible`, активный пункт навигации, выбранная строка roster.

### Tertiary
- **Status Green**, **Status Blue**, **Status Amber**, **Status Red**, **Status Violet**, **Status Neutral**: тон места и состояния на чипах, бейджах и quick-кодах. Neutral — отсутствие или вторичный тон.

### Neutral
- **Indigo Night**: холст приложения.
- **Panel Indigo**: непрозрачные панели, строки, командные чипы.
- **Raised Indigo**: поля, вторичные кнопки, активный nav.
- **Overlay Indigo**: затемнение drawer и модалок.
- **Primary / Secondary / Muted Text**: иерархия чтения.
- **Line** и **Strong Line**: hairline-границы и усиление при hover или overlay.

### Named Rules
**The Orchid Rarity Rule.** Orchid занимает выбранный итог и primary action.
Не заливать им навигацию, полосы и обычные карточки.

**The Cyan Attention Rule.** Cyan — focus ring и активный раздел, не второй
brand-цвет и не заливка экрана.

## Typography

**Display Font:** Geist Mono (with Consolas, Courier New, monospace fallback)
**Body Font:** Geist (with Arial, system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with Consolas, Courier New, monospace fallback)

Geist держит спокойные русские подписи в плотных списках. Geist Mono —
счётчики командной полосы, часы и выровненные числа. Заголовки экранов — 28px
sans, не маркетинговый display.

### Hierarchy
- **Display** (700, 28px / 1.75rem, 1.0, −0.04em): моно-счётчик командного чипа и сводки задач.
- **Headline** (700, 28px, 1.08, −0.02em): заголовок модуля (Задачи, портал); на узком экране сжимается до 24px.
- **Title** (700, 20px, 1.2): вход, карточки модулей, заголовок drawer.
- **Body** (400, 14px, 1.45): описания, поля, строки; пояснения держать около 61–65ch.
- **Label** (600, 12px, 1.35): подпись чипа («список», место), кнопки, статус.
- **Mono** (700, 18px часы; 11px compact counts в сайдбаре): время и компактные бейджи количества.

### Named Rules
**The Count-First Rule.** На командной полосе 12px-подпись стоит над крупным
mono-числом. Не прятать количество в бейдж без цифры.

**The Calm Hierarchy Rule.** Иерархия — вес, размер и контраст. Не вводить
42px+ display-заголовки: 42px в этой системе — высота контрола, не кегль.

## Layout

Рабочий стол — полная высота viewport (`h-dvh`), без внешней прокрутки страницы.
Верхняя панель 64px (`h-16`) на всю ширину, hairline снизу. Ниже — колонки
`232px | 1fr`; сайдбар скрывается на 900px и уступает место горизонтальным
чипам разделов и focus-managed drawer.

Командная полоса живёт в прокручиваемой колонке, не над сайдбаром и не sticky.
Горизонтальный ряд `minmax(8rem, 11rem)`, gap 8px. Поиск сразу под рядом.
Roster — одна таблица: звание, фамилия, место, взвод, назначить. Quick-коды
справа; на 560px колонка назначения уходит в горизонтальный скролл.

Точки перестройки, которые реально режут chrome: 1180px (уплотнение), 1100px
(прячутся часы), 900px (сайдбар → drawer), 720px (модули в иконки), 560px
(марка сжимается до знака).

### Named Rules
**The Strip-Then-List Rule.** Счётчики мест, затем поиск, затем люди. Не
уводить назначение в отдельный «красивый» экран.

## Elevation & Depth

Глубина — тональные слои base → panel → raised и hairline. Поверхности
непрозрачны. Ambient `--shadow` (`0 16px 40px rgb(0 0 0 / 0.32), inset 0 1px 0
rgb(255 255 255 / 0.04)`) — у крупных пустых/ошибочных панелей. Overlay drawer
несёт боковую тень `30px 0 90px rgb(0 0 0 / 0.42)` и лёгкий blur фона; диалоги
— `0 30px 90px rgb(0 0 0 / 0.55)`. Listbox поднимается `0 18px 52px`. Холст
не несёт зерна и не декоративных карточных паттернов.

### Shadow Vocabulary
- **App surface** (`0 16px 40px rgb(0 0 0 / 0.32), inset 0 1px 0 rgb(255 255 255 / 0.04)`): крупные изолированные панели.
- **Drawer** (`30px 0 90px rgb(0 0 0 / 0.42)`): выезд разделов.
- **Dialog** (`0 30px 90px rgb(0 0 0 / 0.55)`): sheets журнала и назначения.
- **Listbox** (`0 18px 52px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.06)`): выпадающий custom select.
- **Focus halo** (`0 0 0 3px color-mix(in oklch, var(--cyan) 22%, transparent)`): поля и ЗГТ-контролы; глобальный fallback — `outline: 2px solid var(--cyan); outline-offset: 3px`.

### Named Rules
**The Opaque Panel Rule.** Рабочие панели — сплошной `--bg-panel` / `--bg-raised`.
Не делать command strip, строки и поля стеклянными.

**The Layered-By-Default Rule.** Сначала слой и линия; широкая тень — только
у overlay и изолированных app-панелей, не у каждого чипа.

## Shapes

Форма спокойная и прямоугольная: 10px у контролов, командных чипов и строк;
12px у панелей входа, форм и карточек модулей; 16px у крупных section-shell;
13px у статус-бейджей и pill-counts. Икон-кнопки chrome — 40×40, 12px.
Диалоги могут быть 22px — это overlay, не новый радиус карточек. Полные pill
только у компактных счётчиков в nav.

### Named Rules
**The Control Radius Rule.** Поля, кнопки и командные чипы делят 10px. Не
раздувать их до 22px+ и не делать обычный input капсулой.

## Components

Плотные, тактильные, один словарь на roster, groups, tasks, ЗГТ и справочники.
Иконки — Phosphor, regular; fill только у активного пункта ЗГТ-навигации.

### Buttons
- **Shape:** 10px, высота 42px; икон-chrome 40×40 с 12px.
- **Primary:** solid orchid, ink `oklch(12% 0.04 286)`, border accent-line; hover — лёгкий brightness. Внутри ЗГТ in-app primary — orchid-soft и primary text.
- **Hover / Focus:** линия к `--line-strong` или cyan; focus-visible cyan 2px / 3px offset или 3px cyan halo.
- **Secondary / Ghost:** raised или прозрачный с `--line`; не выглядеть primary в покое.
- **Disabled:** форма сохраняется, opacity около 0.52 (локально 0.45–0.60).
- **Motion:** 150–200ms на цвет и границу; `active:translate-y-px` у чипов и строк.

### Chips
- **Command chip:** колонка «подпись над числом», min-height 44px, padding 10×12, 10px radius, panel + line. Выбранный чип — solid orchid и ink-цифра.
- **Location chip:** то же тело; невыбранное число — primary text, не тон места.
- **Status badge:** 13px radius, 12px semibold, semantic soft fill + line.
- **Nav count:** pill, 11px mono muted на `white/6`.

### Cards / Containers
- **Corner Style:** 12px панели и модульные карточки; 16px крупные оболочки; 10px строки и чипы.
- **Background:** `--bg-panel` основная поверхность, `--bg-raised` вложенное, `--bg-base` холст.
- **Shadow Strategy:** см. Elevation; полоса и строки без широкой тени.
- **Border:** `--line` в покое, `--line-strong` у overlay и hover.
- **Internal Padding:** 12–18px в рабочих блоках; 24px у стоящих отдельно пустых панелей.

### Inputs / Fields
- **Style:** raised, 10px, `--line`, 42px, 12px горизонтальный padding. Search — та же оболочка с иконкой 17px.
- **Focus:** граница cyan и halo 3px; SelectField в открытом состоянии — cyan mix на границе и фоне.
- **Error / Disabled:** red soft fill + red text; disabled сохраняет геометрию.
- **Listbox:** кастомный, не native `<select>`; опции 10px, выбранная — accent-soft.

### Navigation
- **Top bar:** 64px, base, hairline; марка 40px orchid square с литерами; часы 18px mono справа.
- **Sidebar:** 232px, gap 6px, пункты 10px radius; active — raised + cyan + `aria-current`.
- **Portal / ЗГТ tabs:** 42px, 10px; active module — raised + cyan; вкладка «Модули» на портале может нести orchid-soft, когда это текущий дом.
- **Responsive:** ≤900px сайдбар скрыт; hamburger 40px открывает drawer; ≤560px текст марки прячется.

### Operator Bar
Сигнатурный компонент: горизонтальная командная полоса количеств и сразу под
ней `SearchSortControl`. Чип итога сбрасывает фильтры. Полоса скроллится вместе
со списком и не липнет к шапке.

### Roster Table
Таблица: звание, фамилия, место, взвод, назначить. Quick-коды 44px. Выбор
строки — cyan wash; вспышка изменения — orchid-soft.

## Do's and Don'ts

### Do:
- **Do** брать цвета, радиусы и `--control-height` из `:root` в `src/app/globals.css`.
- **Do** ставить 12px-подпись над крупным mono-числом на командной полосе.
- **Do** красить orchid только выбранный итог и primary action; cyan — focus и active nav.
- **Do** держать поля и основные кнопки на 42px и переиспользовать `SelectField`, `SearchSortControl`, `StyledCheckbox`.
- **Do** оставлять панели непрозрачными и отделять их hairline, не blur.
- **Do** проверять 900px и 560px: drawer, полоса, поиск, listbox, критические действия.

### Don't:
- **Don't** делать интерфейс игрушечным: без мультяшности, декоративной перегрузки и эффектов ради эффектов.
- **Don't** заливать экраны стеклом, широким blur или полупрозрачными рабочими панелями.
- **Don't** ставить orchid на обычные nav-пункты, карточки модулей и невыбранные чипы мест.
- **Don't** менять кастомный listbox и checkbox-chips на native `<select>` и видимые системные checkbox.
- **Don't** вводить gradient text, цветные боковые полосы и 32px+ радиусы на полях.
- **Don't** прятать roster за декоративной загрузкой и не добавлять motion, который задерживает действие.
