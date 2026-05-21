/**
 * FormTextInput — Paper TextInput wired up to react-hook-form.
 *
 * Why a wrapper instead of inlining `Controller`s in every form: it
 * standardises the error rendering (HelperText below the field, red
 * outline when invalid), the blur/change wiring, and lets us tweak the
 * default keyboardType / autoCapitalize behaviour from a single place.
 *
 * Always trims on submit by default — RHF stores the raw user input,
 * but `onSubmitEditing` passes it through `value.trim()` if the schema
 * uses `z.string().trim()` (which our common schemas do).
 *
 * For numeric or date fields use `FormNumberInput` / `FormDateInput`
 * instead — those parse the string into the right TS type before it
 * hits the schema.
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

interface FormTextInputProps<
  TFieldValues extends FieldValues,
  TOutput extends FieldValues = TFieldValues,
> extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur' | 'error' | 'theme'> {
  // Three generics so RHF v7's `Control<Input, any, Output>` (used whenever
  // a Zod schema has `preprocess` / transforms) flows through unchanged.
  control: Control<TFieldValues, any, TOutput>;
  name: FieldPath<TFieldValues>;
  /** Human-readable label rendered above the field. */
  label: string;
  /** Helper text shown below the field when there's no error. */
  hint?: string;
  /** Hides the field entirely — keeps RHF state intact for conditional logic. */
  hidden?: boolean;
  /**
   * Optional input mask applied on every keystroke (date, phone, etc.).
   * Receives the raw user input, returns the formatted string that gets
   * stored in RHF state. Must be idempotent — see `utils/inputMask.ts`.
   */
  mask?: (input: string) => string;
}

export default function FormTextInput<
  TFieldValues extends FieldValues,
  TOutput extends FieldValues = TFieldValues,
>({
  control,
  name,
  label,
  hint,
  hidden,
  mask,
  style,
  ...inputProps
}: FormTextInputProps<TFieldValues, TOutput>) {
  if (hidden) return null;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => {
        const showError = !!error && isTouched;
        return (
          <View style={styles.wrapper}>
            <TextInput
              {...inputProps}
              mode={inputProps.mode ?? 'outlined'}
              label={label}
              value={value ?? ''}
              onChangeText={mask ? (v) => onChange(mask(v)) : onChange}
              onBlur={onBlur}
              error={showError}
              style={[styles.input, style]}
            />
            {/* HelperText keeps space reserved even when no error, so the
                form doesn't jump as messages appear/disappear. */}
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
