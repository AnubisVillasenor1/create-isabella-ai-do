/**
 * NavigationStateProvider
 *
 * Context + reducer para la arquitectura de navegación oculta.
 * Gestiona: navbar activa, carpetas expandidas, nodo activo,
 * foco anterior, modo comparativo.
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type {
  NavigationState,
  NavigationAction,
  NavbarId,
} from "./types";

// ============================================================================
// REDUCER
// ============================================================================

const initialState: NavigationState = {
  activeNavbar: null,
  expandedFolders: {},
  activeNode: null,
  previousFocusId: null,
  comparisonMode: false,
  comparisonNavbars: null,
};

function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case "OPEN_NAVBAR": {
      // En modo comparativo, permitir dos navbars
      if (state.comparisonMode && state.comparisonNavbars) {
        const [first, second] = state.comparisonNavbars;
        if (first === action.navbar || second === action.navbar) {
          return state; // Ya está abierta
        }
        return {
          ...state,
          activeNavbar: action.navbar,
        };
      }
      // Modo normal: una sola navbar
      return {
        ...state,
        activeNavbar: action.navbar,
        previousFocusId: state.previousFocusId,
      };
    }

    case "CLOSE_NAVBAR":
      return {
        ...state,
        activeNavbar: null,
        previousFocusId: state.previousFocusId,
      };

    case "TOGGLE_NAVBAR": {
      if (state.activeNavbar === action.navbar) {
        return { ...state, activeNavbar: null };
      }
      return { ...state, activeNavbar: action.navbar };
    }

    case "TOGGLE_FOLDER": {
      const current = state.expandedFolders[action.nodeId] ?? false;
      return {
        ...state,
        expandedFolders: {
          ...state.expandedFolders,
          [action.nodeId]: !current,
        },
      };
    }

    case "EXPAND_FOLDER":
      return {
        ...state,
        expandedFolders: {
          ...state.expandedFolders,
          [action.nodeId]: true,
        },
      };

    case "COLLAPSE_FOLDER":
      return {
        ...state,
        expandedFolders: {
          ...state.expandedFolders,
          [action.nodeId]: false,
        },
      };

    case "SET_ACTIVE_NODE":
      return {
        ...state,
        activeNode: action.nodeId,
      };

    case "SET_PREVIOUS_FOCUS":
      return {
        ...state,
        previousFocusId: action.focusId,
      };

    case "ENABLE_COMPARISON":
      return {
        ...state,
        comparisonMode: true,
        comparisonNavbars: action.navbars,
        activeNavbar: action.navbars[0],
      };

    case "DISABLE_COMPARISON":
      return {
        ...state,
        comparisonMode: false,
        comparisonNavbars: null,
        activeNavbar: null,
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface NavigationContextValue {
  state: NavigationState;
  dispatch: React.Dispatch<NavigationAction>;
  openNavbar: (navbar: NavbarId) => void;
  closeNavbar: () => void;
  toggleNavbar: (navbar: NavbarId) => void;
  toggleFolder: (nodeId: string) => void;
  isFolderExpanded: (nodeId: string) => boolean;
  setPreviousFocus: (focusId: string | null) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function NavigationStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(navigationReducer, initialState);

  const openNavbar = useCallback(
    (navbar: NavbarId) => dispatch({ type: "OPEN_NAVBAR", navbar }),
    [],
  );

  const closeNavbar = useCallback(
    () => dispatch({ type: "CLOSE_NAVBAR" }),
    [],
  );

  const toggleNavbar = useCallback(
    (navbar: NavbarId) => dispatch({ type: "TOGGLE_NAVBAR", navbar }),
    [],
  );

  const toggleFolder = useCallback(
    (nodeId: string) => dispatch({ type: "TOGGLE_FOLDER", nodeId }),
    [],
  );

  const isFolderExpanded = useCallback(
    (nodeId: string) => state.expandedFolders[nodeId] ?? false,
    [state.expandedFolders],
  );

  const setPreviousFocus = useCallback(
    (focusId: string | null) =>
      dispatch({ type: "SET_PREVIOUS_FOCUS", focusId }),
    [],
  );

  const value = useMemo<NavigationContextValue>(
    () => ({
      state,
      dispatch,
      openNavbar,
      closeNavbar,
      toggleNavbar,
      toggleFolder,
      isFolderExpanded,
      setPreviousFocus,
    }),
    [
      state,
      openNavbar,
      closeNavbar,
      toggleNavbar,
      toggleFolder,
      isFolderExpanded,
      setPreviousFocus,
    ],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationStateProvider");
  }
  return context;
}
