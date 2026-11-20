/** Shared player-shell layout tokens (smart-menu guestTableUi pattern). */

export const DAMA_BOTTOM_NAV_HEIGHT_VAR = "--dama-bottom-nav-height";
/** Extra gap under the nav height; immersive chat sets this to `0px` so the composer is flush. */
export const DAMA_BOTTOM_PAD_EXTRA_VAR = "--dama-bottom-pad-extra";
export const DAMA_MOBILE_HEADER_HEIGHT_VAR = "--dama-mobile-header-height";

/**
 * Clearance under fixed mobile bottom nav (height var + gap + safe-area).
 * Immersive chat sets `--dama-bottom-nav-height: 0px` and `--dama-bottom-pad-extra: 0px`
 * so the composer sits flush with the bottom edge (no white band under the input).
 * `md:` drops the nav pad because BottomNavBar is `md:hidden`.
 */
export const playerMainPadClass =
  "pb-[calc(var(--dama-bottom-nav-height,5.5rem)+var(--dama-bottom-pad-extra,1.25rem)+env(safe-area-inset-bottom,0px))] md:pb-8";

/** Home play: same bottom-nav clearance; tighter on md+ where the nav is hidden. */
export const homePlayMainPadClass =
  "pb-[calc(var(--dama-bottom-nav-height,5.5rem)+var(--dama-bottom-pad-extra,1.25rem)+env(safe-area-inset-bottom,0px))] md:pb-3";

/**
 * Mobile/tablet board + rail column (Chess.com locked play hub).
 * Fills the shell; board is height-budgeted; rail flexes and owns the scrollport.
 */
export const mobilePlayBoardColumnClass =
  "max-lg:flex max-lg:h-full max-lg:min-h-0 max-lg:flex-col max-lg:overflow-hidden";

/**
 * Standalone play / spectate max-lg: fill remaining viewport under player chrome.
 */
export const mobilePlayBoardStandaloneHeightClass =
  "max-lg:min-h-[calc(100dvh-var(--dama-mobile-header-height,3.5rem)-var(--dama-bottom-nav-height,0px))]";

/**
 * Standalone play / spectate: fit viewport on desktop.
 * Home lobby uses `playHubFillHeightClass` inside the marketing shell instead.
 */
export const playHubDesktopHeightClass = "lg:h-[calc(100dvh-1rem)] lg:max-h-[calc(100dvh-1rem)]";

/**
 * Home play hub height (locked marketing shell, all breakpoints).
 * Shell is `h-dvh overflow-hidden`; hub fills; rail body scrolls under frozen tabs.
 */
export const playHubFillHeightClass = "min-h-0 h-full max-h-full flex-1 overflow-hidden";

/**
 * Right rail shell.
 * max-lg: one scrollport for tabs + panel (board stays fixed); bottom-nav clearance.
 * lg+: aside is a fixed column; PlayRailScrollPort scrolls under frozen tabs.
 */
export const playRailAsideClass =
  "order-2 flex min-h-0 min-w-0 flex-1 flex-col isolate overscroll-contain bg-[var(--dama-panel)] max-lg:relative max-lg:overflow-y-auto max-lg:[-webkit-overflow-scrolling:touch] max-md:pb-[calc(var(--dama-bottom-nav-height,5.5rem)+var(--dama-bottom-pad-extra,0.75rem)+env(safe-area-inset-bottom,0px))] lg:h-full lg:max-h-full lg:overflow-hidden lg:pb-0";

/**
 * Panel body scroll region.
 * max-lg: not a nested scroller (aside scrolls tabs + body together).
 * lg+: the only overflow-y scrollport under frozen rail chrome.
 */
export const playRailAsideScrollClass =
  "relative z-0 min-h-0 flex-1 overscroll-contain [-webkit-overflow-scrolling:touch] max-lg:flex-none max-lg:overflow-visible lg:overflow-y-auto";

/**
 * Primary rail tab/title bar.
 * max-lg: scrolls with the aside; lg+: frozen outside the body scrollport.
 */
export const playRailStickyMainClass =
  "relative z-20 shrink-0 border-b border-[var(--dama-border)] bg-[var(--dama-panel)]";

