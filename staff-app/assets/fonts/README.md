# App fonts

Папка для кастомных TTF/OTF. По умолчанию приложение использует
системный шрифт (San Francisco на iOS, Roboto на Android) — этого
достаточно для соответствия Material 3. Эта папка нужна, если вы
захотите заменить его на Material 3 Expressive вариативный шрифт
**Roboto Flex**.

## Как подключить Roboto Flex

1. Установить пакет с Google-шрифтом:

   ```bash
   npx expo install @expo-google-fonts/roboto-flex
   ```

2. В `App.tsx`, до вызова `export default function App()`, зарегистрировать
   нужные начертания:

   ```tsx
   import { registerAppFont } from './src/hooks/useAppFonts';

   registerAppFont('RobotoFlex', require('@expo-google-fonts/roboto-flex/RobotoFlex_400Regular.ttf'));
   registerAppFont('RobotoFlex-Medium', require('@expo-google-fonts/roboto-flex/RobotoFlex_500Medium.ttf'));
   registerAppFont('RobotoFlex-Bold', require('@expo-google-fonts/roboto-flex/RobotoFlex_700Bold.ttf'));
   ```

3. В `src/theme/typography.ts` поменять константы:

   ```ts
   const FONT_FAMILY_REGULAR = 'RobotoFlex';
   const FONT_FAMILY_MEDIUM = 'RobotoFlex-Medium';
   ```

4. `App.tsx` уже ждёт `useAppFonts().ready` — после перезапуска всё UI
   отрисуется новым шрифтом. Пока шрифты грузятся, приложение возвращает
   `null` (Expo показывает splash), так что flash-of-unstyled-text не
   будет.

## Альтернатива: локальные файлы

Если не хочется тащить npm-пакет, скачайте
`RobotoFlex-VariableFont.ttf` с https://fonts.google.com/specimen/Roboto+Flex,
положите в эту папку и замените `require('@expo-google-fonts/...')` на
`require('../../assets/fonts/RobotoFlex-VariableFont.ttf')`.
