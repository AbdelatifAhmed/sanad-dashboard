# 🏗️ خطة بناء Admin Dashboard — مشروع سند

---

## 1. نظرة عامة على الباك اند الموجود

### API Endpoints المتاحة للأدمن

| Endpoint | Method | الوظيفة |
|---|---|---|
| `/api/admin/dashboard/stats` | GET | إحصائيات الداشبورد (KPIs) |
| `/api/admin/companions/pending-companions` | GET | المرافقين في انتظار التحقق |
| `/api/admin/companions/verify-companion/:id` | PATCH | قبول/رفض مرافق |
| `/api/admin/users/:id/toggle-ban` | PUT | حظر/إلغاء حظر مستخدم |
| `/api/auth/login` | POST | تسجيل الدخول (JWT) |

### Data Models الرئيسية

| Model | الحقول الرئيسية |
|---|---|
| **User** | name, email, phone, role (family/companion/admin), isBanned, location, avatar |
| **Companion** | userId, companionType, specialization, bio, hourlyRate, skills, availability, verificationStatus, documents, rating |
| **Family** | familyId, address, beneficiaries[] |
| **Booking** | familyId, companionId, status, totalHours, totalPrice, schedule[], startDate, endDate |
| **JobPost** | familyId, title, serviceType, requiredSkills, budgetPerHour, schedule, location, status |
| **Proposal** | jobPostId, companionId, proposedRate, coverLetter, status |
| **Review** | bookingId, familyId, companionId, rating, comment, isVisible |
| **Notification** | recipientId, title, message, type, isRead |
| **Skill** | nameAr, nameEn, category |

### Authentication
- JWT Bearer Token عبر `Authorization` header
- Role-based access: `isAdmin` middleware

---

## 2. هيكل ملفات المشروع

```
client/admin/
├── angular.json
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles/                          ← 🎨 CSS System
│   │   ├── _variables.css               ← المتغيرات الأساسية
│   │   ├── _typography.css              ← نظام الخطوط
│   │   ├── _animations.css              ← الحركات المشتركة
│   │   ├── _utilities.css               ← أدوات مساعدة
│   │   └── styles.css                   ← الملف الرئيسي (يجمع الكل)
│   │
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.routes.ts
│   │   ├── app.config.ts
│   │   │
│   │   ├── core/                        ← 🔧 الخدمات والبنية الأساسية
│   │   │   ├── interceptors/
│   │   │   │   └── auth.interceptor.ts
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── api.service.ts
│   │   │   │   ├── stats.service.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   ├── companions.service.ts
│   │   │   │   ├── bookings.service.ts
│   │   │   │   ├── reviews.service.ts
│   │   │   │   ├── jobs.service.ts
│   │   │   │   └── toast.service.ts
│   │   │   └── models/
│   │   │       ├── user.model.ts
│   │   │       ├── companion.model.ts
│   │   │       ├── booking.model.ts
│   │   │       ├── job-post.model.ts
│   │   │       ├── review.model.ts
│   │   │       ├── proposal.model.ts
│   │   │       └── api-response.model.ts
│   │   │
│   │   ├── shared/                      ← 🧩 Shared Components
│   │   │   ├── components/
│   │   │   │   ├── sidebar/
│   │   │   │   ├── topbar/
│   │   │   │   ├── stat-card/
│   │   │   │   ├── data-table/
│   │   │   │   ├── modal/
│   │   │   │   ├── badge/
│   │   │   │   ├── avatar/
│   │   │   │   ├── search-input/
│   │   │   │   ├── pagination/
│   │   │   │   ├── loading-spinner/
│   │   │   │   ├── empty-state/
│   │   │   │   ├── confirm-dialog/
│   │   │   │   ├── toast/
│   │   │   │   └── chart-card/
│   │   │   ├── pipes/
│   │   │   │   ├── time-ago.pipe.ts
│   │   │   │   ├── arabic-number.pipe.ts
│   │   │   │   └── truncate.pipe.ts
│   │   │   └── directives/
│   │   │       ├── click-outside.directive.ts
│   │   │       └── tooltip.directive.ts
│   │   │
│   │   ├── layouts/                     ← 📐 Layout
│   │   │   └── admin-layout/
│   │   │       ├── admin-layout.component.ts
│   │   │       └── admin-layout.component.html
│   │   │
│   │   └── features/                    ← 📄 الصفحات
│   │       ├── auth/
│   │       │   └── login/
│   │       ├── dashboard/
│   │       │   └── dashboard.component.ts
│   │       ├── users/
│   │       │   ├── user-list/
│   │       │   └── user-detail/
│   │       ├── companions/
│   │       │   ├── companion-list/
│   │       │   ├── companion-detail/
│   │       │   └── pending-verification/
│   │       ├── bookings/
│   │       │   ├── booking-list/
│   │       │   └── booking-detail/
│   │       ├── jobs/
│   │       │   ├── job-list/
│   │       │   └── job-detail/
│   │       ├── reviews/
│   │       │   └── review-list/
│   │       └── settings/
│   │           └── settings.component.ts
│   │
│   └── environments/
│       ├── environment.ts
│       └── environment.prod.ts
```

