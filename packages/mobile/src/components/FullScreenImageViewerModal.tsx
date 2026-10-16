import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

export interface FullScreenImageViewerModalProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  authorName?: string;
  caption?: string;
  onClose: () => void;
}

export const FullScreenImageViewerModal: React.FC<
  FullScreenImageViewerModalProps
> = ({ visible, images, initialIndex = 0, authorName, caption, onClose }) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [screenDimensions, setScreenDimensions] = useState(() =>
    Dimensions.get("window"),
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Listen for screen resize (split screen, orientation change, web resize)
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setScreenDimensions(window);
    });
    return () => sub?.remove();
  }, []);

  const screenWidth = screenDimensions.width;
  const screenHeight = screenDimensions.height;

  useEffect(() => {
    if (visible) {
      const targetIndex = Math.min(
        Math.max(0, initialIndex),
        Math.max(0, images.length - 1),
      );
      setCurrentIndex(targetIndex);
      setControlsVisible(true);
      fadeAnim.setValue(1);

      // Scroll to targetIndex after render
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: targetIndex * screenWidth,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialIndex, images.length, screenWidth]);

  const toggleControls = () => {
    const toVal = controlsVisible ? 0 : 1;
    Animated.timing(fadeAnim, {
      toValue: toVal,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setControlsVisible(!controlsVisible);
    });
  };

  const handleScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / screenWidth);
    if (nextIndex >= 0 && nextIndex < images.length) {
      setCurrentIndex(nextIndex);
    }
  };

  const scrollToNext = () => {
    if (currentIndex < images.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      scrollViewRef.current?.scrollTo({
        x: next * screenWidth,
        animated: true,
      });
    }
  };

  const scrollToPrev = () => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      scrollViewRef.current?.scrollTo({
        x: prev * screenWidth,
        animated: true,
      });
    }
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Horizontal Swiping Carousel */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          style={styles.scrollView}
          contentContainerStyle={{ width: screenWidth * images.length }}
        >
          {images.map((uri, idx) => (
            <TouchableOpacity
              key={`${uri}_${idx}`}
              activeOpacity={1}
              onPress={toggleControls}
              style={[
                styles.slide,
                { width: screenWidth, height: screenHeight },
              ]}
            >
              <Image
                source={{ uri }}
                style={[
                  styles.image,
                  { width: screenWidth, height: screenHeight * 0.8 },
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Floating Top Header Overlay */}
        <Animated.View
          pointerEvents={controlsVisible ? "auto" : "none"}
          style={[
            styles.headerOverlay,
            {
              paddingTop: Math.max(insets.top + 8, 20),
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.8}
            accessibilityLabel="Close image viewer"
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {images.length > 1 && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>
                  {currentIndex + 1} of {images.length}
                </Text>
              </View>
            )}
            {authorName ? (
              <Text style={styles.authorText} numberOfLines={1}>
                {authorName}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerRightPlaceholder} />
        </Animated.View>

        {/* Desktop / Tablet Navigation Arrows */}
        {controlsVisible && images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                onPress={scrollToPrev}
                style={[
                  styles.navArrow,
                  styles.navArrowLeft,
                  { top: screenHeight / 2 - 24 },
                ]}
                activeOpacity={0.8}
                accessibilityLabel="Previous image"
              >
                <Feather name="chevron-left" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                onPress={scrollToNext}
                style={[
                  styles.navArrow,
                  styles.navArrowRight,
                  { top: screenHeight / 2 - 24 },
                ]}
                activeOpacity={0.8}
                accessibilityLabel="Next image"
              >
                <Feather name="chevron-right" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Bottom Caption & Thumbnails Bar */}
        <Animated.View
          pointerEvents={controlsVisible ? "auto" : "none"}
          style={[
            styles.bottomOverlay,
            {
              paddingBottom: Math.max(insets.bottom + 12, 24),
              opacity: fadeAnim,
            },
          ]}
        >
          {caption ? (
            <Text style={styles.captionText} numberOfLines={3}>
              {caption}
            </Text>
          ) : null}

          {/* Thumbnails Row if multi-image */}
          {images.length > 1 && (
            <View style={styles.thumbnailsRow}>
              {images.map((imgUri, idx) => {
                const isSelected = idx === currentIndex;
                return (
                  <TouchableOpacity
                    key={`thumb_${imgUri}_${idx}`}
                    onPress={() => {
                      setCurrentIndex(idx);
                      scrollViewRef.current?.scrollTo({
                        x: idx * screenWidth,
                        animated: true,
                      });
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.thumbWrap,
                      isSelected && styles.thumbWrapSelected,
                    ]}
                  >
                    <Image
                      source={{ uri: imgUri }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#000000",
  },
  slide: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  image: {
    backgroundColor: "#000000",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
  },
  counterBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  authorText: {
    color: "#E2E8F0",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  headerRightPlaceholder: {
    width: 44,
  },
  navArrow: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  navArrowLeft: {
    left: 12,
  },
  navArrowRight: {
    right: 12,
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 10,
    alignItems: "center",
  },
  captionText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 12,
  },
  thumbnailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  thumbWrap: {
    width: 40,
    height: 40,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    opacity: 0.6,
  },
  thumbWrapSelected: {
    borderColor: "#3B82F6",
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
});