/**
 * Secondary tabs / search.
 * max-lg: scrolls with the aside; lg+: frozen outside the body scrollport.
 */
export const playRailStickySubClass =
  "relative z-10 shrink-0 border-b border-[var(--dama-border)] bg-[var(--dama-panel)]";

/** Active panel shell: fills aside under main tabs; owns sub chrome + body scroll. */
export const playRailPanelClass = "flex min-h-0 flex-1 flex-col max-lg:flex-none";

/**
 * Stacked rail panel slot - keep-mounted panels.
 * Active slot fills under main tabs; inactive stay `hidden`.
 * max-lg: natural height so the aside can scroll tabs + content.
 */
export const playRailPanelSlotClass =
  "flex min-h-0 flex-1 flex-col bg-[var(--dama-panel)] max-lg:relative max-lg:flex-none lg:absolute lg:inset-0 lg:flex-none";

/** Panel stack host under main tabs. */
export const playRailPanelStackClass = "relative flex min-h-0 flex-1 flex-col max-lg:flex-none";

/**
 * Desktop (lg+) immersive fill when a chat/DM thread is open: panel slot fills the
 * frozen aside so the message list can own overflow. Phone/tablet must NOT use this -
 * max-lg keeps one aside scrollport (tabs + lists + threads scroll together).
 */
export const playRailImmersiveChatFillClass = "lg:min-h-0 lg:flex-1";

/**
 * Message-list scrollport (lg+ / desktop chat). Composer is a sibling outside this node.
 * On max-lg prefer `chat="auto"` so the aside remains the only scrollport.
 */
export const playRailChatMessageScrollClass =
  "dama-chat-wallpaper relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]";

/** Outer port that only contains GameChatPanel (panel scrolls internally) - lg+ / desktop. */
export const playRailChatContainScrollClass =
  "dama-chat-wallpaper relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden";

/**
 * List/body inside the panel scrollport - grows with content (NO nested scroll).
 * Infinite scroll uses the parent `[data-dama-rail-scroll]` element.
 */
export const playRailInnerListScrollClass = "w-full";

/** @deprecated Alias - never nest a second scroll inside the rail. */
export const playRailNestedListScrollClass = playRailInnerListScrollClass;

/** Full-bleed content width (no cropped `container` column). */
export const playerMainWidthClass = "w-full max-w-none px-4 sm:px-6 lg:px-8";

export const playerStickyHeaderClass =
  "sticky top-0 z-50 border-b border-[var(--dama-border)]/60 bg-[var(--dama-card)]/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--dama-card)]/70";

export const playerHeaderInnerClass =
  "flex h-14 w-full max-w-none items-center justify-between gap-3 px-4 sm:px-6 lg:px-8";

/**
 * Screenshot marketplace card: NO border / NO card shell.
 * Hover lives on the rounded media well (image zoom), not a shadowed box.
 */
export const tournamentMiniCardClass =
  "group/card relative flex h-fit min-w-0 flex-col bg-transparent";

/** Home Play / Airbnb-density tournament grid (top-aligned, compact cards). */
export const tournamentMiniCardGridClass =
  "grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-4";

/** Marketplace / browse density (wider surfaces). */
export const tournamentBrowseGridClass =
  "grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-5 lg:grid-cols-4 xl:grid-cols-5";

/**
 * Phone/tablet board host: definite height budget so PlayBoardColumn can fit
 * top seat + square + bottom seat (never clip the bottom player bar).
 * Remaining hub height goes to the scrollable rail.
 */
export const mobilePlayBoardMaxHeightClass =
  "max-lg:h-[min(52dvh,calc(100dvh-var(--dama-mobile-header-height,3.5rem)-var(--dama-bottom-nav-height,0px)-10.5rem))] max-lg:max-h-[min(52dvh,calc(100dvh-var(--dama-mobile-header-height,3.5rem)-var(--dama-bottom-nav-height,0px)-10.5rem))] max-lg:w-full max-lg:shrink-0 max-lg:justify-start max-lg:overflow-hidden";
