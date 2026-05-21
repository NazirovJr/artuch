/**
 * FormDateInput — picker-backed date field that round-trips a real `Date`
 * object through react-hook-form. Eliminates the "ГГГГ-ММ-ДД" placeholder
 * pattern where users could type "32 марта" and the form would happily
 * pass it to the backend.
 *
 * Native (iOS/Android): tapping the field opens
 * `@react-native-community/datetimepicker` in modal/spinner style.
 *
 * Web: react-native-web doesn't render the community picker, so we fall
 * back to a hidden HTML `<input type="date">` overlaid on the read-only
 * Paper TextInput. The browser provides its own native picker UI.
 *
 * Storage: a `Date` (or `undefined` if cleared). The schema can apply
 * `.min(today)` / cross-field refinements directly.
 */
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { TextInput, HelperText, IconButton } from 'react-native-paper';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

interface FormDateInputProps<
  TFieldValues extends FieldValues,
  TOutput extends FieldValues = TFieldValues,
> {
  control: Control<TFieldValues, any, TOutput>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint?: string;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Disable the field — kept selectable for layout symmetry. */
  disabled?: boolean;
}

function formatDisplay(d: Date | null | undefined): string {
  if (!d) return '';
  // ISO YYYY-MM-DD — culture-neutral, matches the previous placeholder
  // and the format the backend expects.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseISO(raw: string): Date | undefined {
  // Browser <input type=date> emits "YYYY-MM-DD" in local TZ.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default function FormDateInput<
  TFieldValues extends FieldValues,
  TOutput extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  hint,
  minDate,
  maxDate,
  disabled,
}: FormDateInputProps<TFieldValues, TOutput>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => {
        const [pickerOpen, setPickerOpen] = useState(false);
        const showError = !!error && isTouched;
        const display = formatDisplay(value as Date | undefined);

        const handleNative = (event: DateTimePickerEvent, picked?: Date) => {
          // Android fires once with `set`/`dismissed`; iOS fires on every
          // change. Closing on each event matches typical UX expectations.
          setPickerOpen(false);
          if (event.type === 'set' && picked) {
            onChange(picked);
            onBlur();
          } else {
            onBlur();
          }
        };

        return (
          <View style={styles.wrapper}>
            {Platform.OS === 'web' ? (
              <View style={styles.webRow}>
                <TextInput
                  mode="outlined"
                  label={label}
                  value={display}
                  editable={false}
                  error={showError}
                  disabled={disabled}
                  style={styles.input}
                  right={
                    value ? (
                      <TextInput.Icon
                        icon="close"
                        onPress={() => onChange(undefined)}
                        forceTextInputFocus={false}
                      />
                    ) : (
                      <TextInput.Icon icon="calendar" forceTextInputFocus={false} />
                    )
                  }
                />
                {/* Native browser picker overlaid on top — invisible but
                    captures clicks across the input area. */}
                {!disabled && (
                  <input
                    type="date"
                    value={display}
                    min={minDate ? formatDisplay(minDate) : undefined}
                    max={maxDate ? formatDisplay(maxDate) : undefined}
                    onChange={(e) => {
                      const next = parseISO((e.target as HTMLInputElement).value);
                      onChange(next);
                      onBlur();
                    }}
                    style={webOverlayStyle}
                  />
                )}
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => !disabled && setPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  {/* `editable=false` makes the TextInput render as a
                      tappable display surface. The Pressable above
                      handles the open. */}
                  <TextInput
                    mode="outlined"
                    label={label}
                    value={display}
                    editable={false}
                    error={showError}
                    disabled={disabled}
                    style={styles.input}
                    right={
                      value && !disabled ? (
                        <TextInput.Icon
                          icon="close"
                          onPress={() => onChange(undefined)}
                          forceTextInputFocus={false}
                        />
                      ) : (
                        <TextInput.Icon icon="calendar" forceTextInputFocus={false} />
                      )
                    }
                  />
                </Pressable>
                {pickerOpen && (
                  <DateTimePicker
                    value={(value as Date) || new Date()}
                    mode="date"
                    minimumDate={minDate}
                    maximumDate={maxDate}
                    onChange={handleNative}
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  />
                )}
              </>
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

// react-native-web doesn't typecheck DOM styles, but at runtime we're a
// browser node so this is exactly what an `<input type=date>` needs.
const webOverlayStyle: any = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  webRow: { position: 'relative' },
  input: { backgroundColor: 'transparent' },
});
