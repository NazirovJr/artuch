# Kitchen sounds

Положите сюда короткий (≤500мс) звук `new-order.mp3` — он играет, когда
на кухонный экран приходит новый заказ.

Где взять бесплатный звук:
- https://freesound.org/ (фильтр «short», «bell»)
- https://mixkit.co/free-sound-effects/notification/
- Любой notification ping из Material sound kit

После того как положите файл, зарегистрируйте его в `App.tsx`:

```tsx
import { registerKitchenSound } from './src/hooks/useKitchenSound';
registerKitchenSound(require('./assets/sounds/new-order.mp3'));
```

До регистрации `useKitchenSound().playNewOrder()` работает как no-op —
остальная логика кухонного экрана не ломается.
