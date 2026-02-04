# UI Kit Design Spec (from PNGs)

Note: All values marked "approx" are inferred from the PNG exports. If you need precise measurements, provide Figma inspect or a higher‑resolution export.

## Foundations

### Typography
- Font: Montserrat
- Headline1: 32 / Bold
- Headline2: 20 / Bold
- Headline3: 16 / Bold
- Button: 14 / Semibold
- Text: 14 / Medium
- Subtitle: 12 / Semibold
- Subline: 12 / Medium
- Caption: 10 / Medium

### Spacing Scale
4, 6, 8, 12, 16, 24, 32, 48, 64, 200

### Colors (approx)
- Primary: #1677E6
- Primary Hover: #2E8BFF
- Primary Active: #0F67D5
- Primary Soft BG: #E7F1FF
- Border Light: #D6E6FF
- Text Primary: #1D1D1F
- Text Muted: #7B8794
- Info: #4A7BD0 / BG #E1F0FF
- Success: #17A65B / BG #DDF3E7
- Warning: #E84C4C / BG #FBE0E0

### Shadows
- Soft Card: 0 8px 24px rgba(18, 32, 57, 0.12)
- Toast: 0 18px 40px rgba(11, 42, 85, 0.25)

## Components

### Buttons
All use Montserrat 14 / Semibold. Variants:
- Primary: solid blue, white text/icons
- Soft: light blue bg, blue text/icons
- Outline: white bg, blue text/icons, blue border
- Disabled: muted blue bg, muted text/icons
- Focus: blue glow/outline

Sizes (approx):
- Big: 48px height, radius 8–10, padding x 20
- Middle: 40px height, radius 8, padding x 16
- Small: 32px height, radius 6–8, padding x 12
- Round: 32px height, radius 999, padding x 12

Icon sizing (approx):
- Big/Middle: 16px
- Small: 14px

### Tabs
Atoms:
- Single row of text tabs
- Optional badge pill with dark bg and white text

Molecules:
- Tabs inside a rounded container (light bg)
- Active tab appears lighter/white

### Add Button
- Square icon button
- States: default, hover, active
- Size approx 28–32, rounded corners

### Delete Button
- Square icon button
- States: default, hover, active
- Active: solid red bg, white icon

### Tag
- Small pill
- Green text on green-tint bg

### Reward
- Gold star icon

### Sorting
- Up/down chevrons stacked
- States: neutral, hover, active (blue)

### Row Open
- Single chevron (up/down)
- States: neutral, hover, active

### Cell
- Normal text
- Hover highlight in light blue
- Editable cell shows action icons (check + close)

### Menu Item
- Icon + label
- States: default, hover (light blue bg), active (blue text)
- Tooltip bubble shown for icons

### Menu
- Expanded and collapsed variants
- Expanded shows logo + labels
- Collapsed shows icon-only

### Toasts
- Rounded cards, soft drop shadow
- Variants: info, warning, success
- Colored text matches background hue

## Tailwind Theme Snippet

Paste into `tailwind.config.js` (if you adopt Tailwind later):

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        primary: {
          700: "#0F67D5",
          600: "#1677E6",
          500: "#2E8BFF",
          100: "#E7F1FF",
          50: "#F3F8FF",
        },
        text: {
          900: "#1D1D1F",
          600: "#7B8794",
          500: "#8F9BB3",
        },
        border: {
          200: "#D6E6FF",
          100: "#EDF2F7",
        },
        success: { 600: "#17A65B", 100: "#DDF3E7" },
        warning: { 600: "#E84C4C", 100: "#FBE0E0" },
        info: { 600: "#4A7BD0", 100: "#E1F0FF" },
      },
      borderRadius: {
        "6": "6px",
        "8": "8px",
        "10": "10px",
        "pill": "999px",
      },
      spacing: {
        6: "6px",
        12: "12px",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(18, 32, 57, 0.12)",
        toast: "0 18px 40px rgba(11, 42, 85, 0.25)",
      },
    },
  },
};
```
