# 🎨 NativeWind Migration Guide
## From React Native StyleSheet to TailwindCSS

> **Last Updated:** December 2025
> **Target:** NativeWind v4 (Latest Stable)

---

## 📊 Current CSS Analysis

### Current Styling Approach
Your app uses **React Native StyleSheet API** across **15 files**:

```
✓ 6 Screens: Login, Signup, Dashboard, Log, Settings, UserManagement
✓ 8 Components: Button, Input, Dropdown, EntryCard, StatWidget, LotSelector, AddCarModal, AddParkingLotModal
✓ 1 Navigation: AppNavigator
```

### Current Pattern Example
```tsx
// Current: React Native StyleSheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
});

<View style={styles.container}>
  <Text style={styles.title}>Hello</Text>
</View>
```

### Problems with Current Approach
- ❌ Verbose boilerplate code
- ❌ No design system consistency
- ❌ Difficult responsive design
- ❌ No dark mode support out of the box
- ❌ Hard to share styles between web/mobile
- ❌ Limited utility-first approach
- ❌ Manual theme management

---

## 🚀 Why NativeWind v4?

### Key Benefits
✅ **Tailwind CSS** - Industry-standard utility-first CSS
✅ **75% Less Code** - Utility classes vs StyleSheet objects
✅ **Dark Mode** - Built-in with `dark:` variants
✅ **Type Safety** - Full TypeScript support
✅ **Hot Reload** - See changes instantly
✅ **CSS Variables** - Dynamic theming support
✅ **Animations** - Native animations via Reanimated
✅ **Web Compatible** - Same code for web & mobile
✅ **Container Queries** - Responsive component sizing
✅ **Group Variants** - Parent-child state styling

### NativeWind v4 Features (2025)
- **jsxImportSource Transform** - No more Babel plugin complexity
- **CSS Variables** - `--primary-color`, `--spacing-lg`
- **Experimental Animations** - Smooth transitions with Reanimated
- **Container Queries** - `@container` support
- **Group Variants** - `group-hover:`, `group-active:`
- **Better rem Support** - Consistent scaling (14px base)
- **tvOS Support** - Cross-platform compatibility

---

## 📦 Installation & Setup

### Step 1: Install Dependencies

```bash
cd frontend

# Install NativeWind v4 and dependencies
bun add nativewind@^4.0.1 react-native-reanimated
bun add -D tailwindcss

# Run pod install (if using iOS)
npx pod-install
```

### Step 2: Initialize Tailwind CSS

```bash
npx tailwindcss init
```

### Step 3: Configure `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Your existing color palette
        primary: '#007AFF',
        secondary: '#5856D6',
        success: '#34C759',
        danger: '#FF3B30',
        warning: '#FF9500',
        background: '#F2F2F7',
        surface: '#FFFFFF',
        text: '#000000',
        textSecondary: '#8E8E93',
        border: '#C6C6C8',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '24px',
        xxl: '32px',
      },
    },
  },
  plugins: [],
};
```

### Step 4: Create Global CSS File

Create `frontend/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 5: Configure Babel

Update `frontend/babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

### Step 6: Configure Metro

Create/update `frontend/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

### Step 7: Import CSS in App

Update `frontend/App.tsx`:

```tsx
import './global.css'; // Add this line
import React from 'react';
import { StatusBar } from 'expo-status-bar';
// ... rest of your imports
```

### Step 8: Add TypeScript Support

Update `frontend/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["nativewind/types"]
  }
}
```

---

## 🔄 Migration Strategy

### Phase 1: Constants Migration (30 min)
Convert `constants/index.ts` color palette to Tailwind config

### Phase 2: Component Migration (3-4 hours)
Migrate components one by one, starting with smallest

### Phase 3: Screen Migration (4-5 hours)
Migrate screens after all components are converted

### Phase 4: Testing & Refinement (2-3 hours)
Visual regression testing, dark mode testing

**Total Estimated Time: 10-13 hours**

---

## 📝 Migration Examples

### Example 1: Simple Component (Button)

**Before (StyleSheet):**
```tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';

export function Button({ title, onPress, variant = 'primary' }) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
      ]}
      onPress={onPress}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
  },
  text: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.surface,
  },
});
```

**After (NativeWind):**
```tsx
import { TouchableOpacity, Text } from 'react-native';
import { cn } from '../lib/utils'; // Class name utility

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function Button({ title, onPress, variant = 'primary', className }: ButtonProps) {
  return (
    <TouchableOpacity
      className={cn(
        'px-lg py-md rounded-lg items-center justify-center',
        variant === 'primary' && 'bg-primary',
        variant === 'secondary' && 'bg-secondary',
        className
      )}
      onPress={onPress}
    >
      <Text className="text-md font-semibold text-white">
        {title}
      </Text>
    </TouchableOpacity>
  );
}
```