---

## 3. Dependencies المطلوبة

### Core
```
@angular/core               ^19.x
@angular/router             ^19.x
@angular/forms              ^19.x
@angular/common/http        ^19.x
@angular/animations         ^19.x
```

### Styling
```
tailwindcss                 ^4.x
@tailwindcss/postcss        ^4.x
```

### Charts & Visualization
```
chart.js                    ^4.x
ng2-charts                  ^7.x       ← Angular wrapper لـ Chart.js
```

### Icons
```
lucide-angular              ^latest    ← أيقونات نظيفة و lightweight
```

### Utilities
```
date-fns                    ^4.x       ← تنسيق التواريخ (أخف من moment)
```

> [!NOTE]
> مفيش حاجات زي NgRx أو مكتبات UI كبيرة — الداشبورد بسيط كفاية نبنيه بـ Angular Signals + Services.

---

## 4. نظام CSS المتغيرات (`_variables.css`)

### 🎨 Color System

```css
:root {
  /* ─── Brand Colors ─── */
  --clr-primary-50:  #EEF2FF;
  --clr-primary-100: #DDE6FE;
  --clr-primary-200: #C3D4FD;
  --clr-primary-300: #9AB5FB;
  --clr-primary-400: #6B8DF7;
  --clr-primary-500: #4A6CF7;   /* Main Brand */
  --clr-primary-600: #3451DB;
  --clr-primary-700: #2B40C0;
  --clr-primary-800: #29369C;
  --clr-primary-900: #27327B;

  /* ─── Accent (Teal) ─── */
  --clr-accent-400: #2DD4BF;
  --clr-accent-500: #14B8A6;
  --clr-accent-600: #0D9488;

  /* ─── Neutral (Slate) ─── */
  --clr-neutral-0:   #FFFFFF;
  --clr-neutral-50:  #F8FAFC;
  --clr-neutral-100: #F1F5F9;
  --clr-neutral-200: #E2E8F0;
  --clr-neutral-300: #CBD5E1;
  --clr-neutral-400: #94A3B8;
  --clr-neutral-500: #64748B;
  --clr-neutral-600: #475569;
  --clr-neutral-700: #334155;
  --clr-neutral-800: #1E293B;
  --clr-neutral-900: #0F172A;
  --clr-neutral-950: #020617;

  /* ─── Semantic Colors ─── */
  --clr-success-light: #DCFCE7;
  --clr-success:       #22C55E;
  --clr-success-dark:  #15803D;

  --clr-warning-light: #FEF3C7;
  --clr-warning:       #F59E0B;
  --clr-warning-dark:  #B45309;

  --clr-danger-light:  #FEE2E2;
  --clr-danger:        #EF4444;
  --clr-danger-dark:   #B91C1C;

  --clr-info-light:    #DBEAFE;
  --clr-info:          #3B82F6;
  --clr-info-dark:     #1D4ED8;
}
```

