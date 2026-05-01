import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { User, Mail, Lock, LogOut, Package, Eye, EyeOff, ShieldCheck, Heart, Phone, Bell, MessageSquare, Check } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useRouter } from 'expo-router';
import { supabase, Order } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNotifications } from '@/context/NotificationContext';
import AppHeader from '@/components/AppHeader';
import GlossyButton from '@/components/GlossyButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

export default function AccountScreen() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return <ProfileView />;
}

function AuthView() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.account} />
      <ScrollView
        contentContainerStyle={styles.authContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authHeader}>
          <User size={56} color={Colors.neonBlue} strokeWidth={1.5} />
          <Text style={styles.authTitle}>
            {tab === 'login' ? t.welcomeBack : t.createAccount}
          </Text>
          <Text style={styles.authSubtitle}>
            {tab === 'login' ? t.signInSubtitle : t.registerSubtitle}
          </Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.authTab, tab === 'login' && styles.authTabActive]}
            onPress={() => setTab('login')}
          >
            <Text style={[styles.authTabText, tab === 'login' && styles.authTabTextActive]}>
              {t.login}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authTab, tab === 'register' && styles.authTabActive]}
            onPress={() => setTab('register')}
          >
            <Text style={[styles.authTabText, tab === 'register' && styles.authTabTextActive]}>
              {t.register}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'login' ? <LoginForm /> : <RegisterForm onSuccess={() => setTab('login')} />}

        <TouchableOpacity
          style={styles.adminLinkBtn}
          onPress={() => router.push('/admin')}
          activeOpacity={0.8}
        >
          <ShieldCheck size={14} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.adminLinkBtnText}>Admin Panel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError(t.invalidEmail);
      return;
    }
    if (!password.trim()) {
      setError(t.passwordRequired);
      return;
    }
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (!result.success) setError(result.error ?? t.invalidCredentials);
    setLoading(false);
  };

  return (
    <View style={styles.form}>
      {error ? <ErrorBanner message={error} /> : null}
      <AuthField
        label={t.email}
        value={email}
        onChange={setEmail}
        icon={<Mail size={16} color={Colors.textMuted} />}
        keyboardType="email-address"
        placeholder={t.emailPlaceholder}
      />
      <AuthField
        label={t.password}
        value={password}
        onChange={setPassword}
        icon={<Lock size={16} color={Colors.textMuted} />}
        secureTextEntry={!showPw}
        placeholder="••••••••"
        right={
          <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
            {showPw ? (
              <EyeOff size={16} color={Colors.textMuted} />
            ) : (
              <Eye size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        }
      />
      <GlossyButton
        title={t.signIn}
        onPress={handleLogin}
        loading={loading}
        fullWidth
        size="lg"
        style={{ marginTop: Spacing.sm }}
      />
    </View>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { register } = useAuth();
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!firstName.trim()) { setError(t.firstNameRequired); return; }
    if (!lastName.trim()) { setError(t.lastNameRequired); return; }
    if (!email.trim() || !email.includes('@')) { setError(t.validEmailRequired); return; }
    if (password.length < 6) { setError(t.passwordMinLength); return; }
    if (password !== confirm) { setError(t.passwordsNoMatch); return; }
    setLoading(true);
    setError('');
    const result = await register(firstName, lastName, email, password);
    setLoading(false);
    if (!result.success) { setError(result.error ?? t.validEmailRequired); return; }
    onSuccess();
  };

  return (
    <View style={styles.form}>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.nameRow}>
        <View style={{ flex: 1 }}>
          <AuthField label={t.firstName} value={firstName} onChange={setFirstName} placeholder="John" />
        </View>
        <View style={{ flex: 1 }}>
          <AuthField label={t.lastName} value={lastName} onChange={setLastName} placeholder="Doe" />
        </View>
      </View>
      <AuthField
        label={t.email}
        value={email}
        onChange={setEmail}
        icon={<Mail size={16} color={Colors.textMuted} />}
        keyboardType="email-address"
        placeholder={t.emailPlaceholder}
      />
      <AuthField
        label={t.password}
        value={password}
        onChange={setPassword}
        icon={<Lock size={16} color={Colors.textMuted} />}
        secureTextEntry={!showPw}
        placeholder={t.passwordPlaceholder}
        right={
          <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
            {showPw ? <EyeOff size={16} color={Colors.textMuted} /> : <Eye size={16} color={Colors.textMuted} />}
          </TouchableOpacity>
        }
      />
      <AuthField
        label={t.confirmPassword}
        value={confirm}
        onChange={setConfirm}
        icon={<Lock size={16} color={Colors.textMuted} />}
        secureTextEntry={!showPw}
        placeholder={t.confirmPassword}
      />
      <GlossyButton
        title={t.createAccount}
        onPress={handleRegister}
        loading={loading}
        fullWidth
        size="lg"
        style={{ marginTop: Spacing.sm }}
      />
    </View>
  );
}

