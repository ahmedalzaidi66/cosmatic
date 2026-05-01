import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Camera,
  Sparkles,
  ShoppingBag,
  Layers,
} from 'lucide-react-native';
import { supabase, Product, Category, fetchCategories, getCategoryName } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import AppHeader from '@/components/AppHeader';
import { useLanguage } from '@/context/LanguageContext';
import { PageBlock } from '@/context/PageBuilderContext';
import { useLayout, SectionId, SpacingBreakpoint } from '@/context/LayoutContext';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';
import HeroVideo from '@/components/HeroVideo';
import { getProductName, getProductImage } from '@/lib/supabase';
import StarRating from '@/components/StarRating';
import { useCart } from '@/context/CartContext';
import WishlistHeart from '@/components/WishlistHeart';
import { AutoScrollRow } from '@/components/AutoScrollRow';

// ─── Types ────────────────────────────────────────────────────────────────────

type HomepageSection = {
  id: string;
  title_ar: string;
  title_en: string;
  sort_order: number;
  products: Product[];
};

// ─── Layout spacing hook (used by BeautyTryOnHero internally) ────────────────

function clampSpacing(sp: SpacingBreakpoint): SpacingBreakpoint {
  return {
    marginTop:     Math.max(0, Math.min(200, sp.marginTop)),
    marginBottom:  Math.max(0, Math.min(200, sp.marginBottom)),
    paddingTop:    Math.max(0, Math.min(160, sp.paddingTop)),
    paddingBottom: Math.max(0, Math.min(160, sp.paddingBottom)),
    paddingLeft:   Math.max(0, Math.min(120, sp.paddingLeft)),
    paddingRight:  Math.max(0, Math.min(120, sp.paddingRight)),
    maxWidth:      Math.max(0, Math.min(1800, sp.maxWidth)),
    borderRadius:  Math.max(0, Math.min(64, sp.borderRadius)),
  };
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const { language, t } = useLanguage();
  const { content, cmsRow, refresh: refreshCMS } = useCMS();

  const [categories, setCategories] = useState<Category[]>([]);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [homeSections, setHomeSections] = useState<HomepageSection[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const committedLanguage = useRef(language);

  // ── Fetch homepage sections with their products ───────────────────────────

  const fetchSections = useCallback(async (lang: string) => {
    // 1. Fetch active sections ordered by sort_order
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('homepage_sections')
      .select('id, title_ar, title_en, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (sectionsError || !sectionsData || committedLanguage.current !== lang) return;
    if (sectionsData.length === 0) { setHomeSections([]); return; }

    // 2. For each section, fetch its ordered product IDs
    const sectionIds = sectionsData.map(s => s.id);
    const { data: spData, error: spError } = await supabase
      .from('homepage_section_products')
      .select('section_id, product_id, sort_order')
      .in('section_id', sectionIds)
      .order('sort_order', { ascending: true });

    if (spError || committedLanguage.current !== lang) return;

    // 3. Collect all unique product IDs needed
    const allProductIds = [...new Set((spData ?? []).map(sp => sp.product_id))];
    if (allProductIds.length === 0) { setHomeSections([]); return; }

    // 4. Fetch those products with translations in one query
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        translation:product_translations!left(
          id, product_id, language, name, short_description,
          full_description, meta_title, meta_description
        )
      `)
      .in('id', allProductIds)
      .eq('status', 'active');

    if (productsError || committedLanguage.current !== lang) return;

    // 5. Normalize product rows (pick correct translation)
    const normalizeProduct = (row: any): Product => {
      const translations: any[] = Array.isArray(row.translation) ? row.translation : row.translation ? [row.translation] : [];
      const t = translations.find((t: any) => t.language === lang) ?? translations.find((t: any) => t.language === 'en') ?? null;
      return {
        ...row,
        name: t?.name || row.name,
        description: t?.short_description || row.description,
        translation: t ?? null,
      } as Product;
    };

    const productMap = new Map<string, Product>(
      (productsData ?? []).map(row => [row.id, normalizeProduct(row)])
    );

    // 6. Build sections, skip sections with no visible products
    const built: HomepageSection[] = sectionsData
      .map(sec => {
        const sps = (spData ?? [])
          .filter(sp => sp.section_id === sec.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const products = sps
          .map(sp => productMap.get(sp.product_id))
          .filter((p): p is Product => p !== undefined);
        return { id: sec.id, title_ar: sec.title_ar, title_en: sec.title_en, sort_order: sec.sort_order, products };
      })
      .filter(sec => sec.products.length > 0);

    setHomeSections(built);
  }, []);

  // ── Fetch everything else ─────────────────────────────────────────────────

  const fetchAll = useCallback(async (fetchLang: string) => {
    const [layoutRes, categoriesRes] = await Promise.allSettled([
      supabase.from('page_layouts').select('id').eq('page', 'home').maybeSingle(),
      fetchCategories(fetchLang),
    ]);

    if (committedLanguage.current !== fetchLang) return;

    if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value);

    if (layoutRes.status === 'fulfilled' && layoutRes.value.data) {
      const { data: blocksData } = await supabase
        .from('page_blocks')
        .select('*')
        .eq('layout_id', layoutRes.value.data.id)
        .order('order_index', { ascending: true });
      if (committedLanguage.current !== fetchLang) return;
      if (blocksData) setBlocks(blocksData as PageBlock[]);
    }

    await fetchSections(fetchLang);
    setRefreshing(false);
  }, [fetchSections]);

  useEffect(() => {
    committedLanguage.current = language;
    fetchAll(language);
  }, [language, fetchAll]);

  // ── Hero content ──────────────────────────────────────────────────────────

  const visibleBlocks = useMemo(() => blocks.filter(b => b.visible), [blocks]);
  const heroBlock = visibleBlocks.find(b => b.type === 'hero');
  const cmsHero = content.hero ?? {};
  const blockHero = heroBlock?.content ?? {};

  const heroContent = {
    media_type:    cmsHero.media_type  || blockHero.media_type  || 'image',
    image_url:     cmsHero.image_url   || blockHero.image_url   || cmsRow?.hero_image || 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800',
    video_url:     cmsHero.video_url   || blockHero.video_url   || '',
    title:         cmsHero.title       || blockHero.title       || cmsRow?.hero_title       || t.heroDefault.title,
    subtitle:      cmsHero.subtitle    || blockHero.subtitle    || cmsRow?.hero_subtitle    || t.heroDefault.subtitle,
    badge_text:    cmsHero.badge_text  || blockHero.badge_text  || t.heroDefault.badge,
    cta_primary:   cmsHero.cta_primary || blockHero.cta_primary || cmsRow?.hero_button_text || t.shop,
    cta_secondary: cmsHero.cta_secondary || blockHero.cta_secondary || '',
    overlay_color: cmsHero.overlay_color || blockHero.overlay_color || 'rgba(10,5,7,0.55)',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              committedLanguage.current = language;
              fetchAll(language);
              refreshCMS(language);
            }}
            tintColor={Colors.neonBlue}
          />
        }
      >
        <HeroVideo heroContent={heroContent} />

        <ShopByCategorySection categories={categories} language={language} />

        <BeautyTryOnHero />

        {homeSections.map(section => (
          <HomeSectionRow key={section.id} section={section} language={language} />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Shop by Category ─────────────────────────────────────────────────────────

const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  lipstick:    '#B22234',
  blush:       '#E07B8B',
  concealer:   '#D4A574',
  foundation:  '#C4956A',
  skincare:    '#8BC4A8',
  tools:       '#A88BC4',
  sets:        '#C4A88B',
  accessories: '#8BA8C4',
};

function getCategoryColor(slug: string): string {
  for (const [key, color] of Object.entries(CATEGORY_FALLBACK_COLORS)) {
    if (slug.includes(key)) return color;
  }
  return '#C08081';
}

function ShopByCategorySection({ categories, language }: { categories: Category[]; language: string }) {
  const router = useRouter();
  const isRTL = language === 'ar';
  const title = language === 'ar' ? 'تسوقي حسب القسم' : 'Shop by Category';

  if (categories.length === 0) return null;

  return (
    <View style={catStyles.section}>
      <View style={[catStyles.headerRow, isRTL && catStyles.headerRowRTL]}>
        <Text style={catStyles.title}>{title}</Text>
        <TouchableOpacity
          style={catStyles.viewAllBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/products' as any)}
        >
          <Text style={catStyles.viewAllText}>
            {language === 'ar' ? 'عرض الكل' : 'View all'}
          </Text>
          <ChevronRight size={13} color={Colors.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <AutoScrollRow contentContainerStyle={catStyles.scrollContent}>
        {categories.map((cat) => {
          const name = getCategoryName(cat, language);
          const color = getCategoryColor(cat.slug);
          return (
            <TouchableOpacity
              key={cat.id}
              style={catStyles.card}
              activeOpacity={0.82}
              onPress={() => router.push({ pathname: '/(tabs)/products', params: { category: cat.slug } } as any)}
            >
              <View style={[catStyles.ringOuter, { borderColor: color + '44' }]}>
                <View style={[catStyles.ringInner, { borderColor: color + '88', backgroundColor: color + '18' }]}>
                  {cat.icon_url ? (
                    <Image source={{ uri: cat.icon_url }} style={catStyles.icon} resizeMode="cover" />
                  ) : (
                    <View style={[catStyles.iconFallback, { backgroundColor: color + '33' }]}>
                      <Layers size={22} color={color} strokeWidth={1.5} />
                    </View>
                  )}
                </View>
              </View>
              <Text style={catStyles.label} numberOfLines={2}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </AutoScrollRow>
    </View>
  );
}

const catStyles = StyleSheet.create({
  section: { paddingTop: 20, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 },
  headerRowRTL: { flexDirection: 'row-reverse' },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { color: Colors.neonBlue, fontSize: 12, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 14, gap: 12, paddingBottom: 4 },
  card: { alignItems: 'center', width: 74, gap: 8 },
  ringOuter: { width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, padding: 3, justifyContent: 'center', alignItems: 'center' },
  ringInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  icon: { width: '100%', height: '100%', borderRadius: 30 },
  iconFallback: { width: '100%', height: '100%', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  label: { color: '#F0D0E0', fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13, maxWidth: 72 },
});

// ─── Beauty Try-On Hero ───────────────────────────────────────────────────────

const FLOATING_SHADES = [
  { color: '#B22234', x: '8%',  y: '14%', size: 28 },
  { color: '#E88BA5', x: '82%', y: '10%', size: 22 },
  { color: '#C08081', x: '88%', y: '48%', size: 26 },
  { color: '#F4A28C', x: '5%',  y: '55%', size: 20 },
  { color: '#8E3A59', x: '76%', y: '72%', size: 18 },
  { color: '#E07B8B', x: '14%', y: '78%', size: 24 },
];

function BeautyTryOnHero() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const faceSize = isWide ? 180 : Math.min(width * 0.38, 160);

  return (
    <View style={tryOnStyles.wrapper}>
      <LinearGradient
        colors={['rgba(255,77,141,0.18)', 'rgba(180,40,100,0.08)', 'rgba(10,5,7,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(255,77,141,0.06)', 'transparent']}
        style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={tryOnStyles.glowOrb} />

      {FLOATING_SHADES.map((shade, i) => (
        <View
          key={i}
          style={[
            tryOnStyles.floatingShade,
            { width: shade.size, height: shade.size, borderRadius: shade.size / 2, backgroundColor: shade.color, left: shade.x as any, top: shade.y as any, opacity: 0.55 },
          ]}
        />
      ))}

      <View style={tryOnStyles.content}>
        <View style={tryOnStyles.badge}>
          <Sparkles size={11} color={Colors.neonBlue} strokeWidth={2.5} />
          <Text style={tryOnStyles.badgeText}>AI-POWERED</Text>
        </View>

        <Text style={[tryOnStyles.title, isWide && { fontSize: 32 }]}>
          Discover Your{'\n'}
          <Text style={tryOnStyles.titleAccent}>Perfect Shade</Text>
        </Text>

        <Text style={tryOnStyles.subtitle}>
          See how makeup looks on you in seconds{'\n'}using AI face detection
        </Text>

        <View style={tryOnStyles.faceRow}>
          <View style={tryOnStyles.faceCard}>
            <View style={[tryOnStyles.faceImageWrap, { width: faceSize, height: faceSize }]}>
              <Image
                source={{ uri: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400' }}
                style={tryOnStyles.faceImage}
                resizeMode="cover"
              />
              <View style={tryOnStyles.faceLabel}>
                <Text style={tryOnStyles.faceLabelText}>BEFORE</Text>
              </View>
            </View>
          </View>

          <View style={tryOnStyles.arrowWrap}>
            <Sparkles size={20} color={Colors.neonBlue} strokeWidth={2} />
          </View>

          <View style={tryOnStyles.faceCard}>
            <View style={[tryOnStyles.faceImageWrap, tryOnStyles.faceImageWrapAfter, { width: faceSize, height: faceSize }]}>
              <Image
                source={{ uri: 'https://images.pexels.com/photos/3373739/pexels-photo-3373739.jpeg?auto=compress&cs=tinysrgb&w=400' }}
                style={tryOnStyles.faceImage}
                resizeMode="cover"
              />
              <LinearGradient colors={['transparent', 'rgba(255,77,141,0.15)']} style={StyleSheet.absoluteFill} />
              <View style={[tryOnStyles.faceLabel, tryOnStyles.faceLabelAfter]}>
                <Text style={[tryOnStyles.faceLabelText, { color: Colors.neonBlue }]}>AFTER</Text>
              </View>
            </View>
            <View style={tryOnStyles.afterShadeDots}>
              {['#B22234', '#C08081', '#E88BA5'].map((c, i) => (
                <View key={i} style={[tryOnStyles.afterShadeDot, { backgroundColor: c }]} />
              ))}
            </View>
          </View>
        </View>

        <View style={tryOnStyles.categoriesRow}>
          {[
            { label: 'Lipstick', color: '#B22234' },
            { label: 'Blush', color: '#E07B8B' },
            { label: 'Concealer', color: '#D4A574' },
            { label: 'Foundation', color: '#C4956A' },
          ].map((cat) => (
            <View key={cat.label} style={tryOnStyles.categoryChip}>
              <View style={[tryOnStyles.categoryDot, { backgroundColor: cat.color }]} />
              <Text style={tryOnStyles.categoryText}>{cat.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={tryOnStyles.ctaBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/canopy')}
        >
          <LinearGradient colors={['#FF4D8D', '#E0356E']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={tryOnStyles.ctaGlow} />
          <Camera size={18} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={tryOnStyles.ctaText}>TRY NOW</Text>
          <ChevronRight size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tryOnStyles = StyleSheet.create({
  wrapper: { marginHorizontal: 0, marginTop: 20, overflow: 'hidden', backgroundColor: '#1A0A12', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,77,141,0.15)', position: 'relative' },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,77,141,0.08)', top: '20%', left: '50%', marginLeft: -130, shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 60, elevation: 0 },
  floatingShade: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 2 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32, alignItems: 'center', gap: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,77,141,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)', borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 5 },
  badgeText: { color: Colors.neonBlue, fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 34, letterSpacing: -0.3 },
  titleAccent: { color: Colors.neonBlue, textShadowColor: 'rgba(255,77,141,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  subtitle: { color: '#D6A0B8', fontSize: 13, fontWeight: '400', textAlign: 'center', lineHeight: 20, marginTop: -4, opacity: 0.85 },
  faceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 4 },
  faceCard: { alignItems: 'center', position: 'relative' },
  faceImageWrap: { borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#140A10' },
  faceImageWrapAfter: { borderColor: 'rgba(255,77,141,0.35)', shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 6 },
  faceImage: { width: '100%', height: '100%' },
  faceLabel: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(10,5,7,0.75)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  faceLabelAfter: { borderColor: 'rgba(255,77,141,0.3)', backgroundColor: 'rgba(10,5,7,0.8)' },
  faceLabelText: { color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  afterShadeDots: { flexDirection: 'row', gap: 4, marginTop: 8 },
  afterShadeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  arrowWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,77,141,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)', justifyContent: 'center', alignItems: 'center' },
  categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  categoryDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  categoryText: { color: '#D6A0B8', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 40, overflow: 'hidden', position: 'relative', marginTop: 4 },
  ctaGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.12)', top: -40, left: '30%' },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
});

// ─── Homepage Section Row ─────────────────────────────────────────────────────

function HomeSectionRow({ section, language }: { section: HomepageSection; language: string }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { t } = useLanguage();

  const title = language === 'ar'
    ? (section.title_ar || section.title_en)
    : (section.title_en || section.title_ar);

  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => router.push('/(tabs)/products' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.seeAllDots}>
            {[0, 1, 2].map(i => <View key={i} style={styles.seeAllDot} />)}
          </View>
          <ChevronRight size={13} color={Colors.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <AutoScrollRow contentContainerStyle={styles.rowScrollContent}>
        {section.products.map(product => (
          <View key={product.id} style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push(`/product/${product.id}`)}
            >
              <View style={styles.cardImageWrap}>
                <Image
                  source={{ uri: getProductImage(product) }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <WishlistHeart product={product} size={16} />
                {product.badge ? (
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{product.badge}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={2}>
                {getProductName(product, language)}
              </Text>
              <StarRating rating={product.rating} reviewCount={product.review_count} size={8} showCount={false} />
              <Text style={styles.cardPrice}>{formatPrice(product.price, language)}</Text>
              <TouchableOpacity
                style={styles.cartBtn}
                activeOpacity={0.85}
                onPress={() => addToCart(product)}
              >
                <ShoppingBag size={12} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.cartBtnText}>{t.addToCart.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </AutoScrollRow>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 8 },

  // Section header
  sectionWrap: { paddingTop: 22 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.8 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  seeAllDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.neonBlue },

  // Product card
  rowScrollContent: { paddingHorizontal: 12, gap: 10, paddingBottom: 4 },
  card: { width: 140, backgroundColor: '#1E0F18', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,77,141,0.15)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 3 },
  cardImageWrap: { width: '100%', height: 110, backgroundColor: '#140A10', overflow: 'hidden', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: Colors.neonBlue, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  cardBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  cardInfo: { padding: 6, gap: 2 },
  cardName: { color: '#FDE8F0', fontSize: 10, fontWeight: '700', lineHeight: 14 },
  cardPrice: { color: Colors.neonBlue, fontSize: 11, fontWeight: '900', marginTop: 1 },
  cartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.neonBlue, borderRadius: Radius.full, paddingVertical: 4, marginTop: 3, shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  cartBtnText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});