### 🌙 Dark Mode

```css
[data-theme="dark"] {
  --clr-bg-primary:    var(--clr-neutral-950);
  --clr-bg-secondary:  var(--clr-neutral-900);
  --clr-bg-card:       var(--clr-neutral-800);
  --clr-bg-hover:      var(--clr-neutral-700);
  --clr-border:        var(--clr-neutral-700);
  --clr-text-primary:  var(--clr-neutral-50);
  --clr-text-secondary:var(--clr-neutral-400);
}

[data-theme="light"] {
  --clr-bg-primary:    var(--clr-neutral-0);
  --clr-bg-secondary:  var(--clr-neutral-50);
  --clr-bg-card:       var(--clr-neutral-0);
  --clr-bg-hover:      var(--clr-neutral-100);
  --clr-border:        var(--clr-neutral-200);
  --clr-text-primary:  var(--clr-neutral-900);
  --clr-text-secondary:var(--clr-neutral-500);
}
```

### 📝 Typography System

```css
:root {
  /* ─── Font Family ─── */
  --font-primary:  'IBM Plex Sans Arabic', sans-serif;  /* العربي */
  --font-display:  'Plus Jakarta Sans', sans-serif;     /* العناوين الإنجليزي */
  --font-mono:     'JetBrains Mono', monospace;         /* الأرقام والكود */

  /* ─── Font Sizes (fluid) ─── */
  --fs-xs:    0.75rem;    /* 12px */
  --fs-sm:    0.875rem;   /* 14px */
  --fs-base:  1rem;       /* 16px */
  --fs-lg:    1.125rem;   /* 18px */
  --fs-xl:    1.25rem;    /* 20px */
  --fs-2xl:   1.5rem;     /* 24px */
  --fs-3xl:   1.875rem;   /* 30px */
  --fs-4xl:   2.25rem;    /* 36px */

  /* ─── Font Weights ─── */
  --fw-regular:   400;
  --fw-medium:    500;
  --fw-semibold:  600;
  --fw-bold:      700;

  /* ─── Line Heights ─── */
  --lh-tight:   1.25;
  --lh-normal:  1.5;
  --lh-relaxed: 1.75;

  /* ─── Letter Spacing ─── */
  --ls-tight:   -0.025em;
  --ls-normal:   0;
  --ls-wide:     0.025em;
}
```

> [!IMPORTANT]
> **اختيار الخطوط:**
> - **IBM Plex Sans Arabic** — خط عربي احترافي من IBM، واضح في الداشبوردات ويدعم كل الأوزان
> - **Plus Jakarta Sans** — خط إنجليزي عصري geometric بيدي إحساس premium
> - **JetBrains Mono** — للأرقام في الإحصائيات عشان تبان واضحة ومميزة

### 📏 Spacing & Layout

```css
:root {
  /* ─── Spacing Scale ─── */
  --sp-1:  0.25rem;   /* 4px  */
  --sp-2:  0.5rem;    /* 8px  */
  --sp-3:  0.75rem;   /* 12px */
  --sp-4:  1rem;      /* 16px */
  --sp-5:  1.25rem;   /* 20px */
  --sp-6:  1.5rem;    /* 24px */
  --sp-8:  2rem;      /* 32px */
  --sp-10: 2.5rem;    /* 40px */
  --sp-12: 3rem;      /* 48px */
  --sp-16: 4rem;      /* 64px */

  /* ─── Border Radius ─── */
  --radius-sm:   0.375rem;  /* 6px  */
  --radius-md:   0.5rem;    /* 8px  */
  --radius-lg:   0.75rem;   /* 12px */
  --radius-xl:   1rem;      /* 16px */
  --radius-2xl:  1.5rem;    /* 24px */
  --radius-full: 9999px;

  /* ─── Shadows ─── */
  --shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.1);
  --shadow-xl:  0 20px 25px -5px rgb(0 0 0 / 0.1);

  /* ─── Layout ─── */
  --sidebar-width:          260px;
  --sidebar-collapsed:      72px;
  --topbar-height:          64px;

  /* ─── Transitions ─── */
  --transition-fast:   150ms ease;
  --transition-base:   250ms ease;
  --transition-slow:   350ms ease;

  /* ─── Z-Index Scale ─── */
  --z-dropdown:  1000;
  --z-sticky:    1020;
  --z-modal:     1050;
  --z-toast:     1090;
}
```