function NotifToggle({
  label,
  sublabel,
  value,
  onToggle,
  icon,
  iconColor,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  iconColor: string;
}) {
  return (
    <TouchableOpacity
      style={styles.notifToggleRow}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.notifToggleIcon, { backgroundColor: iconColor + '20', borderColor: iconColor + '40' }]}>
        {icon}
      </View>
      <View style={styles.notifToggleBody}>
        <Text style={styles.notifToggleLabel}>{label}</Text>
        {sublabel ? <Text style={styles.notifToggleSub}>{sublabel}</Text> : null}
      </View>
      <View style={[styles.notifToggleCheck, value && styles.notifToggleCheckOn, { borderColor: value ? iconColor : Colors.border }]}>
        {value && <Check size={12} color={iconColor} strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}

function ProfileView() {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { count: wishlistCount } = useWishlist();
  const { customerRow, savingPrefs, upsertCustomer } = useNotifications();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [phone, setPhone] = useState('');
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  // Sync phone from customerRow
  useEffect(() => {
    if (customerRow?.phone && !phoneEdited) {
      setPhone(customerRow.phone);
    }
  }, [customerRow?.phone]);

  const appOptIn = customerRow?.app_opt_in ?? true;
  const whatsappOptIn = customerRow?.whatsapp_opt_in ?? false;
  const emailOptIn = customerRow?.email_opt_in ?? false;

  const handleToggle = (field: 'app_opt_in' | 'whatsapp_opt_in' | 'email_opt_in') => {
    const current = { app_opt_in: appOptIn, whatsapp_opt_in: whatsappOptIn, email_opt_in: emailOptIn };
    upsertCustomer({ ...current, [field]: !current[field], phone });
  };

  const handleSavePhone = async () => {
    if (!phone.trim()) return;
    setSavingPhone(true);
    await upsertCustomer({ phone: phone.trim(), app_opt_in: appOptIn, whatsapp_opt_in: whatsappOptIn, email_opt_in: emailOptIn });
    setPhoneEdited(false);
    setSavingPhone(false);
  };

  useEffect(() => {
    if (!user?.email) {
      setLoadingOrders(false);
      return;
    }
    supabase
      .from('orders')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data);
        setLoadingOrders(false);
      });
  }, [user]);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <View style={styles.container}>
      <AppHeader title={t.account} />
      <ScrollView contentContainerStyle={styles.profileContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || 'SG'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={() => { logout(); }} style={styles.logoutBtn} activeOpacity={0.8}>
            <LogOut size={18} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatCard label={t.jumps} value="0+" />
          <StatCard label={t.orders} value={String(orders.length)} />
          <StatCard label={t.level} value="Pro" />
        </View>

        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={() => router.push('/(tabs)/wishlist' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.wishlistBtnLeft}>
            <Heart size={18} color="#FF4D6D" fill="#FF4D6D" strokeWidth={2} />
            <Text style={styles.wishlistBtnText}>{t.myWishlist ?? 'My Wishlist'}</Text>
          </View>
          {wishlistCount > 0 && (
            <View style={styles.wishlistBtnBadge}>
              <Text style={styles.wishlistBtnBadgeText}>{wishlistCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.langRow}>
          <Text style={styles.langLabel}>{t.language}</Text>
          <LanguageSwitcher />
        </View>

        <TouchableOpacity
          style={styles.adminPanelBtn}
          onPress={() => router.push('/admin')}
          activeOpacity={0.8}
        >
          <ShieldCheck size={18} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.adminPanelBtnText}>Admin Panel</Text>
        </TouchableOpacity>

        {/* Notification Preferences */}
        <View style={styles.notifSection}>
          <View style={styles.sectionHeader}>
            <Bell size={18} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
          </View>

          <View style={styles.phoneRow}>
            <Phone size={14} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={(v) => { setPhone(v); setPhoneEdited(true); }}
              placeholder="Phone / WhatsApp number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
            {phoneEdited && phone.trim().length > 0 && (
              <TouchableOpacity
                style={styles.phoneSaveBtn}
                onPress={handleSavePhone}
                disabled={savingPhone}
                activeOpacity={0.7}
              >
                <Text style={styles.phoneSaveBtnText}>{savingPhone ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <NotifToggle
            label="App notifications"
            sublabel="Receive updates inside the app"
            value={appOptIn}
            onToggle={() => handleToggle('app_opt_in')}
            icon={<Bell size={15} color={Colors.neonBlue} strokeWidth={2} />}
            iconColor={Colors.neonBlue}
          />
          <NotifToggle
            label="WhatsApp offers"
            sublabel="Exclusive deals via WhatsApp"
            value={whatsappOptIn}
            onToggle={() => handleToggle('whatsapp_opt_in')}
            icon={<MessageSquare size={15} color={Colors.success} strokeWidth={2} />}
            iconColor={Colors.success}
          />
          <NotifToggle
            label="Email offers"
            sublabel="Promotions and newsletters"
            value={emailOptIn}
            onToggle={() => handleToggle('email_opt_in')}
            icon={<Mail size={15} color={Colors.gold} strokeWidth={2} />}
            iconColor={Colors.gold}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Package size={18} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.sectionTitle}>{t.orderHistory}</Text>
        </View>

        {loadingOrders ? (
          <View style={styles.loadingOrders}>
            <Text style={styles.loadingText}>{t.loadingOrders}</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Package size={40} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyOrdersText}>{t.noOrdersYet}</Text>
            <Text style={styles.emptyOrdersSubtext}>{t.purchasesWillAppear}</Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { language } = useLanguage();
  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const statusColor =
    order.status === 'confirmed'
      ? Colors.success
      : order.status === 'pending'
      ? Colors.warning
      : Colors.textMuted;

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTopRow}>
        <Text style={styles.orderId}>
          #{order.id.slice(0, 8).toUpperCase()}
        </Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={styles.orderDate}>{date}</Text>
      <View style={styles.orderBottom}>
        <Text style={styles.orderTotal}>{formatPrice(order.total, language)}</Text>
        <Text style={styles.orderPayment}>{order.payment_method.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AuthField({
  label,
  value,
  onChange,
  icon,
  keyboardType,
  placeholder,
  secureTextEntry,
  right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  keyboardType?: any;
  placeholder?: string;
  secureTextEntry?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {right}
      </View>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  authContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  authHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  authTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    textAlign: 'center',
  },
  authSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
  },
  authTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  authTabActive: {
    backgroundColor: Colors.neonBlue,
  },
  authTabText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  authTabTextActive: {
    color: Colors.white,
  },
  form: {
    gap: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  fieldWrapper: {
    gap: 4,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  fieldInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
  },
  errorBanner: {
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.neonBlueDim,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.neonBlue,
  },
  avatarText: {
    color: Colors.white,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  profileEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  langLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  wishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  wishlistBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wishlistBtnText: {
    color: '#FF4D6D',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  wishlistBtnBadge: {
    backgroundColor: '#FF4D6D',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  wishlistBtnBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  adminPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  adminPanelBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  loadingOrders: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyOrdersText: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  emptyOrdersSubtext: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  ordersList: {
    gap: Spacing.sm,
  },
  orderCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  orderDate: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    color: Colors.neonBlue,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  orderPayment: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  adminLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  adminLinkBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  notifSection: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: 2,
  },
  phoneInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  phoneSaveBtn: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  phoneSaveBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  notifToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  notifToggleIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifToggleBody: {
    flex: 1,
    gap: 1,
  },
  notifToggleLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  notifToggleSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  notifToggleCheck: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  notifToggleCheckOn: {
    backgroundColor: 'transparent',
  },
});