**Lines of Code:**
- Before: 40 lines
- After: 25 lines
- **Savings: 37.5%**

---

### Example 2: Complex Component with States

**Before (StyleSheet):**
```tsx
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  focused: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  error: {
    borderColor: COLORS.danger,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: COLORS.background,
  },
});

<View style={[
  styles.container,
  isFocused && styles.focused,
  hasError && styles.error,
  isDisabled && styles.disabled,
]} />
```

**After (NativeWind):**
```tsx
<View className={cn(
  'flex-row items-center p-md bg-surface rounded-lg border border-border',
  isFocused && 'border-primary bg-primary/10',
  hasError && 'border-danger',
  isDisabled && 'opacity-50 bg-background'
)} />
```

**Lines of Code:**
- Before: 20 lines
- After: 6 lines
- **Savings: 70%**

---

### Example 3: Responsive Layout

**Before (StyleSheet with manual breakpoints):**
```tsx
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

const styles = StyleSheet.create({
  container: {
    flexDirection: isLargeScreen ? 'row' : 'column',
    padding: isLargeScreen ? SPACING.xxl : SPACING.lg,
    gap: isLargeScreen ? SPACING.lg : SPACING.md,
  },
});
```

**After (NativeWind with container queries):**
```tsx
<View className="flex-col @lg:flex-row p-lg @lg:p-xxl gap-md @lg:gap-lg" />
```

**Benefits:**
- No JavaScript logic needed
- Automatically responsive
- Works on all screen sizes

---

## 🎨 Recommended UI Component Libraries

### Option 1: React Native Reusables (⭐ Recommended)
**Best for:** Production apps, shadcn/ui fans

```bash
# Visit: https://rn-reusables.com
npx rn-reusables@latest init

# Install specific components
npx rn-reusables@latest add button
npx rn-reusables@latest add input
npx rn-reusables@latest add card
npx rn-reusables@latest add dialog
```

**Features:**
- ✅ 50+ production-ready components
- ✅ Fully customizable with NativeWind
- ✅ Radix UI primitives for React Native
- ✅ Dark mode built-in
- ✅ Accessibility support
- ✅ TypeScript first

**Usage:**
```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

<Card className="p-4">
  <Input placeholder="Email" />
  <Button>Submit</Button>
</Card>
```

---

### Option 2: NativeWind UI
**Best for:** iOS/Android native feel

```bash
# Visit: https://nativewindui.com
npm install nativewindui
```

**Features:**
- ✅ iOS/Android system colors
- ✅ Platform-specific styles
- ✅ Native components (ActionSheet, DatePicker)
- ✅ Haptic feedback support

**Usage:**
```tsx
import { Button } from 'nativewindui';

<Button variant="ios">iOS Style Button</Button>
```

---

### Option 3: Gluestack UI v2 (NativeWind)
**Best for:** Complex apps, enterprise

```bash
npm i @gluestack-ui/nativewind-utils
npm i @gluestack-ui/themed
```

**Features:**
- ✅ 30+ components
- ✅ Overlay/Portal support
- ✅ Toast notifications
- ✅ Form components
- ✅ Advanced theming

---

## 🛠️ Utility Functions

### Create `lib/utils.ts`

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Install dependencies:
```bash
bun add clsx tailwind-merge
```

---

## 🌓 Dark Mode Setup

### Step 1: Create Theme Context

```tsx
// contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  colorScheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');

  const colorScheme = theme === 'system'
    ? (systemColorScheme ?? 'light')
    : theme;

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    AsyncStorage.getItem('theme').then((saved) => {
      if (saved) setThemeState(saved as Theme);
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, setTheme }}>
      <div className={colorScheme === 'dark' ? 'dark' : ''}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
```

### Step 2: Use Dark Mode Classes

```tsx
<View className="bg-white dark:bg-gray-900">
  <Text className="text-gray-900 dark:text-white">
    Auto dark mode!
  </Text>
</View>
```

---

## 🎬 Animation Support

### Enable Reanimated Animations

```tsx
// Configure in tailwind.config.js
module.exports = {
  plugins: [
    require('tailwindcss-animate'), // Add animation utilities
  ],
};
```

### Usage:

```tsx
import { View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';

<Animated.View
  entering={FadeIn.duration(300)}
  className="bg-primary p-4 rounded-lg"
>
  <Text className="text-white">Animated!</Text>
</Animated.View>
```

