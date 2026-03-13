/**
 * NeoSense Design System — Theme Constants
 * Deep navy/dark teal base with electric cyan accents
 */

export const Colors = {
    // Base palette
    background: '#0A1628',
    backgroundLight: '#0F1D32',
    surface: '#142238',
    surfaceLight: '#1A2D4A',
    surfaceHighlight: '#1E3554',

    // Accent colors
    primary: '#00E5FF',
    primaryDim: 'rgba(0, 229, 255, 0.15)',
    primaryGlow: 'rgba(0, 229, 255, 0.3)',
    secondary: '#7B61FF',
    secondaryDim: 'rgba(123, 97, 255, 0.15)',
    mint: '#4FFFB0',
    mintDim: 'rgba(79, 255, 176, 0.15)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#A0B4CC',
    textMuted: '#5A7A99',
    textInverse: '#0A1628',

    // Risk levels
    riskLow: '#4FFFB0',
    riskLowDim: 'rgba(79, 255, 176, 0.15)',
    riskModerate: '#FFB800',
    riskModerateDim: 'rgba(255, 184, 0, 0.15)',
    riskHigh: '#FF4757',
    riskHighDim: 'rgba(255, 71, 87, 0.15)',

    // Status
    success: '#4FFFB0',
    warning: '#FFB800',
    error: '#FF4757',
    info: '#00E5FF',

    // Borders
    border: 'rgba(255, 255, 255, 0.06)',
    borderLight: 'rgba(255, 255, 255, 0.1)',

    // Glassmorphism
    glass: 'rgba(20, 34, 56, 0.7)',
    glassBorder: 'rgba(0, 229, 255, 0.1)',

    // Overlay
    overlay: 'rgba(10, 22, 40, 0.8)',

    // Shadows
    shadow: '#000000',
} as const;

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
} as const;

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    round: 999,
} as const;

export const FontSize = {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
} as const;

export const FontFamily = {
    heading: 'Outfit_600SemiBold',
    headingBold: 'Outfit_700Bold',
    body: 'DMSans_400Regular',
    bodyMedium: 'DMSans_500Medium',
    bodySemiBold: 'DMSans_700Bold',
    bodyBold: 'DMSans_700Bold',
} as const;

export const Shadows = {
    small: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    medium: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    large: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    glow: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
} as const;
