"use client";

import ErrorPage from "@/app/error";

// Same names and copy as the app-wide boundary (DESIGN §6.10, §11): "Something went wrong", "Try again",
// "Back to curriculum", and the database-down view. It refetches via Next's `retry` (falls back to reset()).
export default ErrorPage;