---

## 📱 Platform-Specific Styling

```tsx
import { Platform } from 'react-native';

<View className={cn(
  'p-4 rounded-lg',
  Platform.OS === 'ios' && 'shadow-lg',
  Platform.OS === 'android' && 'elevation-4'
)}>
  <Text>Platform specific!</Text>
</View>
```

Or use conditional classes:

```tsx
<View className="ios:shadow-lg android:elevation-4" />
```

---

## 🔥 Pro Tips

### 1. Extract Common Patterns
```tsx
// components/ui/card.tsx
export function Card({ children, className, ...props }) {
  return (
    <View
      className={cn(
        'bg-surface rounded-lg p-md shadow-sm border border-border',
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}
```

### 2. Use CSS Variables for Dynamic Values
```tsx
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: 'var(--primary-color)',
    },
  },
}

// In component
<View style={{ '--primary-color': dynamicColor }} className="bg-primary" />
```

### 3. Group Variants for Hover States
```tsx
<View className="group">
  <View className="bg-gray-200 group-active:bg-gray-300">
    <Text className="text-gray-700 group-active:text-gray-900">
      Press parent to change child!
    </Text>
  </View>
</View>
```

---

## 🚨 Common Pitfalls

### ❌ Don't Do This:
```tsx
// Dynamic classes won't work!
<View className={`bg-${color}`} /> // ❌
<View className={isActive ? 'bg-blue-500' : ''} /> // ⚠️ Works but not ideal
```

### ✅ Do This:
```tsx
// Use cn() utility
<View className={cn('p-4', isActive && 'bg-blue-500')} /> // ✅

// Or use style prop for truly dynamic values
<View className="p-4" style={{ backgroundColor: dynamicColor }} /> // ✅
```

---

## 📦 Complete Migration Checklist

### Pre-Migration
- [ ] Install NativeWind v4 and dependencies
- [ ] Configure Tailwind, Babel, Metro
- [ ] Create `global.css` file
- [ ] Add TypeScript types
- [ ] Test basic className usage

### Component Migration
- [ ] Create `lib/utils.ts` with `cn()` function
- [ ] Migrate `Button` component
- [ ] Migrate `Input` component
- [ ] Migrate `Dropdown` component
- [ ] Migrate `StatWidget` component
- [ ] Migrate `EntryCard` component
- [ ] Migrate `LotSelector` component
- [ ] Migrate `AddCarModal` component
- [ ] Migrate `AddParkingLotModal` component

### Screen Migration
- [ ] Migrate `LoginScreen`
- [ ] Migrate `SignupScreen`
- [ ] Migrate `DashboardScreen`
- [ ] Migrate `LogScreen`
- [ ] Migrate `SettingsScreen`
- [ ] Migrate `UserManagementScreen`
- [ ] Migrate `AppNavigator`

### Post-Migration
- [ ] Remove old `StyleSheet.create()` calls
- [ ] Update constants file (optional)
- [ ] Add dark mode support
- [ ] Test on iOS
- [ ] Test on Android
- [ ] Test on web (if applicable)
- [ ] Update documentation

---

## 🎯 Expected Benefits

### Code Reduction
- **30-70% less code** per component
- **Faster development** time
- **Easier maintenance**

### Performance
- **Smaller bundle size** (no StyleSheet objects)
- **Better tree-shaking**
- **Optimized re-renders**

### Developer Experience
- **IntelliSense** for class names (with VSCode extension)
- **Faster prototyping**
- **Consistent design system**
- **Web/mobile code sharing**

---

## 📚 Resources

- [NativeWind Docs](https://nativewind.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Native Reusables](https://rn-reusables.com)
- [NativeWind UI](https://nativewindui.com)
- [Tailwind CSS Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet)

---

## 🤝 Getting Help

If you encounter issues during migration:

1. **Check NativeWind Docs** - Most common issues are documented
2. **Search GitHub Issues** - [NativeWind Issues](https://github.com/nativewind/nativewind/issues)
3. **Discord Community** - Active support community
4. **Stack Overflow** - Tag with `nativewind` and `react-native`

---

## 🎉 Next Steps

1. **Start with this guide** - Follow step-by-step
2. **Migrate one component** - Test Button component first
3. **Expand gradually** - Migrate 2-3 components per day
4. **Add UI library** - Install React Native Reusables
5. **Enable dark mode** - Add ThemeProvider
6. **Celebrate!** - You now have a modern, maintainable codebase

Happy migrating! 🚀
