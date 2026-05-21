/**
 * FormSelect — picker for enum / lookup fields, wired to react-hook-form.
 *
 * Supports two visual modes:
 *  - "menu" (default): outlined button that opens a Paper Menu — fits any
 *    number of options, scrolls if long.
 *  - "segmented": Paper SegmentedButtons, ideal for 2–5 mutually
 *    exclusive choices like charge type or shift mode.
 *
 * Storage: the option's `value` (string). Pair with `z.enum([...])` in
 * the schema for compile-time type narrowing.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Menu,
  Text,
  HelperText,
  SegmentedButtons,
  useTheme,
} from 'react-native-paper';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Optional MaterialCommunityIcons name shown next to the label (segmented mode). */
  icon?: string;
}

interface FormSelectProps<
  TFieldValues extends FieldValues,
  V extends string = string,
  TOutput extends FieldValues = TFieldValues,
> {
  control: Control<TFieldValues, any, TOutput>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: ReadonlyArray<SelectOption<V>>;
  hint?: string;
  /** Render style. `menu` for many options, `segmented` for 2–5. */
  variant?: 'menu' | 'segmented';
  /** Placeholder shown in `menu` mode when nothing is selected. */
  placeholder?: string;
}

export default function FormSelect<
  TFieldValues extends FieldValues,
  V extends string = string,
  TOutput extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  options,
  hint,
  variant = 'menu',
  placeholder = 'Выберите...',
}: FormSelectProps<TFieldValues, V, TOutput>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => {
        const showError = !!error && isTouched;
        const selected = options.find((o) => o.value === value);
        return (
          <View style={styles.wrapper}>
            <Text variant="labelLarge" style={styles.label}>
              {label}
            </Text>
            {variant === 'segmented' ? (
              <SegmentedButtons
                value={(value as string) ?? ''}
                onValueChange={(v) => {
                  onChange(v);
                  onBlur();
                }}
                buttons={options.map((o) => ({
                  value: o.value,
                  label: o.label,
                  icon: o.icon,
                }))}
                density="small"
              />
            ) : (
              <SelectMenu
                selectedLabel={selected?.label ?? placeholder}
                options={options}
                onSelect={(v) => {
                  onChange(v);
                  onBlur();
                }}
                error={showError}
              />
            )}
            <HelperText type={showError ? 'error' : 'info'} visible={showError || !!hint}>
              {showError ? error?.message : hint || ' '}
            </HelperText>
          </View>
        );
      }}
    />
  );
}

interface SelectMenuProps<V extends string> {
  selectedLabel: string;
  options: ReadonlyArray<SelectOption<V>>;
  onSelect: (value: V) => void;
  error: boolean;
}

function SelectMenu<V extends string>({ selectedLabel, options, onSelect, error }: SelectMenuProps<V>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <Button
          mode="outlined"
          icon="chevron-down"
          contentStyle={styles.buttonContent}
          style={[
            styles.button,
            error && { borderColor: theme.colors.error },
          ]}
          onPress={() => setOpen(true)}
        >
          {selectedLabel}
        </Button>
      }
    >
      {options.length === 0 ? (
        // Without an explicit empty state Paper Menu just renders nothing
        // when `options=[]`, leaving the user staring at an invisible
        // popover and assuming the screen is broken. Show a disabled hint
        // so it's obvious there's no data — and that they need to add
        // some elsewhere first.
        <Menu.Item
          title="Нет данных — сначала добавьте запись"
          disabled
        />
      ) : (
        options.map((opt) => (
          <Menu.Item
            key={opt.value}
            title={opt.label}
            leadingIcon={opt.icon}
            onPress={() => {
              onSelect(opt.value);
              setOpen(false);
            }}
          />
        ))
      )}
    </Menu>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  label: { marginBottom: 6, opacity: 0.7 },
  button: { justifyContent: 'flex-start' },
  buttonContent: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
});
