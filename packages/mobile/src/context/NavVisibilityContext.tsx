import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Keyboard,
  Platform,
} from "react-native";

interface NavVisibilityContextValue {
  navAnim: Animated.Value;
  isVisible: boolean;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  showNav: () => void;
  hideNav: () => void;
  resetNav: () => void;
}

const NavVisibilityContext = createContext<NavVisibilityContextValue>({
  navAnim: new Animated.Value(0),
  isVisible: true,
  isKeyboardVisible: false,
  keyboardHeight: 0,
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const lastOffsetY = useRef(0);
  const isKeyboardOpenRef = useRef(false);

  const showNav = useCallback(() => {
    // If keyboard is currently open, keep nav hidden
    if (isKeyboardOpenRef.current) return;
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
    if (isKeyboardOpenRef.current) return;
    setIsVisible(true);
    navAnim.setValue(0);
    lastOffsetY.current = 0;
  }, [navAnim]);

  // Global keyboard listeners to auto-hide floating nav bar while typing
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onKeyboardShow = (e: any) => {
      isKeyboardOpenRef.current = true;
      setIsKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates?.height || 0);
      hideNav();
    };

    const onKeyboardHide = () => {
      isKeyboardOpenRef.current = false;
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      showNav();
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [hideNav, showNav]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Don't animate nav while keyboard is active
      if (isKeyboardOpenRef.current) return;

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
        isKeyboardVisible,
        keyboardHeight,
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