---

## 5. تقسيم Tailwind Config

```js
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  'var(--clr-primary-50)',
          100: 'var(--clr-primary-100)',
          // ... باقي الدرجات
          500: 'var(--clr-primary-500)',
          900: 'var(--clr-primary-900)',
        },
        accent: {
          400: 'var(--clr-accent-400)',
          500: 'var(--clr-accent-500)',
          600: 'var(--clr-accent-600)',
        },
        // semantic, neutral ... نفس المنهج
      },
      fontFamily: {
        primary: ['var(--font-primary)'],
        display: ['var(--font-display)'],
        mono:    ['var(--font-mono)'],
      },
      fontSize: {
        // mapped from CSS variables
      },
      borderRadius: {
        // mapped from CSS variables
      },
    },
  },
};
```

> [!TIP]
> الألوان كلها مربوطة بالـ CSS Variables — لو عايز تغير الثيم كله بتغير ملف واحد بس (`_variables.css`)

---

## 6. Shared Components بالتفصيل

### كل Component وإيه اللي بيعمله:

| Component | الوصف | يُستخدم في |
|---|---|---|
| **Sidebar** | القائمة الجانبية مع nav links + collapse | كل الصفحات |
| **Topbar** | شريط علوي (بحث + notifications + avatar) | كل الصفحات |
| **Stat Card** | كارت إحصائيات (رقم + أيقونة + نسبة تغيير) | Dashboard |
| **Data Table** | جدول بيانات (sort + filter + pagination) | Users, Companions, Bookings, Jobs |
| **Modal** | نافذة منبثقة (confirm, form, detail view) | Verify Companion, Ban User |
| **Badge** | شارة حالة ملونة (pending, verified, active...) | كل الجداول |
| **Avatar** | صورة مستخدم دائرية مع fallback | الجداول + التفاصيل |
| **Search Input** | حقل بحث مع debounce + أيقونة | Topbar + الجداول |
| **Pagination** | تنقل بين صفحات البيانات | كل الجداول |
| **Loading Spinner** | مؤشر تحميل (skeleton أو spinner) | كل الصفحات |
| **Empty State** | رسالة "لا توجد بيانات" مع أيقونة | الجداول الفارغة |
| **Confirm Dialog** | تأكيد قبل عمليات حساسة (حذف/حظر) | Ban, Verify |
| **Toast** | إشعارات نجاح/خطأ مؤقتة | كل العمليات |
| **Chart Card** | كارت يحتوي رسم بياني (Chart.js) | Dashboard |

---

## 7. خطة البناء خطوة بخطوة

### المرحلة 1: التأسيس 🏗️
1. إنشاء مشروع Angular 19 (Standalone, SSR disabled)
2. تثبيت Tailwind v4 + الإعدادات
3. إنشاء ملفات CSS الأساسية (variables, typography, animations)
4. تحميل الخطوط من Google Fonts
5. إعداد `environment.ts` مع API base URL

### المرحلة 2: البنية التحتية ⚙️
6. إنشاء TypeScript Models/Interfaces
7. بناء `api.service.ts` (HTTP wrapper مع base URL)
8. بناء `auth.service.ts` (login, token storage, logout)
9. بناء `auth.interceptor.ts` (إضافة JWT لكل request)
10. بناء `auth.guard.ts` (حماية الصفحات)

### المرحلة 3: Layout 📐
11. بناء `Sidebar` component
12. بناء `Topbar` component
13. بناء `AdminLayout` (sidebar + topbar + router-outlet)
14. إعداد Routing مع lazy loading

