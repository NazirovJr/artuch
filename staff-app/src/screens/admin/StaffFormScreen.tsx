import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Divider,
  Switch,
  Text,
} from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUser, getUser, updateUser } from '../../api/users';
import { getRoles } from '../../api/roles';
import { getOutlets, type Outlet } from '../../api/outlets';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import { useToast } from '../../components/ui/Toast';
import ScreenContainer from '../../components/ui/ScreenContainer';
import { FormSelect, FormTextInput } from '../../components/form';
import { maskPhone } from '../../utils/inputMask';
import {
  staffFormSchema,
  type StaffForm,
  type StaffFormInput,
} from '../../schemas/staff';

type Props = NativeStackScreenProps<AdminStackParamList, 'StaffForm'>;

interface RoleOption {
  id: string;
  name: string;
  description?: string;
}

export default function StaffFormScreen({ route, navigation }: Props) {
  const toast = useToast();
  const userId = route.params?.userId;
  const isEditing = !!userId;

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const { control, handleSubmit, formState, reset, watch, setValue } = useForm<
    StaffFormInput,
    any,
    StaffForm
  >({
    resolver: zodResolver(staffFormSchema),
    mode: 'onTouched',
    defaultValues: {
      mode: isEditing ? 'edit' : 'create',
      username: '',
      fullName: '',
      roleId: '',
      password: '',
      pin: '',
      email: '',
      phone: '',
      isActive: true,
      outletIds: [],
    },
  });

  const watchedOutletIds = watch('outletIds') ?? [];
  const watchedIsActive = watch('isActive');

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [rolesData, outletsData] = await Promise.all([
        getRoles(),
        getOutlets(),
      ]);
      setRoles(rolesData as RoleOption[]);
      setOutlets(outletsData);

      if (isEditing && userId) {
        const user = await getUser(userId);
        if (user) {
          const roleName = typeof user.role === 'object' ? user.role?.name : user.role;
          const match = (rolesData as RoleOption[]).find(
            (r) => r.name === roleName || r.id === user.roleId,
          );
          reset({
            mode: 'edit',
            username: user.username || '',
            fullName: user.fullName || '',
            roleId: match?.id ?? '',
            password: '',
            pin: '',
            email: user.email || '',
            phone: user.phone || '',
            isActive: user.isActive !== false,
            outletIds: Array.isArray(user.outletIds) ? user.outletIds : [],
          });
        }
      }
    } catch (e: any) {
      toast.error(
        'Не удалось загрузить справочники',
        e?.message || 'Проверьте сеть или перелогиньтесь',
      );
    } finally {
      setLoadingData(false);
    }
  }, [isEditing, userId, toast, reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleOutlet = (id: string) => {
    const current = watchedOutletIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    setValue('outletIds', next, { shouldDirty: true });
  };

  const onSubmit = async (data: StaffForm) => {
    try {
      const role = roles.find((r) => r.id === data.roleId);
      const payload: any = {
        username: data.username,
        fullName: data.fullName,
        role: role?.name,
        roleId: data.roleId,
        isActive: data.isActive,
        outletIds: data.outletIds,
      };
      if (data.password) payload.password = data.password;
      if (data.pin) payload.pin = data.pin;
      if (data.email) payload.email = data.email;
      if (data.phone) payload.phone = data.phone;

      if (isEditing && userId) {
        await updateUser(userId, payload);
        toast.success('Сохранено', `${data.fullName} обновлён`);
      } else {
        await createUser(payload);
        toast.success('Создан', `${data.fullName} · ${role?.name ?? ''}`);
      }
      navigation.goBack();
    } catch (e: any) {
      toast.error(
        isEditing ? 'Не удалось обновить' : 'Не удалось создать',
        e?.message || 'Попробуйте ещё раз',
      );
    }
  };

  if (loadingData) {
    return (
      <ScreenContainer maxWidth="reading">
        <View style={[styles.container, styles.center]}>
          <Text>Загрузка...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView style={styles.container}>
        <View style={styles.form}>
          <FormTextInput
            control={control}
            name="username"
            label="Имя пользователя *"
            autoCapitalize="none"
          />
          <FormTextInput control={control} name="fullName" label="ФИО *" />

          <FormSelect
            control={control}
            name="roleId"
            label="Роль *"
            placeholder="Выберите роль"
            options={roles.map((r) => ({
              value: r.id,
              label: r.description ? `${r.name} — ${r.description}` : r.name,
            }))}
          />

          {outlets.length > 0 && (
            <View style={styles.outletsBlock}>
              <Text variant="labelLarge" style={styles.fieldLabel}>
                Активно в точках
              </Text>
              <Text variant="bodySmall" style={styles.hint}>
                Сотрудник увидит эти точки в POS и сможет принимать продажи.
              </Text>
              <View style={styles.chipRow}>
                {outlets.map((o) => {
                  const picked = watchedOutletIds.includes(o.id);
                  return (
                    <Chip
                      key={o.id}
                      mode={picked ? 'flat' : 'outlined'}
                      selected={picked}
                      onPress={() => toggleOutlet(o.id)}
                      style={styles.chip}
                      icon={picked ? 'check' : undefined}
                    >
                      {o.name}
                    </Chip>
                  );
                })}
              </View>
            </View>
          )}

          <Divider style={styles.sectionDivider} />

          <FormTextInput
            control={control}
            name="password"
            label={isEditing ? 'Пароль (оставьте пустым, если не менять)' : 'Пароль *'}
            secureTextEntry
            autoCapitalize="none"
            hint={isEditing ? 'Минимум 8 символов' : undefined}
          />

          <FormTextInput
            control={control}
            name="pin"
            label={
              isEditing ? 'PIN-код (оставьте пустым, если не менять)' : 'PIN-код (4–6 цифр)'
            }
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />

          <FormTextInput
            control={control}
            name="email"
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormTextInput
            control={control}
            name="phone"
            label="Телефон"
            keyboardType="phone-pad"
            mask={maskPhone}
          />

          {/* `isActive` is a plain switch — Controller handles its boolean. */}
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <View style={styles.switchRow}>
                <Text variant="bodyLarge">Активен</Text>
                <Switch value={!!field.value} onValueChange={field.onChange} />
              </View>
            )}
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={formState.isSubmitting}
            disabled={formState.isSubmitting || !formState.isValid}
            style={styles.submitButton}
            icon="check"
          >
            {isEditing ? 'Сохранить' : 'Создать'}
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  fieldLabel: { marginBottom: 4, marginTop: 4 },
  hint: { marginBottom: 8, opacity: 0.7 },
  outletsBlock: { marginBottom: 12 },
  sectionDivider: { marginVertical: 8 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: { marginRight: 0 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  submitButton: { marginTop: 8, borderRadius: 8 },
});
