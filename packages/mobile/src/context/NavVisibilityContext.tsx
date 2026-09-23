import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";

interface NavVisibilityContextValue {
  navAnim: Animated.Value;
  isVisible: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  showNav: () => void;
  hideNav: () => void;
  resetNav: () => void;
}

const NavVisibilityContext = createContext<NavVisibilityContextValue>({
  navAnim: new Animated.Value(0),
  isVisible: true,
  onScroll: () => {},
  showNav: () => {},
  hideNav: () => {},
  resetNav: () => {},
});

export const NavVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navAnim = useRef(new Animated.Value(0)).current; // 0 = visible, 1 = hidden
  const [isVisible, setIsVisible] = useState(true);
  const lastOffsetY = useRef(0);
  const isAnimating = useRef(false);

  const showNav = useCallback(() => {
    setIsVisible(true);
    Animated.timing(navAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [navAnim]);

  const hideNav = useCallback(() => {
    setIsVisible(false);
    Animated.timing(navAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [navAnim]);

  const resetNav = useCallback(() => {
    setIsVisible(true);
    navAnim.setValue(0);
    lastOffsetY.current = 0;
  }, [navAnim]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const diff = currentY - lastOffsetY.current;

      // When near the top, always show the navigation bar
      if (currentY <= 25) {
        showNav();
        lastOffsetY.current = Math.max(0, currentY);
        return;
      }

      // Small jitter buffer so tiny finger wobbles don't flicker the bar
      if (Math.abs(diff) < 10) {
        return;
      }

      // When scrolling down the page (finger swipes up), hide nav below
      if (diff > 0) {
        hideNav();
      } else if (diff < 0) {
        // When scrolling up toward the top (finger swipes down), reveal nav
        showNav();
      }

      lastOffsetY.current = currentY;
    },
    [showNav, hideNav],
  );

  return (
    <NavVisibilityContext.Provider
      value={{
        navAnim,
        isVisible,
        onScroll,
        showNav,
        hideNav,
        resetNav,
      }}
    >
      {children}
    </NavVisibilityContext.Provider>
  );
};

export const useNavVisibility = () => useContext(NavVisibilityContext);
