import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
    "/sign-in(.*)",
    "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
    const url = new URL(request.url);
    const hasTicket = url.searchParams.has("ticket");
    const hasDemo = url.searchParams.get("demo") === "true";

    if (isPublicRoute(request) || hasTicket || hasDemo) {
        return;
    }

    await auth.protect();
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
