---
name: Rashod
description: Спокойный оперативный рабочий стол для контроля и распределения личного состава.
colors:
  bg-base: "oklch(13% 0.036 286)"
  bg-panel: "oklch(17% 0.038 286 / 0.88)"
  bg-raised: "oklch(21% 0.042 286 / 0.82)"
  bg-overlay: "oklch(9% 0.03 286 / 0.72)"
  line: "oklch(82% 0.06 286 / 0.14)"
  line-strong: "oklch(82% 0.08 286 / 0.28)"
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
    fontFamily: "Geist, Arial, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 700
    lineHeight: 1.02
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
    fontFamily: "Geist Mono, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  control: "10px"
  panel: "16px"
  section: "22px"
  chip: "13px"
  list-option: "10px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  2xl: "24px"
  control-height: "42px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink-on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.control-height}"
  button-secondary:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.control-height}"
  input-field:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "{spacing.control-height}"
  nav-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.cyan}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "42px"
  summary-chip:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.text-primary}"
    typography: "{typography.mono}"
    rounded: "{rounded.chip}"
    padding: "6px 10px"
---

# Design System: Rashod

## Overview

**Creative North Star: «Оперативный рабочий стол»**

Rashod — тёмный рабочий интерфейс для человека, который одновременно держит в
поле зрения состояние личного состава и выполняет точные действия по его
распределению. Система должна ощущаться спокойной и собранной: данные заметны,
следующее действие понятно, а визуальные эффекты не конкурируют с рабочей
задачей.

Основу уже существующего языка составляют глубокий индиго-ночной фон,
приподнятые панели и один выразительный orchid-акцент. Cyan выделяет фокус,
активные состояния и оперативные точки внимания; green, blue, amber и red
передают семантику статусов. Глубина строится главным образом слоями и линиями,
а не декоративным стеклом.

Композиция рассчитана на desktop и планшет: 64px верхняя панель, боковая
навигация на широком экране, перестройка в drawer и горизонтально прокручиваемые показатели на узких
экранах. Controls остаются крупными для касания и сохраняют один язык во всех
разделах.

**Key Characteristics:**
- Спокойный тёмный рабочий фон с точечным orchid-акцентом.
- Плотная, но читаемая data-first компоновка.
- Единые 42px controls, кастомные listbox и явные focus-состояния.
- Моноширинные значения для времени, счётчиков и оперативных метрик.
- Семантический цвет используется для действия, фокуса и состояния, не для декора.

## Colors

Палитра — глубокий индиго-нейтрал с прохладным orchid-акцентом и cyan-фокусом;
статусные цвета появляются только там, где помогают принять решение.

### Primary
- **Command Orchid** (`oklch(68% 0.19 302)`): основные действия, выбранные состояния, маркеры важных изменений.
- **Command Orchid Soft** (`oklch(68% 0.19 302 / 0.14)`): мягкий фон выбранных элементов и operational chips.
- **Command Orchid Line** (`oklch(68% 0.19 302 / 0.32)`): граница акцентного состояния.

### Secondary
- **Operational Cyan** (`oklch(77% 0.14 191)`): keyboard focus, активная навигация, интерактивные точки внимания.

### Tertiary
- **Status Green** (`oklch(76% 0.17 151)`), **Status Blue** (`oklch(72% 0.15 242)`), **Status Amber** (`oklch(78% 0.16 74)`), **Status Red** (`oklch(69% 0.18 28)`): состояния и распределение по смысловым категориям.

### Neutral
- **Indigo Night** (`oklch(13% 0.036 286)`): основной фон приложения.
- **Panel Indigo** (`oklch(17% 0.038 286 / 0.88)`): панели, страницы и крупные контейнеры.
- **Raised Indigo** (`oklch(21% 0.042 286 / 0.82)`): поля, вторичные кнопки и вложенные поверхности.
- **Overlay Indigo** (`oklch(9% 0.03 286 / 0.72)`): модальные backdrop-поверхности.
- **Primary Text** (`oklch(94% 0.01 286)`), **Secondary Text** (`oklch(76% 0.025 286)`), **Muted Text** (`oklch(60% 0.026 286)`): иерархия текста.
- **Line** (`oklch(82% 0.06 286 / 0.14)`) и **Strong Line** (`oklch(82% 0.08 286 / 0.28)`): границы, делители и focus-adjacent structure.

### Named Rules
**The Operational Accent Rule.** Orchid и cyan редки: они обозначают действие,
выбор, focus или состояние. Не использовать их как постоянную декоративную
заливку всего экрана.

## Typography

**Display Font:** Geist (with Arial, system-ui, sans-serif fallback)
**Body Font:** Geist (with Arial, system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with Consolas, monospace fallback)

Geist даёт нейтральную и компактную форму русским подписям и плотным спискам.
Geist Mono используется точечно для времени, чисел, счётчиков и значений, где
важна быстрая визуальная сверка.

### Hierarchy
- **Display** (700, 42px max / 28px compact, 1.02): названия крупных рабочих разделов, не маркетинговые hero-заголовки.
- **Headline** (700, 28px, 1.08): заголовки экранов и ключевых рабочих областей.
- **Title** (700, 20px, 1.2): заголовки панелей, drawer и диалогов.
- **Body** (400, 14px, 1.45): рабочие описания и значения списков; prose держать в пределах 65–75ch.
- **Label** (600, 12px, 1.35): подписи controls, статусов и вторичных действий.
- **Mono** (700, 14–18px, 1.2): часы, количество людей, компактные операционные метрики.

