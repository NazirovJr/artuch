/**
 * FormNumberInput — numeric field that round-trips a `number` through
 * react-hook-form (not a string). The view layer always sees a string
 * so the user can clear the field, type intermediate states ("1."), etc.,
 * but the form state is parsed on every keystroke so the schema validates
 * an actual number.
 *
 * `decimal=false` (default) means integer-only — strips dots/commas.
 * `decimal=true` allows one decimal separator (`.` or `,`, normalised to `.`).
 *
 * Empty string parses to `undefined`, which makes `z.number().optional()`
 * happy. If you want a default, use `defaultValues` in `useForm`.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import type { TextInputProps } from 'react-native-paper';

interface FormNumberInputProps<
  TFieldValues extends FieldValues,
  TOutput extends FieldValues = TFieldValues,
> extends Omit<
    TextInputProps,
    'value' | 'onChangeText' | 'onBlur' | 'error' | 'theme' | 'keyboardType'
  > {
  control: Control<TFieldValues, any, TOutput>;
  name: FieldPath<TFieldValues>;
  label: string;
  hint?: string;
  /** Allow decimals (price, weight). Default false — integer-only (counts). */
  decimal?: boolean;
  /** Optional suffix shown inside the input (e.g. "TJS", "шт"). */
  suffix?: string;
}

/** Clean and normalise raw input. Returns the cleaned display string + the
 *  parsed numeric value (or `undefined` for empty/incomplete input). */
function parseNumeric(raw: string, decimal: boolean): { display: string; value: number | undefined } {
  // Replace comma with dot — RU keyboard often uses comma.
  let cleaned = raw.replace(/,/g, '.');

  if (decimal) {
    // Strip everything except digits, dot, leading minus.
    cleaned = cleaned.replace(/[^0-9.\-]/g, '');
    // Allow only one dot.
    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    }
    // Allow leading minus only.
    cleaned = cleaned.replace(/(?!^)-/g, '');
  } else {
    cleaned = cleaned.replace(/[^0-9\-]/g, '');
    cleaned = cleaned.replace(/(?!^)-/g, '');
  }

  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
    return { display: cleaned, value: undefined };
  }

  const parsed = decimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  return Number.isNaN(parsed)
    ? { display: cleaned, value: undefined }
    : { display: cleaned, value: parsed };
}

export default function FormNumberInput<
  TFieldValues extends FieldValues,
  TOutput extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  hint,
  decimal = false,
  suffix,
  style,
  ...inputProps
}: FormNumberInputProps<TFieldValues, TOutput>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => {
        // Display lifecycle: keep the user's raw text in local state while
        // they type, but also push the parsed number into RHF immediately
        // so validation runs on every keystroke (per Zod schema).
        const [display, setDisplay] = React.useState<string>(
          value === undefined || value === null ? '' : String(value),
        );

        // Sync down — when RHF reset()s the form, update display.
        React.useEffect(() => {
          if (value === undefined || value === null) {
            setDisplay('');
          } else if (parseNumeric(display, decimal).value !== value) {
            setDisplay(String(value));
          }
        }, [value]); // intentionally not tracking `display` to avoid loops

        const handleChange = (raw: string) => {
          const { display: cleaned, value: parsed } = parseNumeric(raw, decimal);
          setDisplay(cleaned);
          onChange(parsed);
        };

        const showError = !!error && isTouched;
        return (
          <View style={styles.wrapper}>
            <TextInput
              {...inputProps}
              mode={inputProps.mode ?? 'outlined'}
              label={label}
              value={display}
              onChangeText={handleChange}
              onBlur={onBlur}
              error={showError}
              keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
              right={suffix ? <TextInput.Affix text={suffix} /> : undefined}
              style={[styles.input, style]}
            />
            <HelperText type={showError ? 'error' : 'info'} visible={showError || !!hint}>
              {showError ? error?.message : hint || ' '}
            </HelperText>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  input: { backgroundColor: 'transparent' },
});
