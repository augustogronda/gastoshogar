# SuperDesign System — Finanzas Hogar
> Basado en las directrices de diseño de `superdesigndev/superdesign` para interfaces fintech limpias, táctiles y libres de "AI-slop".

## 1. Principios Visuales
- **Obsidian Glass:** Superficies oscuras profundas (`#09090b` / `#000000`) combinadas con tarjetas de vidrio ahumado (`backdrop-blur-xl`, `bg-zinc-900/70`, `border-white/[0.08]`).
- **Jerarquía Editorial y Tipográfica:** Uso estricto de pesos (Light 300 para símbolos, Regular 400 para etiquetas, Semibold 600 para títulos, Extrabold 800 para cifras clave).
- **Números Tabulares (`tabular-nums font-mono`):** Todo monto monetario debe renderizarse con espaciado numérico monoespaciado para evitar saltos visuales.
- **Identidad Bipolar Equilibrada:**
  - **Agus:** Indigo/Sapphire (`#3b82f6` / `#60a5fa`, `bg-blue-500/10`, `border-blue-500/30`).
  - **Pareja:** Rose/Coral (`#f43f5e` / `#fb7185`, `bg-rose-500/10`, `border-rose-500/30`).
  - **FCI / Inversión Conjunta:** Emerald Jade (`#10b981` / `#34d399`, `bg-emerald-500/10`).
- **Micro-interacciones Táctiles:** `active:scale-[0.97]` con transiciones rápidas de 150ms (`transition-all duration-150 ease-out`).

---

## 2. Tokens de Color

```css
--bg-canvas: #09090b;
--bg-surface: #121215;
--bg-surface-elevated: #18181b;
--border-subtle: rgba(255, 255, 255, 0.07);
--border-highlight: rgba(255, 255, 255, 0.14);

--color-agus: #3b82f6;
--color-agus-muted: rgba(59, 130, 246, 0.15);

--color-pareja: #f43f5e;
--color-pareja-muted: rgba(244, 63, 94, 0.15);

--color-fci: #10b981;
--color-fci-muted: rgba(16, 185, 129, 0.15);
```

---

## 3. Componentes Estándar

### 3.1. Tab Bar Flotante (iOS Premium)
- Separación natural del fondo con `border-t border-white/[0.08]` y fondo translúcido con desenfoque de 24px (`backdrop-blur-2xl`).
- 4 pestañas equidistantes (`Hogar`, `Análisis`, `Cuotas`, `FCI`).
- Estado activo con cápsula sutil (`bg-white/[0.08]`) y color acento temático.

### 3.2. Carga Rápida de Gastos (Bottom Sheet)
- Teclado numérico estilo calculadora suiza: botones redondeados grandes (mínimo 52px de alto), con respuesta táctil.
- Selector de pagador exclusivo entre los 2 miembros (sin opciones redundantes).
- Selector horizontal de categorías con scroll inercial y chips translúcidos.

### 3.3. Cards con Resplandor Sutil
- Gradiente perimetral de 1px usando pseudoelementos o `ring-1 ring-white/[0.08]`.
- Barra de progreso del 60% suave con esquinas totalmente redondeadas y glow reactivo al burn-rate.