### Named Rules
**The Calm Hierarchy Rule.** Иерархия строится весом, размером и контрастом,
а не oversized display-типографикой. Заголовки должны балансироваться и не
переполнять планшетные контейнеры.

## Elevation

Система использует гибрид: базовая глубина — это tonal layering между base,
panel и raised; тонкая линия фиксирует границу; ambient shadow применяется к
крупным app-level surfaces и overlay-панелям. Blur допустим только в sticky
operator bar, где отделяет панель от прокручиваемых данных.

### Shadow Vocabulary
- **Ambient App Surface** (`0 12px 30px rgb(0 0 0 / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.05)`): крупные контейнеры и app-level панели.
- **Operator Surface** (`0 14px 34px rgb(0 0 0 / 0.2)`): sticky operator bar над списком.
- **Overlay Surface** (`30px 0 90px rgb(0 0 0 / 0.42)`): выдвижная section drawer.

### Named Rules
**The Layered-By-Default Rule.** Сначала меняй tonal layer или line; не добавляй
широкую тень к каждому control и не превращай рабочие поверхности в набор
плавающих карточек.

## Components

Компоненты должны быть плотными, тактильными и уверенными: один control vocabulary
для roster, groups, tasks и reference screens.

### Buttons
- **Shape:** 10px control radius; primary and secondary controls обычно 42px high, icon controls 40–42px square.
- **Primary:** `--accent` background, `--ink-on-accent` text, 0 16px horizontal padding, semibold/bold label.
- **Hover / Focus:** border or background shifts toward cyan/accent; `:focus-visible` uses a 2px cyan outline with 3px offset; transitions are about 200ms.
- **Secondary / Ghost:** `--bg-raised` or transparent tonal surface with `--line`; use `--line-strong` on hover. Never make an inactive control look primary.
- **Disabled:** retain shape and layout, reduce opacity to the established global disabled treatment; never remove the control from the visual flow without explanation.

### Chips
- **Style:** 13px radius, compact padding, mono number plus a readable label; background and border follow semantic tone.
- **State:** accent chip means selected/total, green means rota/positive operational state, neutral means absence or secondary state; location chips remain actionable and use the same focus ring as buttons.

### Cards / Containers
- **Corner Style:** 16px for panels and cards; 22px for major section shells; 10px for fields and list options.
- **Background:** `--bg-panel` for primary surfaces, `--bg-raised` for nested controls, `--bg-base` for the workspace.
- **Shadow Strategy:** follow Elevation; use tonal layering first and reserve wide shadows for app-level surfaces.
- **Border:** `--line` at rest, `--line-strong` for active or elevated boundaries; no colored side stripes.
- **Internal Padding:** 12px, 16px or 18px depending on density; 24px for standalone empty/error panels.

### Inputs / Fields
- **Style:** dark raised field, 10px radius, `--line` border, 42px minimum height, 12px horizontal padding.
- **Focus:** cyan/accent border shift plus a restrained 3px soft ring; visible keyboard focus is mandatory.
- **Error / Disabled:** red is reserved for error feedback; disabled controls preserve contrast and shape while becoming visibly inactive.

### Navigation
- **Style:** 64px top bar with brand, live date/time, summary chips and icon actions; desktop sidebar is a compact list with counts and a cyan active state.
- **Responsive:** sidebar hides at 900px and becomes a focus-managed drawer; brand copy compacts at 560px while touch targets remain intact.
- **Active state:** `--primary-soft` background, cyan text, semantic `aria-current`; inactive items stay quiet.

### Operator Bar
The signature tablet-first component: a sticky, horizontally scrollable row of
location distribution chips followed by the shared search/sort control. It keeps
the current state, filtering, and next action adjacent to the roster instead of
forcing navigation away from the data.

## Do's and Don'ts

### Do:
- **Do** keep the deep indigo base and use OKLCH tokens from `src/app/globals.css` as the source of truth.
- **Do** use orchid for primary action/selection and cyan for focus or active operational attention.
- **Do** preserve 42px minimum controls and touch-friendly spacing on tablets.
- **Do** reuse `SelectField`, `SearchSortControl`, shared list patterns and Phosphor icons instead of introducing parallel control vocabularies.
- **Do** use mono only for time, counts and values that benefit from alignment.
- **Do** test drawer, sticky operator bar, search, listbox keyboard flow and critical actions at 900px and 560px breakpoints.
- **Do** provide visible focus, semantic state, clear errors and reduced-motion fallbacks.

### Don't:
- **Don't** make the interface look игрушечным: no cartoon styling, decorative overload or effects for their own sake.
- **Don't** use accent colors as decoration; every bright color must communicate action, focus or state.
- **Don't** replace the custom listbox and styled checkbox controls with bare native selects or visible default checkboxes.
- **Don't** use colored side-stripe borders, gradient text, repeating stripe backgrounds or sketchy illustrations.
- **Don't** pair a 1px border with a wide 16px+ decorative shadow on ordinary cards and buttons.
- **Don't** use 32px+ radii on cards, sections or inputs; reserve pill shapes for tags where they carry meaning.
- **Don't** hide roster content behind a load-only animation, and don't add decorative motion that delays the task.
