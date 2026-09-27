import {
  BaseRootRoute,
  BaseRoute,
  RouterCore,
  createNonReactiveMutableStore,
  createNonReactiveReadonlyStore,
} from "@tanstack/router-core";

export type RoutePage =
  | "assistant"
  | "feedback"
  | "applications"
  | "employee"
  | "discovery"
  | "profile"
  | "signin"
  | "programs"
  | "external-preparation"
  | "not-found";
export type RouteStaffView =
  | "issues"
  | "overview"
  | "themes"
  | "taxonomy"
  | "hiring"
  | "applicants"
  | "analytics"
  | "audit"
  | "views"
  | "reports"
  | "settings"
  | "sources";
export type RouteDiscoveryArea =
  | "all"
  | "jobs"
  | "support"
  | "funding"
  | "nearby"
  | "participation"
  | "saved";

export interface RouteState {
  page: RoutePage;
  applicationView: "browse" | "mine";
  discoveryArea: RouteDiscoveryArea;
  programView: "discover" | "mine" | "sponsor";
  externalRecordId: string;
  employeePage: "assistant" | "feedback" | "applications";
  staffView: RouteStaffView;
  selectedFeedbackId: string;
}

const staffViews: readonly RouteStaffView[] = [
  "issues",
  "overview",
  "themes",
  "taxonomy",
  "hiring",
  "applicants",
  "analytics",
  "audit",
  "views",
  "reports",
  "settings",
  "sources",
];
const discoveryAreas: readonly RouteDiscoveryArea[] = [
  "all",
  "jobs",
  "support",
  "funding",
  "nearby",
  "participation",
  "saved",
];
const routePaths = [
  "/",
  "/signin",
  "/feedback",
  "/applications",
  "/applications/mine",
  "/explore",
  ...discoveryAreas
    .filter((area) => area !== "all")
    .map((area) => `/explore/${area}`),
  "/programs",
  "/programs/mine",
  "/programs/sponsor",
  "/profile",
  "/external/$recordId",
  "/staff",
  "/staff/agent",
  ...staffViews.map((view) => `/staff/${view}`),
  "/staff/issues/$caseId",
] as const;

const rootRoute = new BaseRootRoute();
const routeTree = rootRoute.addChildren(
  routePaths.map(
    (path) =>
      new BaseRoute({
        getParentRoute: () => rootRoute,
        path,
      }),
  ),
);
const router = new RouterCore({ routeTree }, () => ({
  createMutableStore: createNonReactiveMutableStore,
  createReadonlyStore: createNonReactiveReadonlyStore,
  batch: (fn: () => void) => fn(),
}));

export function routePath(state: RouteState): string | null {
  switch (state.page) {
    case "assistant":
      return "/";
    case "signin":
      return "/signin";
    case "feedback":
      return "/feedback";
    case "applications":
      return state.applicationView === "mine"
        ? "/applications/mine"
        : "/applications";
    case "discovery":
      return state.discoveryArea === "all"
        ? "/explore"
        : `/explore/${state.discoveryArea}`;
    case "programs":
      return state.programView === "discover"
        ? "/programs"
        : `/programs/${state.programView}`;
    case "profile":
      return "/profile";
    case "external-preparation":
      return state.externalRecordId
        ? `/external/${encodeURIComponent(state.externalRecordId)}`
        : "/explore";
    case "employee":
      if (state.employeePage === "assistant") return "/staff/agent";
      if (state.staffView === "issues" && state.selectedFeedbackId)
        return `/staff/issues/${encodeURIComponent(state.selectedFeedbackId)}`;
      return `/staff/${state.staffView}`;
    case "not-found":
      return null;
  }
}

export function routeState(
  pathname = window.location.pathname,
): Partial<RouteState> | null {
  if (pathname === "/callback" || pathname.startsWith("/api/")) return null;
  const { foundRoute, routeParams } = router.getMatchedRoutes(pathname);
  const path = foundRoute?.fullPath;
  if (!path) return { page: "not-found" };
  if (path === "/") return { page: "assistant" };
  if (path === "/signin") return { page: "signin" };
  if (path === "/feedback") return { page: "feedback" };
  if (path === "/applications" || path === "/applications/mine")
    return {
      page: "applications",
      applicationView: path.endsWith("/mine") ? "mine" : "browse",
    };
  if (path === "/explore" || path.startsWith("/explore/"))
    return {
      page: "discovery",
      discoveryArea:
        path === "/explore"
          ? "all"
          : (path.slice("/explore/".length) as RouteDiscoveryArea),
    };
  if (path === "/programs" || path.startsWith("/programs/"))
    return {
      page: "programs",
      programView:
        path === "/programs"
          ? "discover"
          : (path.slice("/programs/".length) as RouteState["programView"]),
    };
  if (path === "/profile") return { page: "profile" };
  if (path === "/external/$recordId" && routeParams.recordId)
    return {
      page: "external-preparation",
      externalRecordId: routeParams.recordId,
    };
  if (path === "/staff" || path === "/staff/agent")
    return {
      page: "employee",
      employeePage: "assistant",
      selectedFeedbackId: "",
    };
  if (path === "/staff/issues/$caseId" && routeParams.caseId)
    return {
      page: "employee",
      employeePage: "feedback",
      staffView: "issues",
      selectedFeedbackId: routeParams.caseId,
    };
  if (path.startsWith("/staff/"))
    return {
      page: "employee",
      employeePage: "feedback",
      staffView: path.slice("/staff/".length) as RouteStaffView,
      selectedFeedbackId: "",
    };
  return { page: "not-found" };
}

export function syncRoute(state: RouteState): void {
  if (
    window.location.pathname === "/callback" ||
    window.location.pathname.startsWith("/api/")
  )
    return;
  const path = routePath(state);
  // Browser history updates window.location in a microtask after notifying subscribers.
  // Compare against TanStack's current location so a pending push is not repeated.
  if (path && router.history.location.pathname !== path) {
    void router.navigate({
      to: path,
      replace: router.history.location.pathname === "/staff",
    });
  }
}

export function listenForRoutes(
  onRoute: (route: Partial<RouteState>, pathname: string) => void,
): void {
  router.history.subscribe(({ location }) => {
    const route = routeState(location.pathname);
    if (route) onRoute(route, location.pathname);
  });
}
