import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `server-only` throws outside a Next server bundle; make it a no-op in unit tests.
vi.mock("server-only", () => ({}));

// Vitest globals are off, so RTL's automatic cleanup doesn't register.
afterEach(() => cleanup());
