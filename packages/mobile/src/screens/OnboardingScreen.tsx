import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  OnboardingIllustration1,
  OnboardingIllustration2,
  OnboardingIllustration3,
} from "./illustrations/OnboardingIllustrations";
import { useTheme } from "../context/ThemeContext";

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
}) => {
  const { isDark, colors } = useTheme();
  const { width } = useWindowDimensions();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slides = [
    {
      id: "onboarding-1",
      title: "Split expenses the\nsmart way.",
      desc: "No more confusion or awkward reminders.\nManage group bills, track spending, and\nsettle up—fairly and stress-free.",
      Illustration: OnboardingIllustration1,
    },
    {
      id: "onboarding-2",
      title: "Money made simple\nfor roommates",
      desc: "Whether it's rent, groceries, or weekend plans, keep everyone on the same page. Add, split, and settle with just a tap.",
      Illustration: OnboardingIllustration2,
    },
    {
      id: "onboarding-3",
      title: "Split expenses the\nsmart way.",
      desc: "No more confusion or awkward reminders. Manage group bills, track spending, and settle up—fairly and stress-free.",
      Illustration: OnboardingIllustration3,
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const nextIndex = currentSlide + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setCurrentSlide(nextIndex);
    } else {
      onComplete();
    }
  };

  const handleDotPress = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentSlide(index);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index >= 0 && index < slides.length && index !== currentSlide) {
      setCurrentSlide(index);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDark && { backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent={true}
        backgroundColor="transparent"
      />

      {/* Top Bar with Skip Button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[
            styles.skipBtn,
            isDark && { backgroundColor: colors.surfaceInset },
          ]}
          onPress={onComplete}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.skipText, isDark && { color: colors.textSecondary }]}
          >
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {slides.map((slide) => {
          const Illustration = slide.Illustration;
          return (
            <View key={slide.id} style={[styles.slide, { width }]}>
              {/* 100% Coded Vector Graphic */}
              <View style={styles.illustrationWrap}>
                <Illustration />
              </View>

              {/* Typography Content */}
              <View style={styles.textContainer}>
                <Text style={[styles.title, isDark && { color: colors.text }]}>
                  {slide.title}
                </Text>
                <Text
                  style={[
                    styles.desc,
                    isDark && { color: colors.textSecondary },
                  ]}
                >
                  {slide.desc}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Area: Indicators, CTA Button */}
      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => handleDotPress(i)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.dot,
                  i === currentSlide
                    ? [
                        styles.activeDot,
                        isDark && { backgroundColor: colors.accent },
                      ]
                    : [
                        styles.inactiveDot,
                        isDark && { backgroundColor: colors.cardSecondary },
                      ],
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            isDark && {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "space-between",
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: "flex-end",
  },
  skipBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  carousel: {
    flex: 1,
  },
  carouselContent: {
    alignItems: "center",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  illustrationWrap: {
    width: 270,
    height: 270,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  illustrationImage: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 33,
    letterSpacing: -0.4,
  },
  desc: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 21,
    maxWidth: 310,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 20,
    backgroundColor: "#1E293B",
  },
  inactiveDot: {
    width: 6,
    backgroundColor: "#E2E8F0",
  },
  primaryBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 26,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