### المرحلة 4: Shared Components 🧩
15. بناء `Stat Card`
16. بناء `Badge`
17. بناء `Avatar`
18. بناء `Data Table` (reusable مع inputs للأعمدة)
19. بناء `Modal` + `Confirm Dialog`
20. بناء `Toast` service + component
21. بناء `Loading Spinner` + `Empty State`
22. بناء `Search Input` + `Pagination`

### المرحلة 5: الصفحات 📄
23. **Login Page** — استخدام `auth.service`
24. **Dashboard** — استخدام `stats.service` + Stat Cards + Charts
25. **Users List** — جدول المستخدمين + بحث + toggle ban
26. **User Detail** — تفاصيل مستخدم واحد
27. **Companions List** — كل المرافقين + فلترة بالحالة
28. **Pending Verification** — المرافقين في الانتظار + verify/reject
29. **Companion Detail** — بيانات + وثائق + تقييمات
30. **Bookings List** — كل الحجوزات + فلترة
31. **Booking Detail** — تفاصيل حجز + الجدول الزمني
32. **Jobs List** — عروض العمل
33. **Reviews List** — التقييمات + toggle visibility

### المرحلة 6: التلميع ✨
34. Responsive design (mobile sidebar drawer)
35. Dark/Light mode toggle
36. Animations و transitions
37. Error handling عام
38. Performance optimization (OnPush, trackBy)

---

## 8. ملفات CSS المنفصلة

```
styles/
├── _variables.css      ← الألوان + الخطوط + المقاسات + الظلال (الملف المركزي)
├── _typography.css     ← heading styles, body text, RTL support
├── _animations.css     ← fadeIn, slideIn, pulse, skeleton shimmer
├── _utilities.css      ← glass effect, truncate, scrollbar custom
└── styles.css          ← @import الكل + Tailwind layers + Google Fonts
```

### `_animations.css` — أمثلة على الحركات المشتركة:
- `fadeIn` / `fadeOut` — ظهور واختفاء سلس
- `slideInRight` / `slideInLeft` — للـ Sidebar والـ Modals
- `slideUp` — للـ Toast notifications
- `scaleIn` — للـ Modals
- `shimmer` — Loading skeleton effect
- `pulse` — للأرقام في الـ Stat Cards

### `_utilities.css` — أدوات CSS مشتركة:
- `.glass` — تأثير glassmorphism
- `.line-clamp-{n}` — اقتطاع النص
- `.custom-scrollbar` — تخصيص شريط التمرير
- `.rtl-flip` — عكس الاتجاه لعناصر محددة

---

## 9. Routing Structure

```
/login                          → LoginComponent
/                               → AdminLayout (protected)
  ├── /dashboard                → DashboardComponent
  ├── /users                    → UserListComponent
  ├── /users/:id                → UserDetailComponent
  ├── /companions               → CompanionListComponent
  ├── /companions/pending       → PendingVerificationComponent
  ├── /companions/:id           → CompanionDetailComponent
  ├── /bookings                 → BookingListComponent
  ├── /bookings/:id             → BookingDetailComponent
  ├── /jobs                     → JobListComponent
  ├── /jobs/:id                 → JobDetailComponent
  ├── /reviews                  → ReviewListComponent
  └── /settings                 → SettingsComponent
```

> [!WARNING]
> الـ Routing كله Lazy Loaded — كل feature بتتحمل لما المستخدم يزورها فقط

---

## 10. ملاحظات مهمة

1. **RTL Support**: المشروع بيدعم عربي — لازم `dir="rtl"` على الـ `<html>` + الخط العربي أساسي
2. **الباك اند لسه محتاج endpoints جديدة**: الأدمن APIs الحالية محدودة (stats, pending companions, toggle ban). لازم نضيف endpoints لـ: list all users, list all bookings, list all reviews, etc.
3. **Angular 19 Standalone**: مش هنستخدم NgModules — كل component standalone
4. **Signals**: هنستخدم Angular Signals بدل RxJS في الـ state management البسيط
